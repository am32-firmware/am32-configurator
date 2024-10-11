<template>
  <div class="min-w-[320px]">
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
        </div>
        <div v-if="serialStore.hasConnection && (serialStore.mspData.motorCount > 0 || serialStore.isDirectConnect)" class="w-full flex justify-between gap-4">
          <div class="flex gap-2">
            <UChip
              v-for="n of serialStore.mspData.motorCount"
              :key="n"
              :text="n"
              size="2xl"
              color="blue"
            >
              <UIcon
                name="i-heroicons-cpu-chip-16-solid"
                class="text-xs"
                :class="{
                  'text-green-500': !escStore.escData[n - 1]?.isLoading && !escStore.escData[n - 1]?.isError,
                  'text-orange-500': escStore.escData[n - 1]?.isLoading,
                  'text-red-500': escStore.escData[n - 1]?.isError,
                  'text-white': !escStore.escData[n - 1]
                }"
              />
            </UChip>
          </div>
          <div class="flex gap-2">
            <UButton v-if="!serialStore.isDirectConnect" icon="i-material-symbols-find-in-page-outline" size="2xs" :loading="escStore.isLoading" @click="connectToEsc">
              Read
            </UButton>
            <UButton
              icon="i-material-symbols-save"
              color="blue"
              size="2xs"
              :disabled="!isAnySettingsDirty || escStore.isSaving"
              :loading="escStore.isSaving"
              @click="writeConfig"
            >
              Save
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
      <div v-if="serialStore.hasConnection && escStore.count > 0" class="flex gap-4 w-full">
        <div class="w-full flex flex-col space-y-2">
          <UButton label="Flash firmware" size="2xs" icon="i-material-symbols-full-stacked-bar-chart" color="teal" @click="flashModalOpen = true" />
          <UButton
            label="Send default config"
            size="2xs"
            icon="i-material-symbols-sim-card-outline"
            color="green"
            @click="applyDefaultConfigModalOpen = true"
          />
        </div>
        <div class="min-w-[112px]">
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

          <div v-if="true" class="flex flex-col gap-4">
            <UCheckbox
              v-model="ignoreMcuLayout"
              :disabled="isFlashingActive"
              :ui="{
                label: 'text-sm font-medium text-red-700 dark:text-red-500',
              }"
              label="Ignore current mcu layout"
              color="red"
            />
            <UAlert
              v-if="ignoreMcuLayout"
              icon="i-heroicons-exclamation-triangle"
              title="Alert!"
              variant="subtle"
              color="red"
              description="If you flash a frong mcu type, you will brick the mcu, recovering from this will take some efford!"
            />
            <UCheckbox
              v-model="includePrerelease"
              :disabled="isFlashingActive"
              :ui="{
                label: 'text-sm font-medium text-orange-700 dark:text-orange-500',
              }"
              label="Include prerelease versions"
              color="orange"
            />
            <UAlert
              v-if="includePrerelease"
              icon="i-heroicons-exclamation-triangle"
              title="Be aware!"
              variant="subtle"
              color="orange"
              description="Prerelease or release candidate versions might have bugs, if you encounter issues, please join our discord and report them!"
            />
            <UTabs
              v-model="currentTab"
              :items="flashTabs"
            >
              <template #release>
                <div class="flex flex-col gap-4">
                  <USelectMenu
                    v-model="selectedRelease"
                    searchable
                    searchable-placeholder="Search a release..."
                    :disabled="isFlashingActive"
                    :options="releasesOptions"
                    :loading="status === 'pending'"
                  />
                  <USelectMenu
                    v-model="selectedAsset"
                    searchable
                    searchable-placeholder="Search a hex file..."
                    :options="assets"
                    :disabled="assets?.length === 0 || !ignoreMcuLayout || isFlashingActive"
                    :loading="status === 'pending'"
                  />
                </div>
              </template>
              <template #local>
                <div class="flex flex-col gap-4">
                  <UInput
                    type="file"
                    size="sm"
                    icon="i-heroicons-folder"
                    accept=".hex"
                    :disabled="isFlashingActive"
                    @change="selectFile($event)"
                  />
                  <div v-if="isFlashingActive" class="text-green-500 text-center">
                    Flashing local '{{ fileInput?.name ?? 'UNKNOWN' }}'
                  </div>
                </div>
              </template>
              <template #bootloader>
                <div class="">
                  <UAlert
                    color="red"
                    variant="soft"
                    icon=""
                    title="Attention!"
                    description="Flashing the bootloader will erase all settings and data on the mcu and if you flash the wrong bootloader, it will only be recoverable via SWD, are you sure you want to continue?"
                    class="mb-2"
                  />
                  <UInput
                    type="file"
                    size="sm"
                    icon="i-heroicons-folder"
                    accept=".amj"
                    :disabled="isFlashingActive"
                    @change="selectFile($event)"
                  />
                  <div v-if="isFlashingActive" class="text-green-500 text-center">
                    Flashing local '{{ fileInput?.name ?? 'UNKNOWN' }}'
                  </div>
                </div>
              </template>
            </UTabs>
          </div>
          <div v-else class="text-green-500 text-center">
            Flashing local '{{ fileInput ?? 'UNKNOWN' }}'
          </div>
          <div v-if="serialStore.isFourWay" class="pt-4">
            <div class="text-center mb-2">
              Select ESC(s) to flash:
            </div>
            <div class="w-full text-center flex justify-center gap-2">
              <div
                v-for="n of escStore.selectedEscInfo.length"
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
          <template #footer>
            <div class="flex flex-col items-end gap-4">
              <div v-if="escStore.activeTarget === -1" class="flex gap-4">
                <UButton
                  label="Start flash"
                  :disabled="
                    (savingOrApplyingSelectedEscs.length === 0) ||
                      (currentTab === 0 && (!selectedAsset || selectedAsset === 'NOT FOUND')) ||
                      (currentTab > 0 && !fileInput)
                  "
                  @click="startModalFlash"
                />
              </div>
              <div v-if="escStore.activeTarget > -1" class="w-full">
                Flashing ESC #{{ (escStore.activeTarget + 1) }}
                <UProgress
                  :value="progressIsIntermediate ? undefined : (escStore.bytesWritten / escStore.totalBytes) * 100"
                  :indicator="!progressIsIntermediate"
                  animation="carousel"
                />
                <div class="flex justify-center pt-2 text-green-500">
                  <div>{{ escStore.step }}</div>
                </div>
              </div>
            </div>
          </template>
        </UCard>
      </UModal>
      <UModal v-model="applyDefaultConfigModalOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center justify-center gap-2 text-xl">
                <UIcon name="i-material-symbols-sim-card-outline" class="h-8 w-8" />
                <div class="text-2xl">
                  Apply default config
                </div>
              </div>
            </div>
          </template>
          <div>
            <div class="flex flex-col gap-2">
              <div class="text-center">
                Select ESC(s) to apply:
              </div>
              <div class="w-full text-center flex justify-center gap-2">
                <div
                  v-for="n of escStore.selectedEscInfo.length"
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
              <UButton label="Apply" :disabled="savingOrApplyingSelectedEscs.length === 0" @click="applyDefaultConfig" />
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
                  v-for="n of escStore.selectedEscInfo.length"
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
              <UButton label="Download" :disabled="savingOrApplyingSelectedEscs.length === 0" @click="downloadEscConfig" />
            </div>
          </template>
        </UCard>
      </UModal>
      <UModal v-model="applyConfigModalOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center justify-center gap-2 text-xl">
                <UIcon name="i-material-symbols-sim-card-download-outline" class="h-8 w-8" />
                <div class="text-2xl">
                  Apply ESC config
                </div>
              </div>
            </div>
          </template>
          <div>
            <div class="flex flex-col gap-2">
              <UInput ref="applyConfigFile" type="file" color="primary" variant="outline" placeholder=".bin" />
              <div class="text-center">
                Select ESC(s) to apply:
              </div>
              <div class="w-full text-center flex justify-center gap-2">
                <div
                  v-for="n of escStore.selectedEscInfo.length"
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
              <UButton label="Apply" :disabled="savingOrApplyingSelectedEscs.length === 0 || applyConfigFile?.input.files.length === 0" @click="applyConfig" />
            </div>
          </template>
        </UCard>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">

