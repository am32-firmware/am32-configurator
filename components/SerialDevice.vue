<template>
  <div>
    <div class="p-4 grid grid-cols-1 gap-2">
      <div class="flex flex-column gap-2">
        <USelectMenu v-model="serialStore.selectedDevice" class="flex-grow" :disabled="serialStore.hasConnection" :options="serialStore.pairedDevicesOptions" placeholder="Select device" />
        <USelectMenu
          v-model="baudrate"
          class="flex-grow"
          :disabled="serialStore.selectedDevice.id === '-1' || serialStore.hasConnection || isDirectConnectDevice"
          :options="baudrateOptions"
        />
      </div>
      <div class="flex justify-between gap-2">
        <UButton size="2xs" @click="requestSerialDevices">
          Port select
        </UButton>
        <UButton v-if="!serialStore.hasConnection" :disabled="serialStore.selectedDevice.id === '-1'" size="2xs" @click="connectToDevice">
          Connect
        </UButton>
        <UButton v-else size="2xs" color="red" @click="disconnectFromDevice">
          Disconnect
        </UButton>
      </div>
      <div class="flex gap-4 pt-2">
        <div class="flex gap-2 items-center">
          <UIcon name="i-fluent-serial-port-16-filled" dynamic :class="[serialStore.hasConnection ? 'text-green-500' : 'text-red-500']" />
          <UIcon
            name="i-ion-hardware-chip-sharp"
            dynamic
            :class="{
              'text-green-500': serialStore.hasConnection && serialStore.mspData.api_version,
              'text-red-500': !(serialStore.hasConnection && serialStore.mspData.api_version),
              '!hidden': serialStore.isDirectConnect
            }"
          />
        </div>
        <div v-if="serialStore.hasConnection && (serialStore.mspData.motorCount > 0 || serialStore.isDirectConnect)" class="w-full flex justify-between">
          <div class="flex gap-2">
            <UChip v-if="serialStore.mspData.motorCount > 0 || serialStore.isDirectConnect" text="1" size="2xl" :color="escStore.count > 0 ? 'green' : 'yellow'">
              <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 0 ? 'text-green-500' : 'text-yellow-500'" />
            </UChip>
            <UChip v-if="serialStore.mspData.motorCount > 1" text="2" size="2xl" :color="escStore.count > 1 ? 'green' : 'yellow'">
              <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 1 ? 'text-green-500' : 'text-yellow-500'" />
            </UChip>
            <UChip v-if="serialStore.mspData.motorCount > 2" text="3" size="2xl" :color="escStore.count > 2 ? 'green' : 'yellow'">
              <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 2 ? 'text-green-500' : 'text-yellow-500'" />
            </UChip>
            <UChip v-if="serialStore.mspData.motorCount > 3" text="4" size="2xl" :color="escStore.count > 3 ? 'green' : 'yellow'">
              <UIcon name="i-heroicons-cpu-chip-16-solid" dynamic :class="escStore.count > 3 ? 'text-green-500' : 'text-yellow-500'" />
            </UChip>
          </div>
          <div class="flex gap-2">
            <UButton v-if="!serialStore.isDirectConnect" size="xs" @click="connectToEsc">
              <UIcon name="i-material-symbols-find-in-page-outline" />
            </UButton>
            <UButton color="blue" size="xs" :disabled="!isAnySettingsDirty || escStore.isSaving" :loading="escStore.isSaving" @click="writeConfig">
              <UIcon name="i-material-symbols-save" />
            </UButton>
          </div>
        </div>
      </div>
      <div v-if="false && serialStore.hasConnection && serialStore.mspData.type" class="flex gap-1">
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
      <div v-if="serialStore.hasConnection && escStore.count > 0" class="flex gap-4">
        <UButton label="Flash firmware" size="xs" icon="i-material-symbols-full-stacked-bar-chart" color="teal" @click="flashModalOpen = true" />
        <div>
          <UButton
            label="Save config"
            size="xs"
            icon="i-material-symbols-sim-card-download-outline"
            color="red"
            variant="link"
            @click="saveConfigModalOpen = true"
          />
          <UButton
            label="Apply config"
            size="xs"
            icon="i-material-symbols-upload-file-outline"
            color="violet"
            variant="link"
            @click="applyConfigModalOpen = true"
          />
        </div>
      </div>
      <UModal v-model="flashModalOpen" :prevent-close="escStore.activeTarget > -1">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center justify-center gap-2 text-xl">
                <UIcon name="i-material-symbols-full-stacked-bar-chart" class="h-8 w-8" />
                <div class="text-2xl">
                  Flash Firmware
                </div>
              </div>
            </div>
          </template>

          <div v-if="file_input?.files?.length === 0" class="flex flex-col gap-4">
            <UCheckbox v-model="ignoreMcuLayout" label="Ignore current mcu layout" color="red" />
            <USelectMenu
              v-model="selectedRelease"
              searchable
              searchable-placeholder="Search a release..."
              :options="releasesOptions"
            />
            <USelectMenu
              v-model="selectedAsset"
              searchable
              searchable-placeholder="Search a hex file..."
              :options="assets"
              :disabled="assets.length === 0 || !ignoreMcuLayout"
            />
          </div>
          <div v-else class="text-green-500 text-center">
            Flashing local '{{ file_input?.files?.[0].name ?? 'UNKNOWN' }}'
          </div>

          <template #footer>
            <div class="flex flex-col items-end gap-4">
              <input
                id="file_input"
                ref="file_input"
                accept=".hex"
                type="file"
                class="hidden"
                @change="startLocalFlash"
              >
              <div v-if="escStore.activeTarget === -1" class="flex gap-4">
                <UButton
                  label="Flash local file"
                  :disabled="escStore.activeTarget > -1"
                  color="orange"
                  @click="file_input?.click()"
                />
                <UButton
                  label="Start flash"
                  :disabled="!selectedAsset || selectedAsset === 'NOT FOUND'"
                  @click="startRemoteFlash"
                />
              </div>
              <div v-if="escStore.activeTarget > -1" class="w-full">
                Flashing ESC #{{ (escStore.activeTarget + 1) }} of {{ escStore.count }}
                <UProgress
                  :value="(escStore.bytesWritten / escStore.totalBytes) * 100"
                  indicator
                  :animation="['Writing', 'Verifing'].includes(escStore.step) ? undefined : 'carousel'"
                />
                <div class="flex justify-center pt-2 text-green-500">
                  <div>{{ escStore.step }}</div>
                </div>
              </div>
            </div>
          </template>
        </UCard>
      </UModal>
      <UModal v-model="saveConfigModalOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center justify-center gap-2 text-xl">
                <UIcon name="i-material-symbols-sim-card-download-outline" class="h-8 w-8" />
                <div class="text-2xl">
                  Save current ESC config
                </div>
              </div>
            </div>
          </template>
          <div>
            <div class="flex flex-col gap-2">
              <div class="text-center">
                Select ESC(s) to save:
              </div>
              <div class="w-full text-center flex justify-center gap-2">
                <div
                  v-for="n of escStore.escInfo.length"
                  :key="n"
                  class="transition-all w-8 h-8 rounded-full text-center border border-gray-500 bg-gray-800 p-1 cursor-pointer"
                  :class="{
                    'ring-2 ring-green-500 bg-green-300/30': savingOrApplyingSelectedEscs.includes(n)
                  }"
                  @click="toggleSavingOrApplyingSelectedEsc(n);"
                >
                  {{ n }}
                </div>
              </div>
            </div>
          </div>
          <template #footer>
            <div class="text-right">
              <UButton label="Download" @click="downloadEscConfig" />
            </div>
          </template>
        </UCard>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable camelcase */
