<template>
    <div>
        <div class="p-4 grid grid-cols-1 gap-2">
            <div>
                <USelectMenu v-model="serialStore.selectedDevice" :disabled="serialStore.hasConnection" :options="serialStore.pairedDevicesOptions" placeholder="Select device"></USelectMenu>
            </div>
            <div class="flex justify-between gap-2">
                <UButton @click="requestSerialDevices" size="2xs">Port select</UButton>
                <UButton v-if="!serialStore.hasConnection" :disabled="serialStore.selectedDevice.id === '-1'" size="2xs" @click="connectToDevice">Connect</UButton>
                <UButton v-else size="2xs" @click="disconnectFromDevice" color="red">Disconnect</UButton>
            </div>
            <div class="flex gap-4 pt-2">
                <div class="flex gap-2 items-center">
                    <UIcon name="i-fluent-serial-port-16-filled" dynamic :class="[serialStore.hasConnection ? 'text-green-500' : 'text-red-500']"></UIcon>
                    <UIcon name="i-ion-hardware-chip-sharp" dynamic :class="serialStore.hasConnection && serialStore.mspData.api_version ? 'text-green-500' : 'text-red-500'"></UIcon>
                </div>
                <div v-if="serialStore.hasConnection && serialStore.mspData.motorCount > 0" class="flex gap-2">
                    <UChip v-if="serialStore.mspData.motorCount > 0" text="1" size="2xl" :color="escStore.count > 0 ? 'green' : 'yellow'">
                        <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 0 ? 'text-green-500' : 'text-yellow-500'"></UIcon>
                    </UChip>
                    <UChip v-if="serialStore.mspData.motorCount > 1" text="2" size="2xl" :color="escStore.count > 1 ? 'green' : 'yellow'">
                        <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 1 ? 'text-green-500' : 'text-yellow-500'"></UIcon>
                    </UChip>
                    <UChip v-if="serialStore.mspData.motorCount > 2" text="3" size="2xl" :color="escStore.count > 2 ? 'green' : 'yellow'">
                        <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 2 ? 'text-green-500' : 'text-yellow-500'"></UIcon>
                    </UChip>
                    <UChip v-if="serialStore.mspData.motorCount > 3" text="4" size="2xl" :color="escStore.count > 3 ? 'green' : 'yellow'">
                        <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 3 ? 'text-green-500' : 'text-yellow-500'"></UIcon>
                    </UChip>
                    <UButton size="xs" class="ml-2" @click="connectToEsc">
                        <UIcon name="i-material-symbols-bigtop-updates" dynamic></UIcon>
                    </UButton>
                </div>
            </div>
            <div v-if="serialStore.hasConnection && serialStore.mspData.type" class="flex gap-1">
                <UKbd>
                    {{ serialStore.mspData.type }}
                </UKbd>
                <UKbd>
                    Api: {{ serialStore.mspData.api_version }}
                </UKbd>
                <UKbd v-if="serialStore.isFourWay">
                    4way
                </UKbd>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import commandsQueue from '~/src/communication/commands.queue';
import { FOUR_WAY_COMMANDS, FourWay } from '~/src/communication/four_way';
import Msp, { MSP_COMMANDS } from '~/src/communication/msp';
import serial from '~/src/communication/serial';
import Serial from '~/src/communication/serial'

const serialStore = useSerialStore()
const escStore = useEscStore();
const { log, logWarning, logError } = useLogStore();
const usbVendorIds = [ 0x0483, 0x2e3c ];

const requestSerialDevices = async () => {
    await navigator.serial.requestPort({
        filters: usbVendorIds.map(id => ({ usbVendorId: id }))
    })
    await fetchPairedDevices();
}

const fetchPairedDevices = async () => {
    const pairedDevices: SerialPort[] = await navigator.serial.getPorts();
    serialStore.addSerialDevices(pairedDevices);

    if (pairedDevices.length > 0) {
        serialStore.selectLastDevice();
    } else {
        if (serialStore.hasConnection) {
            serialStore.$reset();
        }
        serialStore.selectedDevice = {
            id: '-1',
            label: 'Select device'
        };
    }
}

