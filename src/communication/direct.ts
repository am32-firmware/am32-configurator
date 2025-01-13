import Flash from '../flash';
import Mcu from '../mcu';
import serial from './serial';

export enum DIRECT_COMMANDS {
    cmd_SetAddress = 0xFF,
    cmd_SetBufferSize = 0xFE,
    cmd_WriteFlash = 0x01,
    cmd_ReadFlash = 0x03,
    cmd_SendBuffer,
    cmd_Reset
}

export enum DIRECT_RESPONSES {
    GOOD_ACK = 0x30,
    BAD_ACK = 0xC1,
    BAD_CRC = 0xC2
}

export class Direct {
    static instance: Direct;

    static init (
        log: (s: string) => void,
        logWarning: (s: string) => void,
        logError: (s: string) => void
    ) {
        Direct.instance = new Direct(log, logWarning, logError);
    }

    static getInstance () {
        if (!Direct.instance) {
            useLogStore().logError('Direct instance missing!');
            throw new Error('Direct instance missing!');
        }
        return Direct.instance;
    }

    constructor (
        private readonly log: ((s: string) => void),
        private readonly logError: ((s: string) => void),
        private readonly logWarning: ((s: string) => void)
    ) {
    }

    makeCRC (pBuff: number[]) {
        let CRC_16 = 0;

        for (let i = 0; i < pBuff.length; i++) {
            let xb = pBuff[i];
            for (let j = 0; j < 8; j++) {
                if (((xb & 0x01) ^ (CRC_16 & 0x0001)) !== 0) {
                    CRC_16 = CRC_16 >> 1;
                    CRC_16 = CRC_16 ^ 0xA001;
                } else {
                    CRC_16 = CRC_16 >> 1;
                }
                xb = xb >> 1;
            }
        }
        return CRC_16;
    }

    crc16 (buffer: number[]) {
        let crc = 0xFFFF;
        let odd;

        for (let i = 0; i < buffer.length; i++) {
            crc = crc ^ buffer[i];

            for (let j = 0; j < 8; j++) {
                odd = crc & 0x0001;
                crc = crc >> 1;
                if (odd) {
                    crc = crc ^ 0xA001;
                }
            }
        }

        return crc;
    };

    checkCRC (pBuff: number[]) {
        const lowByte = pBuff[pBuff.length - 2]; // one higher than len in buffer
        const highByte = pBuff[pBuff.length - 1];
        const crcByte = lowByte.toString(16) + highByte.toString(16);

        const crc = this.crc16(pBuff);

        return crc.toString(16) === crcByte;
    }

