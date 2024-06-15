import { defineStore, acceptHMRUpdate } from 'pinia';
import { WebSerial } from 'webserial-wrapper';
import type { Msp } from '~/src/communication/msp';
import type { FourWay } from '~/src/communication/four_way';

export const useSerialStore = defineStore('serial', () => {
    const hasConnection = ref(false);
    const hasSerial = ref(true);
    const isFourWay = ref(false);
    const isDirectConnect = ref(false);
    const pairedDevices = ref<SerialPort[]>([]);
    const pairedDevicesOptions = computed(() => pairedDevices.value.map(d =>
        ({ id: `${d.getInfo().usbVendorId}:${d.getInfo().usbProductId}`, label: `0x${padStr(d.getInfo().usbVendorId?.toString(16) ?? '', 4, '0')}:0x${padStr(d.getInfo().usbProductId?.toString(16) ?? '', 4, '0')}` }))
    );
    const selectedDevice = ref<{ id: string, label: string }>({
        id: '-1',
        label: 'Select device'
    });
    const deviceHandles = ref<{
        port: SerialPort | null,
        serial: WebSerial,
        reader: ReadableStreamDefaultReader | null,
        writer: WritableStreamDefaultWriter | null,
        msp: Msp | null,
        fourWay: FourWay | null
    }>({
        port: null,
        serial: new WebSerial(),
        reader: null,
        writer: null,
        msp: null,
        fourWay: null
    });

    const mspData = ref<MspData>({} as MspData);

    function addSerialDevices (devices: SerialPort[]) {
        pairedDevices.value = [
            ...devices
        ];
    }

    function selectLastDevice () {
        selectedDevice.value = pairedDevicesOptions.value[pairedDevicesOptions.value.length - 1];
    }

    const refreshReader = () => {
        if (deviceHandles.value.port?.readable) {
            deviceHandles.value.reader = deviceHandles.value.port.readable.getReader();
        } else {
            throw new Error('port or read stream not avaiable');
        }
        return deviceHandles.value.reader;
    };

    function $reset () {
        hasConnection.value = false;
        isFourWay.value = false;
        deviceHandles.value = {
            port: null,
            serial: deviceHandles.value.serial,
            reader: null,
            writer: null,
            msp: null,
            fourWay: null
        };
        mspData.value = {} as MspData;
    }

    return { refreshReader, mspData, isFourWay, isDirectConnect, hasConnection, hasSerial, addSerialDevices, selectLastDevice, pairedDevices, pairedDevicesOptions, selectedDevice, deviceHandles, $reset };
});

export type SerialStore = ReturnType<typeof useSerialStore>

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useSerialStore, import.meta.hot));
}