import commandsQueue from '~/src/communication/commands.queue';
import { DIRECT_COMMANDS, DIRECT_RESPONSES, Direct } from '~/src/communication/direct';
import { FOUR_WAY_COMMANDS, FourWay } from '~/src/communication/four_way';
import Msp, { MSP_COMMANDS } from '~/src/communication/msp';
import Serial from '~/src/communication/serial';
import Flash from '~/src/flash';
import Mcu from '~/src/mcu';

const toast = useToast();
const serialStore = useSerialStore();
const escStore = useEscStore();
const { log, logWarning, logError } = useLogStore();
const usbFCVendorIds = [0x0483, 0x2E3C];
const usbDirectVendorIds = [0x1A86];
const flashModalOpen = ref(false);
const saveConfigModalOpen = ref(false);
const applyConfigModalOpen = ref(false);
const file_input = ref<HTMLInputElement>();

const { data } = useAsyncData('get-releases', () => $fetch('/api/releases'));
const assets = ref<string[]>([]);

const { data: releasesOptionsData } = useAsyncData('get-release-tags', () => $fetch('/api/download?list=tags'));
const releasesOptions = computed(() => releasesOptionsData.value ? (releasesOptionsData.value as string[]) : []);

const selectedRelease = ref('');
const selectedAsset = ref('');
const ignoreMcuLayout = ref(false);
const savingOrApplyingSelectedEscs = ref<number[]>([]);