import commandsQueue from '~/src/communication/commands.queue';
import { DIRECT_COMMANDS, DIRECT_RESPONSES, Direct } from '~/src/communication/direct';
import { FOUR_WAY_COMMANDS, FourWay } from '~/src/communication/four_way';
import Msp, { MSP_COMMANDS } from '~/src/communication/msp';
import Serial from '~/src/communication/serial';
import db from '~/src/db';
import Flash from '~/src/flash';
import Mcu, { type EscData } from '~/src/mcu';

const toast = useToast();
const serialStore = useSerialStore();
const escStore = useEscStore();
const { escData } = storeToRefs(escStore);
const { log, logWarning, logError } = useLogStore();
const usbFCVendorIds = [0x0483, 0x2E3C, 0x2E8A, 0x1209, 0x26AC, 0x27AC, 0x2DAE, 0x3162, 0x35A7];
const usbDirectVendorIds = [0x1A86, 0x0403, 0x4348, 0x26BA];
const flashModalOpen = ref(false);
const applyDefaultConfigModalOpen = ref(false);
const saveConfigModalOpen = ref(false);
const applyConfigModalOpen = ref(false);
const fileInput = ref<File | null>(null);
const currentTab = ref(0);
const applyConfigFile = ref();

const selectedRelease = ref('');
const selectedAsset = ref('');
const ignoreMcuLayout = ref(false);
const includePrerelease = ref(false);
const savingOrApplyingSelectedEscs = ref<number[]>([]);
const isFlashingActive = computed(() => escStore.activeTarget > -1);

