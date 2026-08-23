#!/usr/bin/env node
// Command-line harness around the configurator's own protocol modules,
// for validating them against emulated (or real) ESCs without a browser.
//
//   node cli/am32cli.mjs direct-suite  <tty> <firmware.hex>
//   node cli/am32cli.mjs fourway-suite <tty> <firmware.hex>
//
// This is NOT a reimplementation: it loads the same four_way.ts,
// direct.ts, serial.ts, mcu.ts, flash.ts and eeprom.ts the deployed app
// runs (plus the same webserial-wrapper / @am32/serial-msp transport),
// with Node stand-ins only for the Nuxt auto-imports, the pinia app
// instance and the WebSerial SerialPort. The suite flows mirror
// SerialDevice.vue's connect / save-settings / flash handlers.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { openNodeSerialPort } from './node-serial-port.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// webserial-wrapper's timer shim references the Worker identifier at
// module scope; make it resolve (to undefined) so the wrapper falls
// back to native timers under Node
if (!('Worker' in globalThis)) {
    globalThis.Worker = undefined;
}

const jiti = createJiti(import.meta.url, {
    alias: {
        '~': root,
        '@': root,
        // the package's CJS main assigns globals instead of exporting;
        // the ESM build has the named WebSerial export the app imports
        'webserial-wrapper': path.join(root,
            'node_modules/webserial-wrapper/dist/serialstream.esm.js')
    },
    interopDefault: true
});

// --- the Nuxt auto-imports the app modules rely on ---------------------
const vue = await jiti.import('vue');
for (const k of ['ref', 'computed', 'reactive', 'watch', 'toRaw', 'unref']) {
    globalThis[k] = vue[k];
}
const pinia = await jiti.import('pinia');
pinia.setActivePinia(pinia.createPinia());
globalThis.defineStore = pinia.defineStore;
globalThis.storeToRefs = pinia.storeToRefs;

for (const [g, f] of Object.entries({
    delay: 'delay',
    compare: 'compare',
    padStr: 'pad-str',
    bufferToSettings: 'buffer-to-settings',
    objectToSettingsArray: 'object-to-settings-array',
    mergeUint8Arrays: 'mergeUint8Arrays',
    enumToString: 'enum-toString',
    asciiToBuffer: 'ascii-to-buffer'
})) {
    const mod = await jiti.import(path.join(root, 'utils', f + '.ts'));
    globalThis[g] = mod.default ?? mod;
}

globalThis.useLogStore = (await jiti.import(path.join(root, 'stores/log.ts'))).useLogStore;
globalThis.useEscStore = (await jiti.import(path.join(root, 'stores/esc.ts'))).useEscStore;
globalThis.useSerialStore = (await jiti.import(path.join(root, 'stores/serial.ts'))).useSerialStore;

// --- the real protocol stack -------------------------------------------
const Serial = (await jiti.import(path.join(root, 'src/communication/serial.ts'))).default;
const { Msp } = await jiti.import(path.join(root, 'src/communication/msp.ts'));
const { FourWay, FOUR_WAY_COMMANDS } = await jiti.import(path.join(root, 'src/communication/four_way.ts'));
const { Direct, DIRECT_COMMANDS } = await jiti.import(path.join(root, 'src/communication/direct.ts'));
const Flash = (await jiti.import(path.join(root, 'src/flash.ts'))).default;
const Mcu = (await jiti.import(path.join(root, 'src/mcu.ts'))).default;
const CommandQueue = (await jiti.import(path.join(root, 'src/communication/commands.queue.ts'))).default;
const { MSP_COMMANDS } = await jiti.import('@am32/serial-msp');

const log = (s) => console.log('  [log]', s);
const logWarning = (s) => console.log('  [warn]', s);
const logError = (s) => console.log('  [error]', s);

Msp.init(log, logWarning, logError);
FourWay.init(log, logWarning, logError);
Direct.init(log, logWarning, logError);

const escStore = globalThis.useEscStore();
const serialStore = globalThis.useSerialStore();
const delay = globalThis.delay;
const objectToSettingsArray = globalThis.objectToSettingsArray;

function summarize (info) {
    console.log('connected: file_name=%s mcu=%s signature=0x%s bl_pin=%s bl_version=%s layout_rev=%s%s',
        info.meta.am32.fileName, info.meta.am32.mcuType,
        info.meta.signature.toString(16),
        info.bootloader.pin, info.bootloader.version,
        info.settings.LAYOUT_REVISION,
        info.v3 ? ' v3_shift=' + info.v3.address_shift : '');
}

