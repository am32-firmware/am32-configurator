import { MSP_COMMANDS } from './msp';
import Queue from 'queue';

export interface QueueCommand {
    commandName: MSP_COMMANDS,
    data: DataView
}

class CommandQueue {
    queue = new Queue({
        autostart: true,
        concurrency: 1,
        results: [] as [MSP_COMMANDS, DataView][]
    });

    constructor() {
        const logStore = useLogStore();
        const serialStore = useSerialStore();
        const escStore = useEscStore();

        this.queue.addEventListener('success', (success) => {
            for(let result of success.detail.result) {
                const command: MSP_COMMANDS = result.commandName;
                const data: DataView = result.data;

                console.log(command, data);

                switch(command) {
                    case MSP_COMMANDS.MSP_API_VERSION:
                        let offset = 0;
                        serialStore.mspData.protocol_version = data.getUint8(offset++);
                        serialStore.mspData.api_version = `${data.getUint8(offset++)}.`;
                        serialStore.mspData.api_version += `${data.getUint8(offset++)}.0`;

                        logStore.log(`Got msp data, API_VERSION: ${serialStore.mspData.api_version}`);
                        break;
                    case MSP_COMMANDS.MSP_FC_VARIANT:
                        const fc_type = new TextDecoder().decode(data.buffer);
                        switch(fc_type)
                        {
                            case "BTFL":
                                serialStore.mspData.type = 'bf';
                                break;
                            case "KISS":
                                serialStore.mspData.type = 'kiss';
                                break;
                            default:
                                serialStore.mspData.type = null;
                                logStore.logError(`Unknown fc type '${fc_type}'`);
                                break;
                        }

                        logStore.log(`Got msp data, TYPE: ${serialStore.mspData.type}`);
                        break;
                    case MSP_COMMANDS.MSP_BATTERY_STATE:
                        serialStore.mspData.batteryData = {
                            cellCount: data.getUint8(0),
                            capacity: data.getUint16(1, true),     // mAh
                            voltage: data.getUint8(3) / 10.0,   // V
                            drawn: data.getUint16(4, true),        // mAh
                            amps: data.getUint16(6, true) / 100,   // A
                        };
                        logStore.log(`Got msp data, BATTERY VOLTAGE: ${serialStore.mspData.batteryData.voltage}`);
                        break;
                    case MSP_COMMANDS.MSP_SET_PASSTHROUGH:
                        escStore.count = result[1].getUint8(0);

                        logStore.log(`Got 4way data, ESC COUNT: ${escStore.count}`);
                        break;
                    case MSP_COMMANDS.MSP_MOTOR_CONFIG:
                        serialStore.mspData.motorCount = data.getUint8(6);

                        logStore.log(`Got msp data, MOTOR COUNT: ${serialStore.mspData.motorCount}`);
                        break;
                    default:
                        break;
                }
            }
        });
    }

    addCommand(command: QueueCommand) {
        this.queue.push(cb => {
            console.log(command);
            if (cb) {
                cb(undefined, command);
            }
        })
    }
}

export default new CommandQueue();