fetchPairedDevices();

useIntervalFn(() => {
    fetchPairedDevices();
}, 500);

const connectToDevice = async () => {
    const portTmp: string[] | undefined = serialStore.selectedDevice?.id.split(':');
    if (portTmp) {
        const ports = await navigator.serial.getPorts()
        for(let p of ports) {
            if (p.getInfo().usbVendorId === +portTmp[0] && p.getInfo().usbProductId === +portTmp[1]) {
                serialStore.deviceHandles.port = p;
                break;
            }
        }
        if (!serialStore.deviceHandles.port) {
            logError('Serial port not found');
        } else {
            if (!serialStore.deviceHandles.port.readable) {
                await serialStore.deviceHandles.port.open({
                    baudRate: 115200
                });
            }
            if (serialStore.deviceHandles.port.readable && serialStore.deviceHandles.port.writable) {
                if (!serialStore.deviceHandles.reader) {
                    serialStore.deviceHandles.reader = await serialStore.deviceHandles.port.readable.getReader();
                }
                if (!serialStore.deviceHandles.writer) {
                    serialStore.deviceHandles.writer = await serialStore.deviceHandles.port.writable.getWriter();
                }
                Serial.init(log, logError, logWarning, serialStore.deviceHandles.reader, serialStore.deviceHandles.writer);

                log('Connected to device');

                let result = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_API_VERSION).catch(async (err) => {
                    logError(`${err.message}, trying to exit fourway and try again.`);
                    serialStore.isFourWay = true;
                    await FourWay.getInstance().sendWithPromise(FOUR_WAY_COMMANDS.cmd_InterfaceExit);
                    await delay(1000);
                    serialStore.isFourWay = false;
                    return Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_API_VERSION).catch(() => {
                        logError('Not in four way mode? Cant automatically resolve issue! Restart and replug device and try again.');
                        return null;
                    });
                });

                if (result === null) {
                    await disconnectFromDevice();

                    throw new Error('Cant read or write to device!');
                }

                commandsQueue.processMspResponse(result!.commandName, result!.data);
                
                await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_FC_VARIANT).then((result) => {
                    if (result) {
                        commandsQueue.processMspResponse(result!.commandName, result!.data);
                    }
                });
                await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_BATTERY_STATE).then((result) => {
                    if (result) {
                        commandsQueue.processMspResponse(result!.commandName, result!.data);
                    }
                });
                await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_MOTOR_CONFIG).then((result) => {
                    if (result) {
                        commandsQueue.processMspResponse(result!.commandName, result!.data);
                    }
                });

                serialStore.hasConnection = true;
                
            } else {
                logError('Something went wrong!');
            }
        }
    }
}

const connectToEsc = async () => {
    if (!serialStore.isFourWay) {
        const result = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_SET_PASSTHROUGH);

        serialStore.isFourWay = true;

        escStore.count = result?.data.getUint8(0) ?? 0;
    }

    escStore.escData = [];
    escStore.escInfo = [];

    // await FourWay.getInstance().getInfo(0);

    await delay(1000);

    for(let i = 0; i < escStore.count; ++i) {
        const escData = {
            isLoading: true
        } as EscData;
        escStore.escData.push(escData);

        const result = await FourWay.getInstance().getInfo(i);

        escStore.escInfo.push(result);

        escData.isLoading = false;
    }
}

const disconnectFromDevice = async () => {
    if (serialStore.deviceHandles.port) {

        if (serialStore.isFourWay) {
            await FourWay.getInstance().send(FOUR_WAY_COMMANDS.cmd_InterfaceExit);
        }

        Msp.getInstance().commandCount = 0;
        FourWay.getInstance().commandCount = 0;

        Serial.deinit();

        serialStore.deviceHandles.reader?.releaseLock();
        serialStore.deviceHandles.writer?.releaseLock();
        await serialStore.deviceHandles.port.close();
        
        serialStore.$reset();

        escStore.$reset();

        log('Connection to device closed');
    }
}
</script>