    async init () {
        const init = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0x0D, 'B'.charCodeAt(0), 'L'.charCodeAt(0), 'H'.charCodeAt(0), 'e'.charCodeAt(0), 'l'.charCodeAt(0), 'i'.charCodeAt(0), 0xF4, 0x7D
        ]);
        const result = await serial.write(init.buffer, 2000);
        if (result) {
            const infoBuffer = result.subarray(init.length);
            const message: FourWayResponse = {
                command: 0x0,
                address: 0x0,
                ack: 0x0,
                checksum: (infoBuffer[6 + 1] << 8) | infoBuffer[7 + 1],
                params: infoBuffer.slice(4, 4 + 4)
            };
            const info = Flash.getInfo(message);
            info.meta.input = infoBuffer[3];
            info.meta.signature = (infoBuffer[4] << 8) | infoBuffer[5];

            const mcu = new Mcu(info.meta.signature);
            mcu.setInfo(info);

            const eepromOffset = mcu.getEepromOffset();

            try {
                const fileNameAddress = await this.writeCommand(DIRECT_COMMANDS.cmd_SetAddress, eepromOffset - 32);
                if (fileNameAddress?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
                    await delay(200);

                    const fileNameRead = await this.writeCommand(DIRECT_COMMANDS.cmd_ReadFlash, 0, new Uint8Array([32]));

                    const fileName = new TextDecoder().decode(fileNameRead!.slice(0, fileNameRead?.indexOf(0x0)));

                    if (/[A-Z0-9_]+/.test(fileName)) {
                        info.meta.am32.fileName = fileName;
                        info.meta.am32.mcuType = fileName.slice(fileName.lastIndexOf('_') + 1);
                    }

                    if (info.meta.input) {
                        info.bootloader.input = info.meta.input;
                        info.bootloader.valid = false;
                    }

                    info.layoutSize = Mcu.LAYOUT_SIZE;

                    const settingsArray = await this.readChunked(eepromOffset, info.layoutSize);
                    info.settings = bufferToSettings(settingsArray!);
                    info.settingsBuffer = settingsArray!;

                    for (const [key, value] of Object.entries(Mcu.BOOT_LOADER_PINS)) {
                        if (value === info.bootloader.input) {
                            info.bootloader.valid = true;
                            info.bootloader.pin = key;
                            info.bootloader.version = info.settings.BOOT_LOADER_REVISION as number ?? 0;
                        }
                    }

                    return info;
                }
            } catch (e: any) {
                console.error(e);
                throw new Error(e.message);
            }
        }
    }

    writeCommand (command: DIRECT_COMMANDS, address: number, payload?: Uint8Array) {
        let buffer: number[] = [command];

        switch (command) {
        case DIRECT_COMMANDS.cmd_SetAddress:
            buffer.push(0x00);
            buffer.push((address >> 8) & 0xFF);
            buffer.push(address & 0xFF);
            break;
        case DIRECT_COMMANDS.cmd_ReadFlash:
            if (!payload) {
                throw new Error('no payload');
            }
            buffer.push(payload[0]);
            break;
        case DIRECT_COMMANDS.cmd_WriteFlash:
            buffer.push(0x01);
            break;
        case DIRECT_COMMANDS.cmd_SetBufferSize: {
            const size = payload![0];
            buffer.push(0x00);
            buffer.push(0x00);
            buffer.push(size === 256 ? 0 : size);
        } break;
        case DIRECT_COMMANDS.cmd_SendBuffer:
            buffer = Array.from(payload!);
            break;
        case DIRECT_COMMANDS.cmd_Reset:
            return serial.write(new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer).then(() => delay(5000));
        default:
            break;
        }
        const crc = this.makeCRC(buffer);
        buffer.push(crc & 0xFF);
        buffer.push(crc >> 8 & 0xFF);
        return serial.write(new Uint8Array(buffer).buffer).then(result => result?.subarray(buffer.length));
    }

    async readChunked (address: number, expected: number, chunkSize = 64) {
        let response: Uint8Array = new Uint8Array();
        let eeprom = await this.writeCommand(DIRECT_COMMANDS.cmd_SetAddress, address);
        if (eeprom?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
            if (expected > chunkSize) {
                let currentLayoutSize = 0;
                while (currentLayoutSize < chunkSize) {
                    const clampedLayoutSize = Math.min(chunkSize, chunkSize - currentLayoutSize);
                    const settingsPart = await this.writeCommand(DIRECT_COMMANDS.cmd_ReadFlash, 0, new Uint8Array([clampedLayoutSize]));

                    if (!settingsPart) {
                        this.logError('Failed to read settings part');
                        throw new Error('Failed to read settings part');
                    }
                    response = mergeUint8Arrays(response, settingsPart);

                    currentLayoutSize += chunkSize;

                    eeprom = await this.writeCommand(DIRECT_COMMANDS.cmd_SetAddress, address + currentLayoutSize);
                    if (eeprom?.at(0) !== DIRECT_RESPONSES.GOOD_ACK) {
                        this.logError('Failed to set address');
                        throw new Error('Failed to set address');
                    }
                    await delay(200);
                }
            } else {
                const tmp = await this.writeCommand(DIRECT_COMMANDS.cmd_ReadFlash, 0, new Uint8Array([expected]));
                response = new Uint8Array(tmp?.buffer as ArrayBuffer ?? new ArrayBuffer(0));
            }
        }
        return response;
    }

    async writeChunked (address: number, payload: Uint8Array, chunkSize = 64) {
        const setAddress = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetAddress, address);
        await delay(200);
        if (setAddress?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
            if (payload.length > chunkSize) {
                let currentLayoutSize = 0;
                while (currentLayoutSize < chunkSize) {
                    const clampedLayoutSize = Math.min(chunkSize, chunkSize - currentLayoutSize);
                    await this.writeCommand(DIRECT_COMMANDS.cmd_SetBufferSize, 0, new Uint8Array([clampedLayoutSize]));
                    const sendBuffer = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SendBuffer, 0, payload.subarray(currentLayoutSize, clampedLayoutSize));
                    if (sendBuffer?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
                        await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_WriteFlash, 0);
                    } else {
                        this.logError('Failed to send buffer');
                        throw new Error('Failed to send buffer');
                    }
                    currentLayoutSize += chunkSize;
                }
            } else {
                await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetBufferSize, 0, new Uint8Array([payload.length]));
                const sendBuffer = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SendBuffer, 0, payload);
                if (sendBuffer?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
                    await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_WriteFlash, 0);
                }
            }
        }
    }

    async writeBufferToAddress (address: number, payload: Uint8Array, retries = 10) {
        let currentTry = 0;
        while (true) {
            const setAddress = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetAddress, address);
            if (setAddress?.at(0) !== DIRECT_RESPONSES.GOOD_ACK) {
                if (currentTry++ === retries) {
                    throw new Error('setAddress failed');
                }
            } else {
                break;
            }
        }
        currentTry = 0;
        await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetBufferSize, 0, new Uint8Array([payload.length]));
        while (true) {
            const sendBuffer = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SendBuffer, 0, payload);
            if (sendBuffer?.at(0) !== DIRECT_RESPONSES.GOOD_ACK) {
                if (currentTry++ === retries) {
                    throw new Error('sendBuffer failed');
                }
            } else {
                break;
            }
        }
        currentTry = 0;
        while (true) {
            const writeFlash = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_WriteFlash, 0);
            if (writeFlash?.at(0) !== DIRECT_RESPONSES.GOOD_ACK) {
                if (currentTry++ === retries) {
                    throw new Error('writeFlash failed');
                }
            } else {
                break;
            }
        }
    }

    flashHex (hex: Hex) {
        console.log(hex);
    }
}
