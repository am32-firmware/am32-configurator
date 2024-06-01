import Queue from 'queue';
import { useEscStore } from './../../stores/esc';
import { useLogStore } from './../../stores/log';
import { MSP_COMMANDS } from './msp';
import { FOUR_WAY_COMMANDS } from './four_way';

export interface QueueCommand {
    commandName: MSP_COMMANDS | FOUR_WAY_COMMANDS,
    data: DataView | FourWayResponse
}

class CommandQueue {
    queue = new Queue({
        autostart: true,
        concurrency: 1,
        results: [] as QueueCommand[]
    });

    callbackQueue: {
        [key: string]: [PromiseFn, number]
    } = {};

    constructor () {
        this.queue.addEventListener('success', (success) => {
            const serialStore = useSerialStore();
            for (const result of success.detail.result as QueueCommand[]) {
                const command = result.commandName;
                const data = result.data;

                const e = serialStore.isFourWay ? FOUR_WAY_COMMANDS : MSP_COMMANDS;

                if (this.callbackQueue[enumToString(command, e)]) {
                    this.callbackQueue[enumToString(command, e)][0](data);
                    delete this.callbackQueue[enumToString(command, e)];
                } else if (!serialStore.isFourWay && data instanceof DataView) {
                    this.processMspResponse(command as MSP_COMMANDS, data);
                } else {
                    this.processFourWayResponse(command as FOUR_WAY_COMMANDS, data as FourWayResponse);
                }
            }
        });
    }

    processFourWayResponse (command: FOUR_WAY_COMMANDS, data: FourWayResponse) {
        console.log(command, data);
    }

    processMspResponse (command: MSP_COMMANDS, data: DataView) {
        const serialStore = useSerialStore();
        const logStore = useLogStore();
        const escStore = useEscStore();

        let offset = 0;
        const fcType = new TextDecoder().decode(data.buffer);

        switch (command) {
        case MSP_COMMANDS.MSP_API_VERSION:
            serialStore.mspData.protocol_version = data.getUint8(offset++);
            serialStore.mspData.api_version = `${data.getUint8(offset++)}.`;
            serialStore.mspData.api_version += `${data.getUint8(offset++)}.0`;

            logStore.log(`Got msp data, API_VERSION: ${serialStore.mspData.api_version}`);
            break;
        case MSP_COMMANDS.MSP_FC_VARIANT:
            switch (fcType) {
            case 'BTFL':
                serialStore.mspData.type = 'bf';
                break;
            case 'KISS':
                serialStore.mspData.type = 'kiss';
                break;
            case 'INAV':
                serialStore.mspData.type = 'inav';
                break;
            default:
                serialStore.mspData.type = null;
                logStore.logError(`Unknown fc type '${fcType}'`);
                break;
            }

            logStore.log(`Got msp data, TYPE: ${serialStore.mspData.type}`);
            break;
        case MSP_COMMANDS.MSP_BATTERY_STATE:
            serialStore.mspData.batteryData = {
                cellCount: data.getUint8(0),
                capacity: data.getUint16(1, true), // mAh
                voltage: data.getUint8(3) / 10.0, // V
                drawn: data.getUint16(4, true), // mAh
                amps: data.getUint16(6, true) / 100 // A
            };
            logStore.log(`Got msp data, BATTERY VOLTAGE: ${serialStore.mspData.batteryData.voltage}`);
            break;
        case MSP_COMMANDS.MSP_SET_PASSTHROUGH:
            serialStore.isFourWay = true;
            escStore.count = data.getUint8(0);

            logStore.log(`Init 4way, ESC COUNT: ${escStore.count}`);
            break;
        case MSP_COMMANDS.MSP_MOTOR:
            serialStore.mspData.motorCount = 0;
            for (let i = 0; i < data.buffer.byteLength; ++i) {
                if (data.getUint8(i) > 0) {
                    serialStore.mspData.motorCount++;
                }
            }

            logStore.log(`Got msp data, MOTOR COUNT: ${serialStore.mspData.motorCount}`);
            break;
        case MSP_COMMANDS.MSP_MOTOR_CONFIG:
            serialStore.mspData.motorCount = data.getUint8(6);

            logStore.log(`Got msp data, MOTOR COUNT: ${serialStore.mspData.motorCount}`);
            break;
        default:
            break;
        }
    }

    addCommandWithCallback (command: QueueCommand, callback: PromiseFn) {
        this.addCallback(command.commandName, callback);
        this.addCommand(command);
    }

    addCommand (command: QueueCommand) {
        this.queue.push((cb) => {
            if (cb) {
                cb(undefined, command);
            }
        });
    }

    addCallback (command: MSP_COMMANDS | FOUR_WAY_COMMANDS, callback: PromiseFn, retries = 0) {
        const e = useSerialStore().isFourWay ? FOUR_WAY_COMMANDS : MSP_COMMANDS;
        this.callbackQueue[enumToString(command, e)] = [callback, retries];
    }
}

export default new CommandQueue();