const progressIsIntermediate = computed(() => !['Writing', 'Verifing'].includes(escStore.step));

const { data, status } = useAsyncData('get-releases', () => useFetch(`/api/files?filter=releases${includePrerelease.value ? '&prereleases' : ''}`), {
    watch: [includePrerelease]
});

const releases = computed(() => {
    const tmp = data.value?.data as unknown as { data: BlobFolder[] };
    return tmp?.data ?? [];
});

const assets = computed(() => (releases.value?.[0]?.children.find(c => c.name === selectedRelease.value)?.files.map(f => f.name)));

const releasesOptions = computed(() => {
    return (releases.value?.[0]?.children.map(c => c.name) ?? []).sort((a, b) => b.localeCompare(a));
});

const flashTabs = computed(() => [
    { label: 'Release', disabled: isFlashingActive.value, slot: 'release' },
    { label: 'Local', disabled: isFlashingActive.value, slot: 'local' },
    { label: 'Bootloader', disabled: isFlashingActive.value, slot: 'bootloader' }
]);

watch(releasesOptions, (d) => {
    if (!selectedRelease.value && d?.length > 0) {
        setTimeout(() => {
            selectedRelease.value = d[0];
        }, 200);
    }
});

watch(includePrerelease, (b, a) => {
    if (b !== a) {
        selectedAsset.value = '';
        selectedRelease.value = '';
    }
});

const toggleSavingOrApplyingSelectedEsc = (n: number) => {
    if (savingOrApplyingSelectedEscs.value.includes(n)) {
        savingOrApplyingSelectedEscs.value = [
            ...savingOrApplyingSelectedEscs.value.filter(num => num !== n)
        ];
    } else {
        savingOrApplyingSelectedEscs.value.push(n);
    }
};

watchEffect(() => {
    if (assets.value && escStore.escData.length > 0) {
        const tag = selectedRelease.value;
        const cleanTag = tag.substring(1).replace(/-rc[1-9]*[0-9]*/gi, '');
        console.log(`AM32_${escStore.firstValidEscData?.data.meta.am32.fileName ?? 'ERROR'}_${cleanTag}.hex`);
        const currentAsset = assets.value?.find(a => a === `AM32_${escStore.firstValidEscData?.data.meta.am32.fileName ?? 'ERROR'}_${cleanTag}.hex`);
        selectedAsset.value = currentAsset ?? 'NOT FOUND';
    }
});

const isAnySettingsDirty = computed(() => escStore.escData.some(e => e.data?.settingsDirty));

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

