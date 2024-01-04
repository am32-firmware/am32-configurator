<template>
    <div>
        <div class="p-4 grid grid-cols-1 gap-2">
            <div>
                <USelectMenu v-model="serialStore.selectedDevice" :disabled="serialStore.hasConnection" :options="serialStore.pairedDevicesOptions" placeholder="Select device"></USelectMenu>
            </div>
            <div class="flex justify-between gap-2">
                <UButton @click="requestSerialDevices" size="2xs">Port select</UButton>
                <UButton v-if="!serialStore.hasConnection" :disabled="!serialStore.selectedDevice" size="2xs" @click="connectToDevice">Connect</UButton>
                <UButton v-else size="2xs" @click="disconnectFromDevice" color="red">Disconnect</UButton>
            </div>
            <div class="flex gap-2 pt-2">
                <UIcon name="i-fluent-serial-port-16-filled" dynamic :class="[serialStore.hasConnection ? 'text-green-500' : 'text-red-500']"></UIcon>
                <UIcon name="i-ion-hardware-chip-sharp" dynamic :class="serialStore.mspData.api_version ? 'text-green-500' : 'text-red-500'"></UIcon>
                <UChip text="1" size="2xl" :color="escStore.count > 0 ? 'green' : 'red'">
                    <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 0 ? 'text-green-500' : 'text-red-500'"></UIcon>
                </UChip>
                <UChip text="2" size="2xl" :color="escStore.count > 1 ? 'green' : 'red'">
                    <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 1 ? 'text-green-500' : 'text-red-500'"></UIcon>
                </UChip>
                <UChip text="3" size="2xl" :color="escStore.count > 2 ? 'green' : 'red'">
                    <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 2 ? 'text-green-500' : 'text-red-500'"></UIcon>
                </UChip>
                <UChip text="4" size="2xl" :color="escStore.count > 3 ? 'green' : 'red'">
                    <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 3 ? 'text-green-500' : 'text-red-500'"></UIcon>
                </UChip>
            </div>
            <div v-if="serialStore.mspData.type" class="flex gap-1">
                <UKbd>
                    {{ serialStore.mspData.type }}
                </UKbd>
                <UKbd>
                    Api: {{ serialStore.mspData.api_version }}
                </UKbd>
                <UKbd v-if="serialStore.isFourWay">
                    4way
                </UKbd>
                <UKbd>
                    {{ serialStore.mspData.batteryData?.voltage }} V
                </UKbd>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { MSP_COMMANDS, Msp } from '~/src/communication/msp';

const serialStore = useSerialStore()
const escStore = useEscStore();
const logStore = useLogStore();
const usbVendorId = 0x0483;

const requestSerialDevices = async () => {
    await navigator.serial.requestPort({
        filters: [{ usbVendorId }]
    })
    await fetchPairedDevices();
}

const fetchPairedDevices = async () => {
    const pairedDevices: SerialPort[] = await navigator.serial.getPorts();
    serialStore.addSerialDevices(pairedDevices);

    if (pairedDevices.length > 0) {
        serialStore.selectLastDevice();
    }

    logStore.log(`got ${pairedDevices.length} device(s)`);
}

fetchPairedDevices();

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
            logStore.addLogEntry('Serial port not found', 'error');
        } else {
            await serialStore.deviceHandles.port.open({
                baudRate: 115200
            })
            serialStore.hasConnection = true;
            if (serialStore.deviceHandles.port.readable && serialStore.deviceHandles.port.writable) {
                serialStore.deviceHandles.reader = await serialStore.deviceHandles.port.readable.getReader();
                serialStore.deviceHandles.writer = await serialStore.deviceHandles.port.writable.getWriter();
                serialStore.deviceHandles.msp = new Msp(serialStore.deviceHandles.reader, serialStore.deviceHandles.writer, logStore.log, logStore.logError);

                useIntervalFn(() => {
                    serialStore.deviceHandles.msp?.read();
                }, 100);

                logStore.addLogEntry('Connected to device');

                await serialStore.deviceHandles.msp.send(MSP_COMMANDS.MSP_API_VERSION);
                await serialStore.deviceHandles.msp.send(MSP_COMMANDS.MSP_FC_VARIANT);
                await serialStore.deviceHandles.msp.send(MSP_COMMANDS.MSP_BATTERY_STATE);
                await serialStore.deviceHandles.msp.send(MSP_COMMANDS.MSP_MOTOR_CONFIG);
                //await serialStore.deviceHandles.msp.send(MSP_COMMANDS.MSP_SET_PASSTHROUGH);
                
                
            } else {
                logStore.addLogEntry('Something went wrong!', 'error');
            }
        }
    }
}

const disconnectFromDevice = async () => {
    if (serialStore.hasConnection && serialStore.deviceHandles.port) {
        serialStore.deviceHandles.reader?.releaseLock();
        serialStore.deviceHandles.writer?.releaseLock();
        await serialStore.deviceHandles.port.close();
        
        serialStore.deviceHandles.port = null;
        serialStore.deviceHandles.reader = null;
        serialStore.deviceHandles.writer = null;

        serialStore.hasConnection = false;

        logStore.addLogEntry('Connection to device closed');
    }
}
</script>