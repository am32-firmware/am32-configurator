import Flash from '../flash';
import Mcu, { type DevinfoV3, type McuInfo } from '../mcu';
import CommandQueue from '~/src/communication/commands.queue';
import Serial from '~/src/communication/serial';

/*
  Bootloader magic CMD_SET_ADDRESS values.

  v2 added EEPROM and FILE_NAME magics so the configurator can address the
  EEPROM region without per-MCU offsets. v3 adds DEVINFO: a read at 0x23
  returns the bootloader's packed devinfo struct (magic1, magic2, 9-byte
  deviceInfo, length, address_shift, and four CMD_SET_ADDRESS values for
  firmware / filename / eeprom / tune).

  See AM32-bootloader bootloader/main.c (ADDRESS_MAGIC_* + decodeInput) and
  the desktop client am32-firmware/Offline-Configurator fourwayif.cpp
  parseDevinfoBlock for the canonical reference.
 */
export enum ADDRESS_MAGIC {
    EEPROM = 0x20,
    FILE_NAME = 0x21,
    CONTINUE = 0x22,
    DEVINFO = 0x23,
}

const DEVINFO_MAGIC1 = 0x5925E3DA;
const DEVINFO_MAGIC2 = 0x4EB863D9;
/**
 * Parse a response payload read from ADDRESS_MAGIC_DEVINFO. Returns the v3
 * fields when the magic words match and the bootloader-reported length is
 * sane; otherwise null (pre-v3 bootloader, truncated response, or junk).
 */
const DEVINFO_V3_MIN = 27; // smallest struct that contains every field we read
export const DEVINFO_V3_MAX = 64; // sanity cap so a garbage byte can't be trusted as a length
export function parseDevinfoBlock (block: Uint8Array): DevinfoV3 | null {
    if (block.byteLength < 8 + 9 + 1) { // need at least magic + deviceInfo + length
        return null;
    }
    const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
    const m1 = dv.getUint32(0, true);
    const m2 = dv.getUint32(4, true);
    if (m1 !== DEVINFO_MAGIC1 || m2 !== DEVINFO_MAGIC2) {
        return null;
    }
    // packed layout: magic1[0..3] magic2[4..7] deviceInfo[8..16]
    // length[17] address_shift[18] firmware_start[19..20]
    // filename_start[21..22] eeprom_start[23..24] tune_start[25..26]
    const length = dv.getUint8(17);
    if (length < DEVINFO_V3_MIN || length > DEVINFO_V3_MAX || block.byteLength < length) {
        return null;
    }
    const v3: DevinfoV3 = {
        length,
        address_shift: dv.getUint8(18),
        firmware_start: dv.getUint16(19, true),
        filename_start: dv.getUint16(21, true),
        eeprom_start: dv.getUint16(23, true),
        tune_start: dv.getUint16(25, true)
    };
    if (v3.address_shift > 8) {
        // every field below redirects flash writes; a shift no real part
        // needs (8 covers 16MB) marks the block as junk, not v3
        return null;
    }
    return v3;
}

export enum FOUR_WAY_COMMANDS {
    cmd_InterfaceTestAlive = 0x30,
    cmd_ProtocolGetVersion = 0x31,
    cmd_InterfaceGetName = 0x32,
    cmd_InterfaceGetVersion = 0x33,
    cmd_InterfaceExit = 0x34,
    cmd_DeviceReset = 0x35,
    cmd_DeviceInitFlash = 0x37,
    cmd_DeviceEraseAll = 0x38,
    cmd_DevicePageErase = 0x39,
    cmd_DeviceRead = 0x3A,
    cmd_DeviceWrite = 0x3B,
    cmd_DeviceC2CK_LOW = 0x3C,
    cmd_DeviceReadEEprom = 0x3D,
    cmd_DeviceWriteEEprom = 0x3E,
    cmd_InterfaceSetMode = 0x3F,
  };

export enum FOUR_WAY_ACK {
    ACK_OK = 0x00,
    ACK_I_UNKNOWN_ERROR = 0x01,
    ACK_I_INVALID_CMD = 0x02,
    ACK_I_INVALID_CRC = 0x03,
    ACK_I_VERIFY_ERROR = 0x04,
    ACK_D_INVALID_COMMAND = 0x05,
    ACK_D_COMMAND_FAILED = 0x06,
    ACK_D_UNKNOWN_ERROR = 0x07,
    ACK_I_INVALID_CHANNEL = 0x08,
    ACK_I_INVALID_PARAM = 0x09,
    ACK_D_GENERAL_ERROR = 0x0F,
  };