function settingsEqualButVersionByte (a, b) {
    if (!a || !b || a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        // byte 2 is the boot-version byte the bootloader stamps on writes
        if (i !== 2 && a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

// the direct flash flow of SerialDevice.vue's startFlash(), verbatim in
// structure so a pass here is representative of the web app
async function directFlash (info, hexString) {
    const parsed = Flash.parseHex(hexString);
    const mcu = new Mcu(info.meta.signature);
    mcu.setInfo(info);
    if (!parsed) {
        throw new Error('hex parse failed');
    }
    escStore.bytesWritten = 0;

    // one merged 0xFF-filled image written in aligned chunks from the
    // firmware start, mirroring the component (and writeHex)
    const endAddress = parsed.data[parsed.data.length - 1].address + parsed.data[parsed.data.length - 1].bytes;
    const image = Flash.fillImage(parsed, endAddress - mcu.getFlashOffset(), mcu.getFlashOffset());
    if (!image) {
        throw new Error('hex file addresses fall outside the flash');
    }
    const begin = mcu.getFirmwareStartByte();
    escStore.totalBytes = image.byteLength - begin;

    const havePreConfig = info.settings.BOOT_BYTE <= 1 && info.settings.LAYOUT_REVISION <= 64;
    if (havePreConfig) {
        const guard = Uint8Array.from(info.settingsBuffer.subarray(0, 48));
        guard[0] = 0x00;
        await Direct.getInstance().writeChunked(mcu.getEepromStartByte(), guard, mcu.getDirectWriteChunk());
    }

    const CHUNK_SIZE = mcu.getDirectWriteChunk();
    console.log('  flashing: 0x%s..0x%s (%d bytes)', begin.toString(16),
        image.byteLength.toString(16), image.byteLength - begin);
    const t0 = Date.now();
    for (let off = begin; off < image.byteLength; off += CHUNK_SIZE) {
        const end = Math.min(off + CHUNK_SIZE, image.byteLength);
        let chunk = image.subarray(off, end);
        if (chunk.length % 8 !== 0) {
            const padded = new Uint8Array((chunk.length + 7) & ~7).fill(0xFF);
            padded.set(chunk);
            chunk = padded;
        }
        await Direct.getInstance().writeBufferToAddress(off, chunk);
        escStore.bytesWritten += end - off;
    }
    console.log('  flash writes done in %ds', ((Date.now() - t0) / 1000).toFixed(1));

    const preFlash = info.settings;
    if (preFlash.BOOT_BYTE <= 1 && preFlash.LAYOUT_REVISION <= 64) {
        console.log('  rewriting config');
        const mcu2 = new Mcu(info.meta.signature);
        mcu2.setInfo(info);
        await Direct.getInstance().writeChunked(mcu2.getEepromStartByte(),
            objectToSettingsArray(info.settings, info.settings.LAYOUT_REVISION),
            mcu2.getDirectWriteChunk());
    } else {
        console.log('  eeprom is erased; skipping config rewrite');
    }
    console.log('  resetting');
    await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_Reset, 0);
    await delay(3000);
}

async function directSuite (tty, hexPath) {
    const port = openNodeSerialPort(tty);
    Serial.init(log, logError, logWarning, serialStore.deviceHandles.serial, port);
    serialStore.isDirectConnect = true;

    const info = await Direct.getInstance().init();
    if (!info) {
        throw new Error('direct connect failed');
    }
    escStore.escData = [{ isError: false, data: info }];
    summarize(info);

    // save settings, as writeConfig() does in direct mode, then re-read
    const mcu = new Mcu(info.meta.signature);
    mcu.setInfo(info);
    const written = objectToSettingsArray(info.settings, info.settings.LAYOUT_REVISION);
    await Direct.getInstance().writeChunked(mcu.getEepromStartByte(), written, mcu.getDirectWriteChunk());
    const back = await Direct.getInstance().readChunked(mcu.getEepromStartByte(), Mcu.LAYOUT_SIZE);
    if (!settingsEqualButVersionByte(written.subarray(0, back.length), back)) {
        throw new Error('settings write/readback mismatch');
    }
    console.log('  settings write+readback ok');

    await directFlash(info, fs.readFileSync(hexPath, 'ascii'));

    // as the app does after a flash: reconnect and read everything again.
    // The probe only helps once the freshly flashed firmware has booted
    // and is listening (it reboots into the bootloader when it hears
    // it); the slowest emulated families take a couple of minutes of
    // wall clock to get there, so allow the retries a human clicking
    // connect again would provide.
    // The reconnect only works once the app has been QUIET-timed-out
    // back into the bootloader (2 firmware-seconds without a signal),
    // and on slow emulated families the probes themselves count as
    // signal, so after a few quick tries leave real gaps - the pace a
    // human clicking connect again provides naturally.
    let info2 = null;
    for (let i = 0; i < 18 && !info2; i++) {
        info2 = await Direct.getInstance().init().catch(() => null);
        if (!info2) {
            await delay(i < 3 ? 3000 : 25000);
        }
    }
    if (!info2) {
        throw new Error('post-flash reconnect failed');
    }
    summarize(info2);
    console.log('DIRECT SUITE PASSED');
}

async function fourwaySuite (tty, hexPath) {
    const port = openNodeSerialPort(tty);
    Serial.init(log, logError, logWarning, serialStore.deviceHandles.serial, port);

    // the connect sequence of SerialDevice.vue's connectToDevice()
    const commandsQueue = CommandQueue;
    const apiVersion = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_API_VERSION)
        .catch(async () => {
            // as connectToDevice() recovers: the FC may still be in a
            // 4-way session from a previous run
            logError('MSP_API_VERSION failed, trying to exit fourway and try again.');
            serialStore.isFourWay = true;
            await FourWay.getInstance().sendWithPromise(FOUR_WAY_COMMANDS.cmd_InterfaceExit);
            await delay(1000);
            serialStore.isFourWay = false;
            return Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_API_VERSION).catch(() => null);
        });
    if (!apiVersion) {
        throw new Error('MSP_API_VERSION failed');
    }
    commandsQueue.processMspResponse(apiVersion.commandName, apiVersion.data);
    for (const cmd of [MSP_COMMANDS.MSP_FC_VARIANT, MSP_COMMANDS.MSP_BATTERY_STATE]) {
        const r = await Msp.getInstance().sendWithPromise(cmd);
        if (r) {
            commandsQueue.processMspResponse(r.commandName, r.data);
        }
    }
    const motor = await Msp.getInstance().sendWithPromise(
        Msp.getInstance().getTypeMotorCommand(serialStore.mspData.type));
    if (motor) {
        commandsQueue.processMspResponse(motor.commandName, motor.data);
    }
    const passthrough = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_SET_PASSTHROUGH);
    await delay(2000);
    serialStore.isFourWay = true;
    escStore.expectedCount = passthrough?.data.getUint8(0) ?? 0;
    console.log('  4-way passthrough, %d ESC(s)', escStore.expectedCount);

    const info = await FourWay.getInstance().getInfo(0, 20);
    escStore.escData = [{ isError: false, data: info }];
    summarize(info);

    // settings write via writeSettings(), with a real change, then verify
    // through a fresh read and restore
    const before = info.settings.BEEP_VOLUME;
    const flipped = before === 5 ? 4 : 5;
    info.settings.BEEP_VOLUME = flipped;
    info.settingsBuffer = await FourWay.getInstance().writeSettings(0, info);
    const mcu = new Mcu(info.meta.signature);
    mcu.setInfo(info);
    const back = (await FourWay.getInstance().readAddress(mcu.getEepromWireAddress(), Mcu.LAYOUT_SIZE, 10, 1500)).params;
    const backSettings = globalThis.bufferToSettings(back, info.settings.LAYOUT_REVISION);
    if (backSettings.BEEP_VOLUME !== flipped) {
        throw new Error(`settings write not visible on readback (${backSettings.BEEP_VOLUME} != ${flipped})`);
    }
    info.settings.BEEP_VOLUME = before;
    info.settingsBuffer = await FourWay.getInstance().writeSettings(0, info);
    console.log('  settings write+readback ok');

    // flash, as the app's startFlash() four-way branch does
    const t0 = Date.now();
    await FourWay.getInstance().writeHex(0, info, fs.readFileSync(hexPath, 'ascii'), 200);
    console.log('  flash done in %ds', ((Date.now() - t0) / 1000).toFixed(1));
    await FourWay.getInstance().reset(0);
    await delay(5000);
    const info2 = await FourWay.getInstance().getInfo(0, 20);
    summarize(info2);
    console.log('FOURWAY SUITE PASSED');
}

const [, , cmd, tty, hexPath] = process.argv;
try {
    if (cmd === 'direct-suite') {
        await directSuite(tty, hexPath);
    } else if (cmd === 'fourway-suite') {
        await fourwaySuite(tty, hexPath);
    } else {
        console.error('usage: am32cli.mjs direct-suite|fourway-suite <tty> <firmware.hex>');
        process.exit(2);
    }
    process.exit(0);
} catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
}