const toggleSavingOrApplyingSelectedEsc = (n: number) => {
    if (savingOrApplyingSelectedEscs.value.includes(n)) {
        savingOrApplyingSelectedEscs.value = [
            ...savingOrApplyingSelectedEscs.value.filter(num => num !== n)
        ];
    } else {
        savingOrApplyingSelectedEscs.value.push(n);
    }
};

watch(selectedRelease, (tag: string) => {
    const releases = data.value?.data.filter(r => r.pathname.includes(tag));
    assets.value = releases?.map(a => a.downloadUrl) ?? [];

    const currentAsset = assets.value.find(a => a === `AM32_${escStore.escInfo[0].meta.am32.fileName}_${tag.substring(1)}.hex`);
    selectedAsset.value = currentAsset ?? 'NOT FOUND';
});

const isAnySettingsDirty = computed(() => escStore.escInfo.some(e => e.settingsDirty));

const baudrateOptions = ref([
    '1000000',
    '500000',
    '256000',
    '115200',
    '57600',
    '38400',
    '19200',
    '14400',
    '9600'
]);

const baudrate = ref('115200');

const requestSerialDevices = async () => {
    await navigator.serial.requestPort({
        filters: [
            ...usbFCVendorIds.map(id => ({ usbVendorId: id })),
            ...usbDirectVendorIds.map(id => ({ usbVendorId: id }))
        ]
    });
    await fetchPairedDevices();
};

const isDirectConnectDevice = computed(() => usbDirectVendorIds.includes(parseInt(serialStore.selectedDevice.id.split(':')[0])));

const fetchPairedDevices = async () => {
    const pairedDevices: SerialPort[] = await navigator.serial.getPorts();
    serialStore.addSerialDevices(pairedDevices);

    if (pairedDevices.length > 0) {
        if (serialStore.selectedDevice.id === '-1') {
            serialStore.selectLastDevice();
            if (serialStore.selectedDevice) {
                if (isDirectConnectDevice.value) {
                    baudrate.value = '19200';
                }
            }
        }
    } else {
        if (serialStore.hasConnection) {
            serialStore.$reset();
        }
        serialStore.selectedDevice = {
            id: '-1',
            label: 'Select device'
        };
    }
};

fetchPairedDevices();

useIntervalFn(() => {
    fetchPairedDevices();
}, 500);