const isDirectConnectDevice = computed(() => usbDirectVendorIds.includes(Number.parseInt(serialStore.selectedDevice.id.split(':')[0])));

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
                    await serialStore.deviceHandles.serial.openPort(
                        serialStore.deviceHandles.port, {
                            baudRate: +baudrate.value
                        } as {
                          baudRate?: number;
                          stopBits?: 1 | 2;
                          parity?: 'none';
                          'even': any;
                          'odd': any;
                          bufferSize?: number;
                          flowControl?: 'none' | 'hardware';
                          onconnect?: (ev: any) => void;
                          ondisconnect?: (ev: any) => void;
                      }
                    );
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
                /* if (!serialStore.deviceHandles.reader) {
                    serialStore.deviceHandles.reader = await serialStore.deviceHandles.port.readable.getReader();
                }
                if (!serialStore.deviceHandles.writer) {
                    serialStore.deviceHandles.writer = await serialStore.deviceHandles.port.writable.getWriter();
                } */
                Serial.init(log, logError, logWarning, serialStore.deviceHandles.serial, serialStore.deviceHandles.port);

                log('Connected to device');

                if (isDirectConnectDevice.value) {
                    serialStore.isDirectConnect = true;

                    savingOrApplyingSelectedEscs.value = [0];

                    escStore.count = 1;
                    escStore.expectedCount = 1;

                    await delay(200);

                    const info = await Direct.getInstance().init();
                    const newEscData = {
                        isLoading: true,
                        data: info!
                    } as EscData;

                    escData.value.push(newEscData);

                    newEscData.isLoading = false;
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
                    await Msp.getInstance().sendWithPromise(Msp.getInstance().getTypeMotorCommand(serialStore.mspData.type)).then((result) => {
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
    const router = useRouter();
    if (!router.currentRoute.value.fullPath.startsWith('/configurator')) {
        router.push({
            path: '/configurator'
        });
    }
    if (isDirectConnectDevice.value) {
        if (serialStore.isDirectConnect) {
            serialStore.isDirectConnect = true;

            escStore.expectedCount = 1;
            escStore.count = 1;

            escStore.escData = [];
        }
    } else {
        if (!serialStore.isFourWay) {
            const result = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_SET_PASSTHROUGH);

            await delay(2000);

            serialStore.isFourWay = true;

            escStore.expectedCount = result?.data.getUint8(0) ?? 0;
        }

        escData.value = [];
        escStore.count = 0;
        escStore.isLoading = true;

        await delay(1000);

        for (let i = 0; i < escStore.expectedCount; ++i) {
            const newEscData = {
                isLoading: true,
                isError: false
            } as EscData;
            escData.value.push(newEscData);

            try {
                const result = await FourWay.getInstance().getInfo(i);
                console.log(result, escStore.escData);
                escStore.escData[i].data = result;
                escStore.count += 1;
            } catch (e) {
                console.error(e);
                newEscData.isError = true;
            }

            newEscData.isLoading = false;
        }

        escStore.isLoading = false;
    }
};

const writeConfig = async () => {
    if (serialStore.isFourWay) {
        escStore.isSaving = true;

        for (let i = 0; i < escStore.escData.length; ++i) {
            if (!escStore.escData[i].isError && escStore.escData[i].data.settingsDirty) {
                const result = await FourWay.getInstance().writeSettings(i, escStore.escData[i].data);
                escStore.escData[i].data.settingsBuffer = result;
                escStore.escData[i].data.settingsDirty = false;
            }
        }
        escStore.isSaving = false;
        escStore.settingsDirty = false;
    } else if (serialStore.isDirectConnect && escStore.firstValidEscData) {
        const mcu = new Mcu(escStore.firstValidEscData.data.meta.signature);
        const setAddress = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetAddress, mcu.getEepromOffset());
        if (setAddress?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
            await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SetBufferSize, 0, new Uint8Array([Mcu.LAYOUT_SIZE]));
            const sendBuffer = await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_SendBuffer, 0, objectToSettingsArray(escStore.firstValidEscData.data.settings));
            if (sendBuffer?.at(0) === DIRECT_RESPONSES.GOOD_ACK) {
                await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_WriteFlash, 0);
                escStore.firstValidEscData.data.settingsDirty = false;
                escStore.firstValidEscData.data.settingsBuffer = objectToSettingsArray(escStore.firstValidEscData.data.settings);
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

        /*
        console.log(serialStore.deviceHandles);
        serialStore.deviceHandles.reader?.releaseLock();
        serialStore.deviceHandles.writer?.releaseLock();
        await serialStore.deviceHandles.port.close();
        */

        if (serialStore.deviceHandles.stream) {
            serialStore.deviceHandles.stream.reader?.releaseLock();
            serialStore.deviceHandles.stream.writer?.releaseLock();
            serialStore.deviceHandles.stream.port.close();
        }

        serialStore.$reset();

        escStore.$reset();

        log('Connection to device closed');
    }
};