export class FourWay {
    static instance: FourWay;

    static init (
        log: (s: string) => void,
        logWarning: (s: string) => void,
        logError: (s: string) => void
    ) {
        FourWay.instance = new FourWay(log, logWarning, logError);
    }

    static getInstance () {
        if (!FourWay.instance) {
            useLogStore().logError('FourWay instance missing!');
            throw new Error('FourWay instance missing!');
        }
        return FourWay.instance;
    }

    constructor (
      private readonly log: ((s: string) => void),
      private readonly logError: ((s: string) => void),
      private readonly logWarning: ((s: string) => void)
    ) {
    }

    makePackage (cmd: FOUR_WAY_COMMANDS, params: number[], address: number) {
        if (params.length === 0) {
            params.push(0);
        } else if (params.length > 256) {
            this.logError('Too many parameters ' + params.length);
            return;
        }

        const bufferOut = new ArrayBuffer(7 + params.length);
        const bufferView = new Uint8Array(bufferOut);

        bufferView[0] = 0x2F;
        bufferView[1] = cmd;
        bufferView[2] = (address >> 8) & 0xFF;
        bufferView[3] = address & 0xFF;
        bufferView[4] = params.length === 256 ? 0 : params.length;

        // Copy params
        const outParams = bufferView.subarray(5);
        for (let i = 0; i < params.length; i += 1) {
            outParams[i] = params[i];
        }

        // Calculate checksum
        const msgWithoutChecksum = bufferView.subarray(0, -2);
        const checksum = msgWithoutChecksum.reduce(this.crc16XmodemUpdate, 0);

        bufferView[5 + params.length] = (checksum >> 8) & 0xFF;
        bufferView[6 + params.length] = checksum & 0xFF;

        return bufferOut;
    }

