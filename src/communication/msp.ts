import { useLogStore } from './../../stores/log';
import Serial from '~/src/communication/serial';

export enum MSP_COMMANDS {
    MSP_API_VERSION = 1,
    MSP_FC_VARIANT = 2,
    MSP_FC_VERSION = 3,
    MSP_BOARD_INFO = 4,
    MSP_BUILD_INFO = 5,

    MSP_FEATURE_CONFIG = 36,
    MSP_MOTOR_3D_CONFIG = 124,

    MSP_BATTERY_STATE = 130,

    MSP_SET_MOTOR = 214,
    MSP_SET_PASSTHROUGH = 245,

    // Multiwii MSP commands
    MSP_IDENT = 100,
    MSP_STATUS = 101,
    MSP_MOTOR = 104,
    MSP_MOTOR_CONFIG = 131,
    MSP_SET_3D = 217,

    // Additional baseflight commands that are not compatible with MultiWii
    MSP_UID = 160, // Unique device ID

    // Betaflight specific
    MSP2_SEND_DSHOT_COMMAND = 0x3003,
};

export class Msp {
    // eslint-disable-next-line no-use-before-define
    static instance: Msp;

    static init (
        log: (s: string) => void,
        logWarning: (s: string) => void,
        logError: (s: string) => void
    ) {
        Msp.instance = new Msp(log, logWarning, logError);
    }

    static getInstance () {
        if (!Msp.instance) {
            useLogStore().logError('Msp instance missing!');
            throw new Error('Msp instance missing!');
        }
        return Msp.instance;
    }

    public commandCount = 0;

    constructor (
        private log: (s: string) => void,
        private logWarning: (s: string) => void,
        private logError: (s: string) => void
    ) {}

    /**
   * Calculate the DVB-S2 checksum for a chunk of data
   *
   * @param {Uint8Array} data
   * @param {number} start
   * @param {number} end
   * @returns {number}
   */
    crc8DvbS2Data (data: Uint8Array, start: number, end: number) {
        let crc = 0;
        for (let i = start; i < end; i += 1) {
            const ch = data[i];
            crc ^= ch;
            for (let i = 0; i < 8; i += 1) {
                if (crc & 0x80) {
                    crc = ((crc << 1) & 0xFF) ^ 0xD5;
                } else {
                    crc = (crc << 1) & 0xFF;
                }
            }
        }

        return crc;
    }

    /**
   * Encode a MSP V1 command
   *
   * @param {number} command
   * @param {Uint8Array} data
   * @returns {ArrayBuffer}
   */
    encodeV1 (command: MSP_COMMANDS, data: Uint8Array) {
    // Always reserve 6 bytes for protocol overhead !
        const size = 6 + data.length;
        const bufferOut = new ArrayBuffer(size);
        const bufView = new Uint8Array(bufferOut);

        bufView[0] = ascii('$'); // 36; // $
        bufView[1] = ascii('M'); // 77; // M
        bufView[2] = ascii('<'); // 60; // <
        bufView[3] = data.length;
        bufView[4] = command;

        if (data.length > 0) {
            let checksum = bufView[3] ^ bufView[4];

            for (let i = 0; i < data.length; i += 1) {
                bufView[i + 5] = data[i];
                checksum ^= bufView[i + 5];
            }

            bufView[5 + data.length] = checksum;
        } else {
            bufView[5] = bufView[3] ^ bufView[4]; // Checksum
        }

        return bufferOut;
    }