/*
const startLocalFlash = async (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
        const file: File | undefined = event.target.files?.[0];
        if (file) {

        }
    }
};
*/

const selectFile = (event: Event | FileList) => {
    if (event instanceof Event && event.target instanceof HTMLInputElement && event.target.files?.[0]) {
        fileInput.value = event.target.files[0];
    } else if (event instanceof FileList) {
        fileInput.value = event[0];
    }
};

const startModalFlash = async () => {
    if (currentTab.value === 0) {
        const url = releases.value?.[0].children.find(c => c.name === selectedRelease.value)?.files.find(f => f.name === selectedAsset.value)?.url;
        if (url) {
            const dbEntry = await db.downloads.where('url').equals(url).first();

            escStore.activeTarget = 0;
            escStore.step = 'Downloading';

            if (dbEntry) {
                return startFlash(dbEntry.text);
            }

            const file: Response = await fetch(url);
            const blob = await file.blob();
            const data = await blob.text();
            if (blob && typeof data === 'string') {
                await db.downloads.add({
                    url,
                    text: data
                });

                startFlash(data);
            }
        }
    } else if (currentTab.value === 1) {
        const logStore = useLogStore();
        if (fileInput.value) {
            if (!ignoreMcuLayout.value && escStore.firstValidEscData) {
                const mcu = new Mcu(escStore.firstValidEscData.data.meta.signature);
                const eepromOffset = mcu.getEepromOffset();
                const offset = 0x8000000;
                const fileNamePlaceOffset = 30;

                const fileFlash = Flash.parseHex(await fileInput.value.text());
                const tmp = escStore.firstValidEscData.data.meta.am32;
                if (fileFlash && tmp.mcuType && tmp.fileName) {
                    const findFileNameBlock = fileFlash.data.find(d =>
                        (eepromOffset - fileNamePlaceOffset) > (d.address - offset) && (eepromOffset - fileNamePlaceOffset) < (d.address - offset + d.bytes)
                    );
                    if (!findFileNameBlock) {
                        logStore.logError('File name not found in hex, probably too old!');
                        throw new Error('File name not found in hex file.');
                    }

                    const hexFileName = new TextDecoder().decode(new Uint8Array(findFileNameBlock.data).slice(0, findFileNameBlock.data.indexOf(0x00)));
                    if (!hexFileName.endsWith(tmp.mcuType)) {
                        logStore.logError('Invalid MCU type in hex file.');
                        throw new Error('Invalid MCU type in hex file.');
                    }

                    const currentFileName = hexFileName.slice(0, hexFileName.lastIndexOf('_'));
                    const expectedFileName = tmp.fileName.slice(0, tmp.fileName.lastIndexOf('_'));
                    if (currentFileName !== expectedFileName) {
                        logStore.logError('Layout does not match! Aborting flash!');
                        logStore.logError(`Expected: ${expectedFileName}, given: ${currentFileName}`);
                        throw new Error('Layout does not match! Aborting flash!');
                    }
                }
            }
            startFlash(await fileInput.value.text());
        }
    } else if (currentTab.value === 2) {
        const logStore = useLogStore();
        if (fileInput.value && escStore.firstValidEscData) {
            const amj: AmjType = await fileInput.value.text().then((text: string) => {
                const parsed = JSON.parse(text);
                return {
                    ...parsed,
                    hex: atob(parsed.hex)
                };
            });

            const fileFlash = Flash.parseHex(amj.hex);
            const tmp = escStore.firstValidEscData.data;
            if (fileFlash && tmp.meta?.am32?.mcuType && tmp.meta?.am32?.fileName) {
                if (amj.mcuType !== tmp.meta.am32.mcuType) {
                    logStore.logError('Invalid MCU type in amj file.');
                    throw new Error('Invalid MCU type in amj file.');
                }

                if (amj.pin !== tmp.bootloader.pin) {
                    logStore.logError('Pin does not match! Aborting flash!');
                    throw new Error('Pin does not match! Aborting flash!');
                }
            }
            startFlash(amj.hex);
        }
    }
};