    crc16XmodemUpdate (crc: number, byte: number) {
        const poly = 0x1021;
        crc ^= byte << 8;
        for (let i = 0; i < 8; i += 1) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ poly;
            } else {
                crc <<= 1;
            }
        }

        return crc & 0xFFFF;
    }

    initFlash (target: number, retries = 10) {
        // The target is carried only in the parameter. Betaflight replies to
        // InitFlash with address 0, so putting the target in the otherwise
        // unused address field makes every target after ESC 1 look stale.
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_DeviceInitFlash, [target], 0, retries);
    }

    reset (target: number) {
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_DeviceReset, [target], 0);
    }

    /* buildDisplayName(flash: McuInfo, make: string) {
        const settings = flash.settings;
        let revision = 'Unsupported/Unrecognized';
        if(settings.MAIN_REVISION !== undefined && settings.SUB_REVISION !== undefined) {
          revision = `${settings.MAIN_REVISION}.${settings.SUB_REVISION}`;
        }

        if(make === 'NOT READY') {
          revision = 'FLASH FIRMWARE';
        }

        //if we can extract the AM32 mcutype, display it here
        const mcuType = flash.meta?.am32?.mcuType ? `, MCU: ${flash.meta.am32.mcuType}` : '';

        const bootloader = flash.bootloader.valid ? `, Bootloader v${flash.bootloader.version} (${flash.bootloader.pin})${mcuType}` : ', Bootloader unknown';

        return `${make} - ${this.name}, ${revision}${bootloader}`;
    } */

    async getInfo (target: number, initRetries = 2) {
        const logStore = useLogStore();

        const flash = await this.initFlash(target, initRetries);
        const info = Flash.getInfo(flash!);
        const mcu = new Mcu(info.meta.signature);
        mcu.setInfo(info);

        // v3 detection: try the magic-devinfo read. v3+ bootloaders return a
        // packed struct beginning with two magic words; pre-v3 bootloaders
        // either reject the read (address < 1024 is reserved) or return junk
        // that fails the magic check. Fail fast so pre-v3 boards aren't slowed.
        try {
            // read the max so a forward-compatible block with length>27 still
            // satisfies the length check in parseDevinfoBlock; we only decode
            // the first 27 bytes regardless.
            // These timeouts are failure bounds, not latencies: they only
            // cost time when something is actually wrong. The 64-byte reply
            // is ~35ms of 19200-baud wire time and a passthrough FC only
            // forwards it once complete; a heavily loaded emulator host can
            // stretch that a lot, and 128k parts have no fallback if v3
            // detection fails, so be generous
            const magicRead = await this.readAddress(ADDRESS_MAGIC.DEVINFO, DEVINFO_V3_MAX, 3, 500, 50);
            const v3 = magicRead?.params ? parseDevinfoBlock(magicRead.params) : null;
            if (v3) {
                info.v3 = v3;
                this.log(`v3 devinfo: address_shift=${v3.address_shift} firmware_start=0x${v3.firmware_start.toString(16)} eeprom_start=0x${v3.eeprom_start.toString(16)}`);
            }
        } catch (e) {
            // pre-v3 bootloader; the magic read can fail, that's fine
        }

        // Parts whose flash exceeds the 16-bit wire-address space (e.g. 128k
        // STM32G431/G491, signature 2B06) MUST report a non-zero address_shift
        // via v3 devinfo. Without it, getFileNameWireAddress() would mask the
        // EEPROM offset to 16 bits and silently miscompute the address. The
        // configurator never supported such parts pre-v3 anyway, so a missing
        // v3 here is an unsupported/transient-failure condition; fail clearly
        // rather than corrupting flash.
        if (mcu.getFlashSize() > 0x10000 && !info.v3) {
            const sig = info.meta.signature.toString(16).toUpperCase();
            throw new Error(`MCU 0x${sig} requires v3 bootloader devinfo (address_shift) but the magic-devinfo read failed. Try reconnecting; if this persists the ESC is running a pre-v3 bootloader that this configurator can't drive correctly.`);
        }

        try {
            const fileNameRead = await this.readAddress(mcu.getFileNameWireAddress(), 32, 10, 1000);
            const fileName = new TextDecoder().decode(fileNameRead!.params.slice(0, fileNameRead?.params.indexOf(0x0)));

            if (/[A-Z0-9_]+/.test(fileName)) {
                mcu.getInfo().meta.am32.fileName = fileName;
                mcu.getInfo().meta.am32.mcuType = fileName.slice(fileName.lastIndexOf('_') + 1);
            }

            if (mcu.getInfo().meta.input) {
                mcu.getInfo().bootloader.input = info.meta.input;
                mcu.getInfo().bootloader.valid = false;
            }

            mcu.getInfo().layoutSize = Mcu!.LAYOUT_SIZE;

            // the settings block is ~184 bytes = ~100ms of 19200-baud wire
            // time, and a passthrough FC forwards the reply only once it is
            // complete, so the default 200ms timeout barely fits; give the
            // transfer real headroom (emulated ESCs can be slower still)
            const settingsArray = (await this.readAddress(mcu.getEepromWireAddress(), mcu.getInfo().layoutSize, 10, 1500))!.params;
            mcu.getInfo().settings = bufferToSettings(settingsArray, info.settings.LAYOUT_REVISION as number);
            mcu.getInfo().settingsBuffer = settingsArray;

            const [valid, pin] = Mcu.parseBootLoaderPin(mcu.getInfo().bootloader.input);
            if (!valid) {
                this.logError(`Invalid bootloader pin ${mcu.getInfo().bootloader.input}`);
            } else {
                mcu.getInfo().bootloader.valid = true;
                mcu.getInfo().bootloader.pin = pin;
                mcu.getInfo().bootloader.version = info.settings.BOOT_LOADER_REVISION as number ?? 0;
            }

            if (mcu.getInfo().bootloader.version === 0xFF) {
                logStore.logWarning('Bootloader version unset, setting to 1');
                info.settings.BOOT_LOADER_REVISION = 1;
                await this.writeSettings(target, mcu.getInfo());
                mcu.getInfo().bootloader.version = 1;
            }
        } catch (e: any) {
            console.error(e);
            throw new Error(e.message);
        }

        return info;
    }

    readAddress (address: number, bytes: number, retries = 10, timeout = 200, retryDelay = 250) {
        return this.sendWithPromise(
            FOUR_WAY_COMMANDS.cmd_DeviceRead,
            [bytes === 256 ? 0 : bytes],
            address,
            retries,
            timeout,
            retryDelay
        );
    }

    async read (): Promise<void> {
        try {
            const readerData: ReadableStreamReadResult<Uint8Array> = await Serial.read<Uint8Array>();
            if (readerData.value) {
                this.parseMessage(readerData.value.buffer);
            }
        } catch (err) {
            console.error(`error reading data: ${err}`);
        }
    }

    async send (command: FOUR_WAY_COMMANDS, params: number[] = [0], address: number = 0, timeout = 200) {
        this.log(`Sending ${enumToString(command, FOUR_WAY_COMMANDS)}...`);

        const message = this.makePackage(command, params, address);

        if (!message) {
            this.logError('message empty');
            throw new Error('message empty!');
        }

        try {
            return await Serial.write(message, timeout);
        } catch (e: any) {
            this.logError(`MSP command failed: ${e.message}`);
            return null;
        }
    }

    sendWithCallback (command: FOUR_WAY_COMMANDS, callback: PromiseFn<any>, params: number[] = [0], address = 0, retries = 0) {
        CommandQueue.addCallback(command, callback, retries);
        return this.send(command, params, address);
    }

    sendWithPromise (command: FOUR_WAY_COMMANDS, params: number[] = [0], address = 0, retries = 10, timeout = 200, retryDelay = 250): Promise<FourWayResponse | null> {
        let currentTry = 0;

        const callback: (resolve: PromiseFn<any>, reject: PromiseFn<any>) => void = async (resolve, reject) => {
            while (currentTry++ < retries) {
                const result = await this.send(command, params, address, timeout).catch((err) => {
                    console.log(err);
                    return null;
                });
                console.log(currentTry, params, enumToString(command, FOUR_WAY_COMMANDS), result);
                if (command === FOUR_WAY_COMMANDS.cmd_InterfaceExit) {
                    resolve(null);
                    break;
                }

                if (result) {
                    try {
                        const response = this.parseMessage(result.buffer);
                        // A reply echoes the command and address it answers.
                        // A late reply to a timed-out request can land here
                        // instead - without this check it gets accepted as
                        // the answer to the current request and every later
                        // exchange pairs with the wrong reply (a devinfo
                        // block read as the firmware name, for example).
                        if (response.data.command !== command ||
                            response.data.address !== address) {
                            this.logError(`  stale reply for ${enumToString(response.data.command, FOUR_WAY_COMMANDS)} @0x${response.data.address.toString(16)}, discarded`);
                        } else if (response.data.ack === FOUR_WAY_ACK.ACK_OK) {
                            resolve(response.data);
                            break;
                        } else {
                            this.logError(`  error: ${enumToString(response.data.ack, FOUR_WAY_ACK)}`);
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
                if (currentTry < retries) {
                    await delay(retryDelay);
                }
            }

            if (currentTry > retries) {
                reject(new Error('max retries reached'));
                this.logError('max retries reached');
            }
        };
        return new Promise(callback) as Promise<FourWayResponse | null>;
    }

    parseMessage (buffer: ArrayBufferLike) {
        const fourWayIf = 0x2E;

        const view = new Uint8Array(buffer);
        if (view[0] !== fourWayIf) {
            const error = `invalid message start: ${view[0]}`;
            throw new Error(error);
        }

        if (view.length < 9) {
            throw new Error('NotEnoughDataError');
        }

        let paramCount = view[4];
        if (paramCount === 0) {
            paramCount = 256;
        }

        if (view.length < 8 + paramCount) {
            throw new Error('NotEnoughDataError');
        }

        const message: FourWayResponse = {
            command: view[1],
            address: (view[2] << 8) | view[3],
            ack: view[5 + paramCount],
            checksum: (view[6 + paramCount] << 8) | view[7 + paramCount],
            params: view.slice(5, 5 + paramCount)
        };

        const msgWithoutChecksum = view.subarray(0, 6 + paramCount);
        const checksum = msgWithoutChecksum.reduce(this.crc16XmodemUpdate, 0);

        if (checksum !== message.checksum) {
            // this.increasePacketErrors(1);

            const error = `checksum mismatch, received: ${message.checksum}, calculated: ${checksum}`;
            this.logError(error);
            throw new Error(error);
        }

        return {
            commandName: message.command,
            data: message
        };
    }

    writeAddress (address: number, data: Uint8Array) {
        console.log(address, data);
    // const message = this.makePackage(FOUR_WAY_COMMANDS.cmd_DeviceWrite, data, address);
    // return Serial.write(data, address);
    }

    /**
 * Write data to address
 *
 * @param {number} address
 * @param {Array<number>} data
 * @returns {Promise<Response>}
 */
    write (address: number, data: number[] | Uint8Array, timeout = 200) {
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_DeviceWrite, Array.from(data), address, 10, timeout);
    }

    /**
   * Write data to EEprom address
   *
   * @param {number} address
   * @param {Array<number>} data
   * @returns {Promise<Response>}
   */
    writeEEprom (address: number, data: number[]) {
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_DeviceWriteEEprom, data, address);
    }

    /**
     * Write firmware to flash, in 256-byte chunks, between two physical byte
     * offsets (from flash_offset). The wire CMD_SET_ADDRESS for each chunk is
     * computed via mcu.toWireAddress(), so 128k parts that report an
     * address_shift in the v3 devinfo get the right addresses.
     */
    async writePages (beginByte: number, endByte: number, data: Uint8Array, timeout: number, mcu: Mcu) {
        const step = 0x100;
        const escStore = useEscStore();

        for (let off = beginByte; off < endByte && off < data.length; off += step) {
            const chunkEnd = Math.min(off + step, data.length);
            let chunk: Uint8Array = data.subarray(off, chunkEnd);
            // STM32 G4 (and similar) flash programs in 8-byte doublewords, so
            // the bootloader rejects a last chunk whose size isn't a multiple
            // of 8 (ACK_D_GENERAL_ERROR). Pad with 0xFF up to the next 8-byte
            // boundary — matches what the desktop client does.
            if (chunk.byteLength % 8 !== 0) {
                const padded = new Uint8Array((chunk.byteLength + 7) & ~7);
                padded.fill(0xFF);
                padded.set(chunk);
                chunk = padded;
            }
            // a 256-byte chunk is ~140ms of 19200-baud wire time and the
            // FC forwards the ack only after the whole set-address /
            // set-buffer / program sequence, so the caller's timeout (the
            // UI passes 200ms) cannot cover it; retrying early just queues
            // duplicate transfers behind the one still running
            await this.write(mcu.toWireAddress(off), chunk, Math.max(timeout, 3000));

            escStore.bytesWritten += chunkEnd - off;
        }
    }

    async writeSettings (target: number, esc: McuInfo) {
        const flash = await this.initFlash(target);

        if (flash) {
            const newSettingsArray = objectToSettingsArray(esc.settings, esc.settings.LAYOUT_REVISION as number);
            if (newSettingsArray.length !== esc.settingsBuffer.length) {
                throw new Error('settings length mismatch');
            }

            if (compare(newSettingsArray, esc.settingsBuffer)) {
                this.logWarning('No changed settings found for ESC #' + (target + 1));
            } else {
                const info = Flash.getInfo(flash!);
                const mcu = new Mcu(info.meta.signature);
                // attach the McuInfo from the previous getInfo() so v3 devinfo
                // (address_shift / eeprom_start) drives the wire address
                mcu.setInfo(esc);

                let readbackSettings = null;
                const eepromWireAddr = mcu.getEepromWireAddress();

                await this.write(eepromWireAddr, newSettingsArray, 1500);
                readbackSettings = (await this.readAddress(eepromWireAddr, Mcu.LAYOUT_SIZE, 10, 1500));

                if (readbackSettings) {
                    /*
                    if (!compare(newSettingsArray, readbackSettings.params)) {
                        throw new Error('SettingsVerificationError(newSettingsArray, readbackSettings)');
                    }
                    */

                    this.log('Successfully wrote settings to ESC #' + (target + 1));
                }
            }

            return newSettingsArray;
        }

        throw new Error('EscInitError');
    }

    async writeHex (target: number, esc: McuInfo, hex: string, timeout: number) {
        const escStore = useEscStore();
        const parsed = Flash.parseHex(hex);
        if (parsed) {
            const initFlash = await this.initFlash(target, 3);
            const info = Flash.getInfo(initFlash!);
            const mcu = new Mcu(info.meta.signature);
            // re-use the McuInfo from the previous getInfo() so v3 devinfo
            // (address_shift, firmware_start, eeprom_start, ...) is honoured
            // by the wire-address helpers below.
            mcu.setInfo(esc);
            const endAddress = parsed.data[parsed.data.length - 1].address + parsed.data[parsed.data.length - 1].bytes;
            const flash = Flash.fillImage(parsed, endAddress - mcu.getFlashOffset(), mcu.getFlashOffset());
            if (flash) {
                const eepromWireAddr = mcu.getEepromWireAddress();
                const firmwareStartByte = mcu.getFirmwareStartByte();
                const endByte = flash.byteLength;

                escStore.totalBytes = endByte - firmwareStartByte;
                escStore.bytesWritten = 0;
                escStore.step = 'Writing';

                const message = await this.readAddress(eepromWireAddr, Mcu.LAYOUT_SIZE, 10, 1500);
                if (message) {
                    const originalSettings = message.params;

                    // boot bit: clear before flashing, set after success
                    originalSettings[0] = 0x00;
                    await this.write(eepromWireAddr, originalSettings, Math.max(timeout, 1500));

                    await this.writePages(firmwareStartByte, endByte, flash, timeout, mcu);

                    originalSettings[0] = 0x01;
                    await this.write(eepromWireAddr, originalSettings, Math.max(timeout, 1500));
                }
            }
        }
    }

    testAlive () {
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_InterfaceTestAlive);
    }
}