const connectToDevice = async () => {
    const portTmp: string[] | undefined = serialStore.selectedDevice?.id.split(':');
    if (portTmp) {
        const ports = await navigator.serial.getPorts();
        for (const p of ports) {
            if (p.getInfo().usbVendorId === +portTmp[0] && p.getInfo().usbProductId === +portTmp[1]) {
                serialStore.deviceHandles.port = p;
                break;
            }
        }
        if (!serialStore.deviceHandles.port) {
            logError('Serial port not found');
        } else {
            if (!serialStore.deviceHandles.port.readable) {
                try {
                    await serialStore.deviceHandles.port.open({
                        baudRate: +baudrate.value
                    });
                } catch (e: any) {
                    logError('Port already in use!');
                    toast.add({
                        icon: 'i-material-symbols-mimo-disconnect-outline',
                        title: 'Error',
                        color: 'red',
                        description: 'Port already in use, please free device and try again!'
                    });
                    throw new Error(`${e.message}`);
                }
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

                if (isDirectConnectDevice.value) {
                    const info = await Direct.getInstance().init();
                    const escData = {
                        isLoading: true
                    } as EscData;

                    serialStore.isDirectConnect = true;

                    escStore.count = 1;

                    escStore.escData.push(escData);

                    escStore.escInfo.push(info!);

                    escData.isLoading = false;
                } else {
                    const result = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_API_VERSION).catch(async (err) => {
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
                }

                serialStore.hasConnection = true;
            } else {
                logError('Something went wrong!');
            }
        }
    }
};

const connectToEsc = async () => {
    if (isDirectConnectDevice.value) {
        if (serialStore.isDirectConnect) {
            serialStore.isDirectConnect = true;

            escStore.count = 1;

            escStore.escData = [];
            escStore.escInfo = [];
        }
    } else {
        if (!serialStore.isFourWay) {
            const result = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_SET_PASSTHROUGH);

            serialStore.isFourWay = true;

            escStore.count = result?.data.getUint8(0) ?? 0;
        }

        escStore.escData = [];
        escStore.escInfo = [];

        await delay(1000);

        for (let i = 0; i < escStore.count; ++i) {
            const escData = {
                isLoading: true
            } as EscData;
            escStore.escData.push(escData);

            const result = await FourWay.getInstance().getInfo(i);

            escStore.escInfo.push(result);

            escData.isLoading = false;
        }
    }
};

const writeConfig = async () => {
    if (serialStore.isFourWay) {
        escStore.isSaving = true;

        for (let i = 0; i < escStore.count; ++i) {
            if (escStore.escInfo[i].settingsDirty) {
                const result = await FourWay.getInstance().writeSettings(i, escStore.escInfo[i]);
                escStore.escInfo[i].settingsBuffer = result;
                escStore.escInfo[i].settingsDirty = false;
            }
        }
        escStore.isSaving = false;
        escStore.settingsDirty = false;
    } else if (serialStore.isDirectConnect) {
        const mcu = new Mcu(escStore.escInfo[0].meta.signature);
        console.log(mcu.getEepromOffset());
        const setAddress = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetAddress, mcu.getEepromOffset());
        console.log(setAddress);
        if (setAddress?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
            await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetBufferSize, 0, new Uint8Array([Mcu.LAYOUT_SIZE]));
            const sendBuffer = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SendBuffer, 0, objectToSettingsArray(escStore.escInfo[0].settings));
            console.log(sendBuffer);
            if (sendBuffer?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
                const writeFlash = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_WriteFlash, 0);
                console.log(writeFlash);
                escStore.escInfo[0].settingsDirty = false;
                escStore.escInfo[0].settingsBuffer = objectToSettingsArray(escStore.escInfo[0].settings);
            }
        }
    }
};

const disconnectFromDevice = async () => {
    if (serialStore.deviceHandles.port) {
        if (serialStore.isFourWay) {
            await FourWay.getInstance().send(FOUR_WAY_COMMANDS.cmd_InterfaceExit);
        }

        Serial.deinit();

        serialStore.deviceHandles.reader?.releaseLock();
        serialStore.deviceHandles.writer?.releaseLock();
        await serialStore.deviceHandles.port.close();

        serialStore.$reset();

        escStore.$reset();

        log('Connection to device closed');
    }
};

