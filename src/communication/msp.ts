import { MSP_COMMANDS, MspClient, crc8DvbS2Data, encodeMspV1, encodeMspV2, parseMspResponse } from '@am32/serial-msp';
import { useLogStore } from './../../stores/log';
import Serial from '~/src/communication/serial';

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

    private readonly client: MspClient;

    constructor (
        private log: (s: string) => void,
        private logWarning: (s: string) => void,
        private logError: (s: string) => void
    ) {
        this.client = new MspClient({
            write: (buffer, timeout) => Serial.write(buffer, timeout),
            read: <T = Uint8Array>() => Serial.read<T>(),
            canRead: () => Serial.canRead()
        }, {
            log,
            logWarning,
            logError
        });
    }

    get commandCount () {
        return this.client.commandCount;
    }

    set commandCount (value: number) {
        this.client.commandCount = value;
    }

    /**
   * Calculate the DVB-S2 checksum for a chunk of data
   *
   * @param {Uint8Array} data
   * @param {number} start
   * @param {number} end
   * @returns {number}
   */
    crc8DvbS2Data (data: Uint8Array, start: number, end: number) {
        return crc8DvbS2Data(data, start, end);
    }

    /**
   * Encode a MSP V1 command
   *
   * @param {number} command
   * @param {Uint8Array} data
   * @returns {ArrayBuffer}
   */
    encodeV1 (command: MSP_COMMANDS, data: Uint8Array) {
        return encodeMspV1(command, data);
    }

    /**
   * Encode a MSP V2 command
   *
   * @param {number} command
   * @param {Uint8Array} data
   * @returns {ArrayBuffer}
   */
    encodeV2 (command: MSP_COMMANDS, data: Uint8Array) {
        return encodeMspV2(command, data);
    }

    send (command: MSP_COMMANDS, data?: Uint8Array) {
        return this.client.send(command, data);
    }

    sendWithPromise (command: MSP_COMMANDS, data?: Uint8Array) {
        return this.client.sendWithPromise(command, data);
    }

    read (): Promise<void> {
        return this.client.read();
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
        const parsed = parseMspResponse(data);
        if (parsed) {
            this.client.commandCount--;
            return parsed;
        }
    }
}

export { MSP_COMMANDS };
export default Msp;
