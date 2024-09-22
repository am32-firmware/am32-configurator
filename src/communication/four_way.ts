import Flash from '../flash';
import Mcu, { type McuInfo } from '../mcu';
import asciiToBuffer from '~/utils/ascii-to-buffer';
import CommandQueue from '~/src/communication/commands.queue';
import Serial from '~/src/communication/serial';

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

        const eepromOffset = mcu.getEepromOffset();

        try {
            const fileNameRead = await this.readAddress(eepromOffset - 32, 32);
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

            const settingsArray = (await this.readAddress(eepromOffset, mcu.getInfo().layoutSize))!.params;
            mcu.getInfo().settings = bufferToSettings(settingsArray);
            mcu.getInfo().settingsBuffer = settingsArray;

            for (const [key, value] of Object.entries(Mcu.BOOT_LOADER_PINS)) {
                if (value === mcu.getInfo().bootloader.input) {
                    mcu.getInfo().bootloader.valid = true;
                    mcu.getInfo().bootloader.pin = key;
                    mcu.getInfo().bootloader.version = info.settings.BOOT_LOADER_REVISION as number ?? 0;
                    if (mcu.getInfo().bootloader.version === 0xFF) {
                        logStore.logWarning('Bootloader version unset, setting to 1');
                        info.settings.BOOT_LOADER_REVISION = 1;
                        await this.writeSettings(target, mcu.getInfo());
                        mcu.getInfo().bootloader.version = 1;
                    }
                }
            }
        } catch (e: any) {
            console.error(e);
            throw new Error(e.message);
        }

        return info;
    }

    readAddress (address: number, bytes: number, retries = 10, timeout = 200) {
        return this.sendWithPromise(
            FOUR_WAY_COMMANDS.cmd_DeviceRead,
            [bytes === 256 ? 0 : bytes],
            address,
            retries,
            timeout
        );
    }

    async read (): Promise<void> {
        try {
            const readerData: ReadableStreamReadResult<Uint8Array> = await Serial.read<Uint8Array>();
            if (readerData.value) {
                this.parseMessage(readerData.value);
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

    sendWithPromise (command: FOUR_WAY_COMMANDS, params: number[] = [0], address = 0, retries = 10, timeout = 200): Promise<FourWayResponse | null> {
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
                        if (response.data.ack === FOUR_WAY_ACK.ACK_OK) {
                            resolve(response.data);
                            break;
                        }
                        this.logError(`  error: ${enumToString(response.data.ack, FOUR_WAY_ACK)}`);
                    } catch (e) {
                        console.error(e);
                    }
                }
                await delay(250);
            }

            if (currentTry > retries) {
                reject(new Error('max retries reached'));
                this.logError('max retries reached');
            }
        };
        return new Promise(callback) as Promise<FourWayResponse | null>;
    }

    parseMessage (buffer: ArrayBuffer) {
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
   * Write data to multiple pages up to (but not including) end page
   *
   * @param {number} begin
   * @param {number} end
   * @param {number} pageSize
   * @param {Uint8Array} data
   */
    async writePages (begin: number, end: number, pageSize: number, data: Uint8Array, timeout: number) {
        const beginAddress = begin * pageSize;
        const endAddress = end * pageSize;
        const step = 0x100;
        const escStore = useEscStore();

        for (let address = beginAddress; address < endAddress && address < data.length; address += step) {
            await this.write(
                address,
                data.subarray(address, Math.min(address + step, data.length)),
                timeout
            );

            escStore.bytesWritten += step;
        }
    }

    async writeSettings (target: number, esc: McuInfo) {
        const flash = await this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_DeviceInitFlash, [target]);

        if (flash) {
            const newSettingsArray = objectToSettingsArray(esc.settings);
            if (newSettingsArray.length !== esc.settingsBuffer.length) {
                throw new Error('settings length mismatch');
            }

            if (compare(newSettingsArray, esc.settingsBuffer)) {
                this.logWarning('No changed settings found for ESC #' + (target + 1));
            } else {
                const info = Flash.getInfo(flash!);
                const mcu = new Mcu(info.meta.signature);

                let readbackSettings = null;

                await this.write(mcu.getEepromOffset(), newSettingsArray);
                readbackSettings = (await this.readAddress(mcu.getEepromOffset(), Mcu.LAYOUT_SIZE));

                if (readbackSettings) {
                    if (!compare(newSettingsArray, readbackSettings.params)) {
                        throw new Error('SettingsVerificationError(newSettingsArray, readbackSettings)');
                    }

                    this.log('Successful wrote settings to ESC #' + (target + 1));
                }
            }

            return newSettingsArray;
        }

        throw new Error('EscInitError');
    }

    async writeHex (target: number, hex: string, timeout: number) { // }, force: boolean, migrate: boolean) {
        const escStore = useEscStore();
        const parsed = Flash.parseHex(hex);
        if (parsed) {
            const initFlash = await this.initFlash(target, 3);
            const info = Flash.getInfo(initFlash!);
            const mcu = new Mcu(info.meta.signature);
            const endAddress = parsed.data[parsed.data.length - 1].address + parsed.data[parsed.data.length - 1].bytes;
            const flash = Flash.fillImage(parsed, endAddress - mcu.getFlashOffset(), mcu.getFlashOffset());
            if (flash) {
                const eepromOffset = mcu.getEepromOffset();
                const pageSize = mcu.getPageSize();
                const firmwareStart = mcu.getFirmwareStart();

                escStore.totalBytes = flash.byteLength - firmwareStart;
                escStore.bytesWritten = 0;
                escStore.step = 'Writing';

                const message = await this.readAddress(mcu.getEepromOffset(), Mcu.LAYOUT_SIZE);
                if (message) {
                    const originalSettings = message.params;

                    originalSettings[0] = 0x00;
                    originalSettings.fill(0x00, 3, 5);
                    originalSettings.set(asciiToBuffer('FLASH FAIL  '), 5);

                    await this.write(eepromOffset, originalSettings, timeout);

                    await this.writePages(0x04, 0x40, pageSize, flash, timeout);
                    /* try {
                        escStore.step = 'Verifing';
                        await delay(200);
                        // await this.verifyPages(0x04, 0x40, pageSize, flash);
                    } catch (error) {
                        try {
                            escStore.step = 'Verifing';
                            await delay(200);
                            await this.verifyPages(0x04, 0x40, pageSize, flash);
                        } catch (error) {
                            this.logError('flashingVerificationFailed');
                        }
                    } */

                    originalSettings[0] = 0x01;
                    originalSettings.fill(0x00, 3, 5);
                    originalSettings.set(asciiToBuffer('NOT READY   '), 5);

                    await this.write(eepromOffset, originalSettings);
                }
            }
        }
    }

    /**
   * Verify multiple pages up to (but not including) end page
   *
   * @param {number} begin
   * @param {number} end
   * @param {number} pageSize
   * @param {Uint8Array} data
   */
    async verifyPages (begin: number, end: number, pageSize: number, data: Uint8Array) {
        const beginAddress = begin * pageSize;
        const endAddress = end * pageSize;
        const step = 0x80;

        const escStore = useEscStore();

        for (let address = beginAddress; address < endAddress && address < data.length; address += step) {
            const message = await this.readAddress(address, Math.min(step, data.length - address), 10, 100);
            if (message) {
                const reference = data.subarray(message.address, message.address + message.params.byteLength);

                if (!compare(message.params, reference)) {
                    console.debug('Verification failed - retry');
                    this.logError(`failed to verify write at address 0x${message.address.toString(0x10)}`);
                    throw new Error(`failed to verify write at address 0x${message.address.toString(0x10)}`);
                } else {
                    escStore.bytesWritten += step;
                }
            }
        }
    }

    testAlive () {
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_InterfaceTestAlive);
    }
}