    /**
   * Encode a MSP V2 command
   *
   * @param {number} command
   * @param {Uint8Array} data
   * @returns {ArrayBuffer}
   */
    encodeV2 (command: MSP_COMMANDS, data: Uint8Array) {
    // Always reserve 9 bytes for protocol overhead!
        const dataLength = data.length;
        const size = 9 + dataLength;
        const bufferOut = new ArrayBuffer(size);
        const bufView = new Uint8Array(bufferOut);

        bufView[0] = ascii('$');// 36; // $
        bufView[1] = ascii('X'); // 88; // X
        bufView[2] = ascii('<'); // 60; // <
        bufView[3] = 0; // flag
        bufView[4] = command & 0xFF;
        bufView[5] = (command >> 8) & 0xFF;
        bufView[6] = dataLength & 0xFF;
        bufView[7] = (dataLength >> 8) & 0xFF;

        for (let i = 0; i < dataLength; i += 1) {
            bufView[8 + i] = data[i];
        }

        bufView[size - 1] = this.crc8DvbS2Data(bufView, 3, size - 1);

        return bufferOut;
    }

    async send (command: MSP_COMMANDS, data?: Uint8Array) {
        this.log(`Sending ${enumToString(command, MSP_COMMANDS)}...`);
        let bufferOut: ArrayBuffer;

        if (command <= 254) {
            bufferOut = this.encodeV1(command, data ?? new Uint8Array());
        } else {
            bufferOut = this.encodeV2(command, data ?? new Uint8Array());
        }

        try {
            console.log('send');
            return await Serial.write(bufferOut);
        } catch (e: any) {
            this.logError(`MSP command failed: ${e.message}`);
            return null;
        }
    }

    async sendWithPromise (command: MSP_COMMANDS, data?: Uint8Array) {
        const result = await this.send(command, data);
        console.log('result', result);
        if (result) {
            return this.processResponse(result);
        } else {
            throw new Error('sendWithPromise: empty result');
        }
    }

    async read (): Promise<void> {
        if (!Serial.canRead()) {
            return;
        }
        try {
            const readerData: ReadableStreamReadResult<Uint8Array> = await Serial.read<Uint8Array>();
            if (readerData.value) {
                this.processResponse(readerData.value);
            }
        } catch (err) {
            console.error(`error reading data: ${err}`);
        }
    }

    getTypeMotorCommand (type: MspData['type']) {
        switch (type) {
        case 'inav':
            return MSP_COMMANDS.MSP_MOTOR;
        default:
            return MSP_COMMANDS.MSP_MOTOR_CONFIG;
        }
    }

    processResponse (data: Uint8Array) {
        let state = 0;
        let messageBuffer = new ArrayBuffer(0);
        let messageChecksum = 0;
        let messageLengthExpected = 0;
        let messageLengthReceived = 0;
        let command: number | null = null;
        let messageBufferUint8View = new Uint8Array();

        for (const char of data) {
            switch (state) {
            case 0:
                if (char === ascii('$')) {
                    ++state;
                }
                break;
            case 1:
                if (char === ascii('M')) {
                    ++state;
                } else {
                    state = 0;
                }
                break;
            case 2:
                if ([ascii('<'), ascii('>'), ascii('!')].includes(char)) {
                    ++state;
                } else {
                    state = 0;
                    this.logError(`Unknown msp command direction '${char}'`);
                }
                break;
            case 3:
                messageLengthExpected = char;
                messageChecksum = char;

                messageBuffer = new ArrayBuffer(messageLengthExpected);
                messageBufferUint8View = new Uint8Array(messageBuffer);

                ++state;
                break;
            case 4:
                command = char;
                messageChecksum ^= char;

                // Process payload
                if (messageLengthExpected > 0) {
                    state += 1;
                } else {
                    // No payload
                    state += 2;
                }
                break;
            case 5:
                messageBufferUint8View[messageLengthReceived] = char;
                messageChecksum ^= char;
                messageLengthReceived += 1;

                if (messageLengthReceived >= messageLengthExpected) {
                    state += 1;
                }
                break;
            case 6:
                if (messageChecksum === char) {
                    this.commandCount--;
                    return {
                        commandName: command!,
                        data: new DataView(
                            messageBuffer,
                            0
                        )
                    };
                }
                break;
            }
        }
    }
}

export default Msp;