const startLocalFlash = async (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
        const file: File | undefined = event.target.files?.[0];
        if (file) {
            const logStore = useLogStore();

            if (!ignoreMcuLayout.value) {
                const mcu = new Mcu(escStore.escInfo[0].meta.signature);
                const eepromOffset = mcu.getEepromOffset();
                const offset = 0x8000000;
                const fileNamePlaceOffset = 30;

                const fileFlash = Flash.parseHex(await file.text());
                const findFileNameBlock = fileFlash!.data.find(d =>
                    (eepromOffset - fileNamePlaceOffset) > (d.address - offset) &&
          (eepromOffset - fileNamePlaceOffset) < (d.address - offset + d.bytes)
                );
                if (!findFileNameBlock) {
                    logStore.logError('File name not found in hex, probably too old!');
                    throw new Error('File name not found in hex file.');
                }

                const hexFileName = new TextDecoder().decode(new Uint8Array(findFileNameBlock.data).slice(0, findFileNameBlock.data.indexOf(0x00)));
                if (!hexFileName.endsWith(escStore.escInfo[0].meta.am32.mcuType!)) {
                    logStore.logError('Invalid MCU type in hex file.');
                    throw new Error('Invalid MCU type in hex file.');
                }

                const currentFileName = hexFileName.slice(0, hexFileName.lastIndexOf('_'));
                const expectedFileName = escStore.escInfo[0].meta.am32.fileName!.slice(0, escStore.escInfo[0].meta.am32.fileName!.lastIndexOf('_'));
                if (currentFileName !== expectedFileName) {
                    logStore.logError('Layout does not match! Aborting flash!');
                    logStore.logError(`Expected: ${expectedFileName}, given: ${currentFileName}`);
                    throw new Error('Layout does not match! Aborting flash!');
                }
            }
            startFlash(await file.text());
        }
    }
};

const startRemoteFlash = async () => {
    // const fileUrl = data.value.find(r => r.tag_name === selectedRelease.value).assets as any[]).find(a => a.name === selectedAsset.value).browser_download_url;
    const release = data.value;
    // const file: Response = await fetch(`https://cors.bubblesort.me/?${fileUrl}`);
    const file = await useFetch('/api/download?release=' + release);
    console.log(file);
    // startFlash(file.data.value as string);
};

const startFlash = async (hexString: string) => {
    if (serialStore.isDirectConnect) {
        const logStore = useLogStore();
        const parsed = Flash.parseHex(hexString);
        const mcu = new Mcu(escStore.escInfo[0].meta.signature);
        if (parsed) {
            escStore.step = 'Writing';
            escStore.activeTarget = 1;
            escStore.bytesWritten = 0;
            escStore.totalBytes = parsed.bytes;
            let i = 0;
            for (const start of parsed.data) {
                i = 0;
                logStore.log(`Flashing: 0x${start.address.toString(16)}, ${start.bytes} bytes`);
                while (true) {
                    logStore.log(`... 0x${((start.address - mcu.getFlashOffset()) + (i * 128)).toString(16)} - 0x${((start.address - mcu.getFlashOffset()) + ((i + 1) * 128) - 1).toString(16)}`);
                    const chunk = new Uint8Array(start.data.slice(i * 128, ((i + 1) * 128 > start.data.length ? start.data.length - 1 : (i + 1) * 128)));
                    await Direct.getInstance().writeBufferToAddress((start.address - mcu.getFlashOffset()) + (i * 128), chunk);
                    escStore.bytesWritten += 128;
                    i += 1;
                    if ((i + 1) * 128 > start.data.length) {
                        break;
                    }
                }
            }
            escStore.activeTarget = -1;
        }
    } else {
        for (let i = 0; i < escStore.count; ++i) {
            escStore.activeTarget = i;
            escStore.escData[i].isLoading = true;
            await FourWay.getInstance().writeHex(i, hexString, 100);
            await delay(200);
            escStore.step = 'Resetting';
            await FourWay.getInstance().reset(i);
            await delay(5000);
            escStore.step = 'Read ESC';
            const result = await FourWay.getInstance().getInfo(i);
            escStore.escInfo[i] = result;
            escStore.escData[i].isLoading = false;
        }
        escStore.step = '';
        escStore.bytesWritten = 0;
        escStore.totalBytes = 0;
        escStore.activeTarget = -1;
        flashModalOpen.value = false;
        if (file_input.value) {
            file_input.value.value = '';
        }
    }
};

const downloadEscConfig = () => {
    for (const n of savingOrApplyingSelectedEscs.value) {
        const blob = new Blob([escStore.escInfo[n - 1].settingsBuffer], {
            type: 'application/octet-stream'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'esc' + n + '_config.bin';
        link.click();
        URL.revokeObjectURL(link.href);
    }
};
</script>