const startFlash = async (hexString: string) => {
    if (serialStore.isDirectConnect && escStore.firstValidEscData) {
        const logStore = useLogStore();
        const parsed = Flash.parseHex(hexString);
        const mcu = new Mcu(escStore.firstValidEscData.data.meta.signature);
        if (parsed) {
            escStore.activeTarget = 0;
            escStore.bytesWritten = 0;

            let i = 0;
            if (parsed.bytes < 27 * 1024 - 1 + 32) {
                const filled = new Uint8Array(27 * 1024 - 1).fill(0x00);
                const highIndex = parsed.data.findIndex(d => d.bytes > 32);
                filled.set(parsed.data[highIndex].data);
                parsed.data[highIndex].data = Array.from(filled);
                parsed.data[highIndex].bytes = filled.length;
                parsed.bytes = filled.length + 32;
            }

            escStore.totalBytes = parsed.bytes;
            escStore.step = 'Writing';

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
            escStore.step = 'Rewriting config';
            await writeConfig();
            escStore.step = 'Resetting';
            await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_Reset, 0);
            escStore.step = 'Read config';
            await Direct.getInstance().init();

            escStore.activeTarget = -1;
        }
    } else {
        for (const n of savingOrApplyingSelectedEscs.value) {
            const i = n - 1;
            escStore.activeTarget = i;
            await FourWay.getInstance().writeHex(i, hexString, 200);
            await delay(200);
            if (currentTab.value === 2) {
                escStore.step = 'Sending default config';
                await applyDefaultConfig();
            }
            escStore.step = 'Resetting';
            await FourWay.getInstance().reset(i);
            await delay(5000);
            if (currentTab.value === 2) {
                escStore.step = 'Done';
            } else {
                escStore.step = 'Read ESC';
                try {
                    const result = await FourWay.getInstance().getInfo(i, 20);

                    escStore.escData[i].data = result;
                    escStore.escData[i].isLoading = false;
                } catch (e) {
                    console.error(e);
                }
            }
        }
        escStore.step = '';
        escStore.bytesWritten = 0;
        escStore.totalBytes = 0;
        escStore.activeTarget = -1;
        flashModalOpen.value = false;
        /* if (file_input.value) {
            file_input.value.value = '';
        } */
    }
};

const applyDefaultConfig = async () => {
    const file = await fetch('/assets/eeprom_default.bin');

    if (file) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const settings = bufferToSettings(buffer);

        settings.STARTUP_MELODY = (new Array(128)).fill(0xFF);

        for (const n of savingOrApplyingSelectedEscs.value) {
            escStore.escData[n - 1].data.settings = settings;
            escStore.escData[n - 1].data.settingsDirty = true;
        }

        await writeConfig();
    }

    if (applyConfigFile.value) {
        applyConfigFile.value.input.value = '';
    }
};

const downloadEscConfig = () => {
    for (const n of savingOrApplyingSelectedEscs.value) {
        const blob = new Blob([escStore.escData[n - 1].data.settingsBuffer], {
            type: 'application/octet-stream'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `esc${n}_config.bin`;
        link.click();
        URL.revokeObjectURL(link.href);
    }
};

const applyConfig = async () => {
    if (applyConfigFile.value.input.files.length === 1) {
        const file: File = applyConfigFile.value.input.files[0];
        if (file) {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const settings = bufferToSettings(buffer);

            for (const n of savingOrApplyingSelectedEscs.value) {
                escStore.escData[n - 1].data.settings = settings;
                escStore.escData[n - 1].data.settingsDirty = true;
            }

            await writeConfig();
        }

        if (applyConfigFile.value) {
            applyConfigFile.value.input.value = '';
        }
    }
};
</script>
