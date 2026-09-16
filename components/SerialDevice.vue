<template>
  <div class="min-w-[350px]">
    <div class="p-4 grid grid-cols-1 gap-2">
      <div class="flex flex-column gap-2">
        <USelectMenu v-model="serialStore.selectedDevice" class="flex-grow" :disabled="serialStore.hasConnection" :options="serialStore.pairedDevicesOptions" placeholder="Select device" />
        <USelectMenu
          v-model="baudrate"
          class="flex-grow"
          :disabled="serialStore.selectedDevice.id === '-1' || serialStore.hasConnection || isDirectConnectDevice || isForceDirectConnect"
          :options="baudrateOptions"
        />
      </div>
      <div class="flex justify-between gap-2">
        <div class="flex gap-6 items-center">
          <UButton size="2xs" @click="requestSerialDevices">
            Port select
          </UButton>
          <label class="flex items-center gap-2">
            Direct
            <UCheckbox v-model="isForceDirectConnect" :disabled="isDirectConnectDevice || serialStore.hasConnection" />
          </label>
        </div>
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
            <UButton icon="i-material-symbols-find-in-page-outline" size="2xs" :loading="escStore.isLoading" @click="connectToEsc">
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
              description="If you flash a wrong mcu type, you will brick the mcu, recovering from this will take some effort!"
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
            <div v-if="serialStore.isDirectConnect" class="text-center">
              Do you want to overwrite the current config with default settings?
            </div>
            <div v-else class="flex flex-col gap-2">
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
              <UButton color="green" :label="serialStore.isDirectConnect ? 'Yes' : 'Apply'" :disabled="savingOrApplyingSelectedEscs.length === 0" @click="applyDefaultConfig" />
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
import { DIRECT_COMMANDS, Direct } from '~/src/communication/direct';
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
const usbFCVendorIds = [0x0483, 0x2E3C, 0x2E8A, 0x1209, 0x26AC, 0x27AC, 0x2DAE, 0x3162, 0x35A7, 0x28E9];
const usbDirectVendorIds = [0x1A86, 0x0403, 0x4348, 0x26BA, 0x10C4];
const usbDirectDeviceIdExceptions = [0xE204];
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

const progressIsIntermediate = computed(() => !['Writing', 'Verifying'].includes(escStore.step));

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

const isForceDirectConnect = ref(false);
const isDirectConnectDevice = computed(
    () => usbDirectVendorIds.includes(Number.parseInt(serialStore.selectedDevice.id.split(':')[0])) &&
          !usbDirectDeviceIdExceptions.includes(Number.parseInt(serialStore.selectedDevice.id.split(':')[1]))
);

const fetchPairedDevices = async () => {
    const pairedDevices: SerialPort[] = await navigator.serial.getPorts();
    serialStore.addSerialDevices(pairedDevices);

    if (pairedDevices.length > 0) {
        if (serialStore.selectedDevice.id === '-1') {
            serialStore.selectLastDevice();
        }

        if (serialStore.selectedDevice) {
            if (isDirectConnectDevice.value || isForceDirectConnect.value) {
                isForceDirectConnect.value = true;
                baudrate.value = '19200';
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
    const router = useRouter();
    if (!router.currentRoute.value.fullPath.startsWith('/configurator')) {
        router.push({
            path: '/configurator'
        });
    }
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

                if (isDirectConnectDevice.value || isForceDirectConnect.value) {
                    serialStore.isDirectConnect = true;
                    connectToEsc();
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

                    const passthroughResult = await Msp.getInstance().sendWithPromise(MSP_COMMANDS.MSP_SET_PASSTHROUGH);

                    await delay(2000);

                    serialStore.isFourWay = true;

                    escStore.expectedCount = passthroughResult?.data.getUint8(0) ?? 0;
                }

                serialStore.hasConnection = true;
            } else {
                logError('Something went wrong!');
            }
        }
    }
};

const connectToEsc = async () => {
    if (isDirectConnectDevice.value || isForceDirectConnect.value) {
        escStore.isLoading = true;

        serialStore.isDirectConnect = true;

        savingOrApplyingSelectedEscs.value = [1];

        escStore.count = 1;
        escStore.expectedCount = 1;

        escData.value = [];

        await delay(200);

        const info = await Direct.getInstance().init();
        const newEscData = {
            isLoading: true,
            data: info!
        } as EscData;

        escData.value = [newEscData];

        newEscData.isLoading = false;
        escStore.isLoading = false;
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

        for (let i = 0; i < escStore.expectedCount; ++i) {
            const newEscData = {
                isLoading: true,
                isError: false
            } as EscData;
            escData.value.push(newEscData);

            try {
                const result = await FourWay.getInstance().getInfo(i);
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

    if (
        escStore.escData.filter(
            // errored slots never get data assigned - skip them, they must
            // not crash the empty-settings scan for the healthy ESCs
            e => !e.isError && e.data?.settingsBuffer.length &&
                (e.data.settingsBuffer.filter(s => s === 0xFF).length === e.data.settingsBuffer.length ||
                  e.data.settingsBuffer.reduce((acc, cur) => acc + cur, 0) === 0)
        ).length > 0
    ) {
        toast.add({
            title: 'Error',
            color: 'red',
            description: 'Found empty settings, flashing default settings now!'
        });

        savingOrApplyingSelectedEscs.value = escStore.selectedEscInfo.map((_, i) => i + 1);

        applyDefaultConfig();
    }

    let needToSave = false;

    for (const esc of escStore.escData) {
        if (esc.isError || !esc.data) {
            continue;
        }
        const firmwareVersion = `${esc.data.settings.MAIN_REVISION}.${esc.data.settings.SUB_REVISION}`;
        if (firmwareVersion.endsWith('2.19')) {
            if (esc.data.settings.TIMING_ADVANCE as number < 10) {
                needToSave = true;
                for (let i = 0; i < escStore.escData.length; ++i) {
                    if (escStore.escData[i].isError || !escStore.escData[i].data) {
                        continue;
                    }
                    escStore.escData[i].data.settingsDirty = true;
                    escStore.escData[i].data.settings.TIMING_ADVANCE = 16;
                }
            }
        }
    }

    if (needToSave) {
        await writeConfig();
        toast.add({
            title: 'Info',
            color: 'blue',
            description: 'Eeprom upgraded. Adjusted settings, saved and applied!'
        });
    }
};

const writeConfig = async () => {
    if (serialStore.isFourWay) {
        escStore.isSaving = true;

        for (let i = 0; i < escStore.escData.length; ++i) {
            if (!escStore.escData[i].isError && escStore.escData[i].data.settingsDirty) {
                const result = await FourWay.getInstance().writeSettings(i, escStore.escData[i].data).catch((err) => {
                    logError(`Error writing settings to ESC #${i + 1}: ${err.message}`);
                    escStore.escData[i].isError = true;
                    return null;
                });
                if (result) {
                    escStore.escData[i].data.settingsBuffer = result;
                    escStore.escData[i].data.settingsDirty = false;
                }
            }
        }
        escStore.isSaving = false;
        escStore.settingsDirty = false;
    } else if (serialStore.isDirectConnect && escStore.firstValidEscData) {
        const mcu = new Mcu(escStore.firstValidEscData.data.meta.signature);
        mcu.setInfo(escStore.firstValidEscData.data);
        await Direct.getInstance().writeChunked(mcu.getEepromStartByte(), objectToSettingsArray(escStore.firstValidEscData.data.settings, escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number), mcu.getDirectWriteChunk());
        escStore.firstValidEscData.data.settingsDirty = false;
        escStore.firstValidEscData.data.settingsBuffer = objectToSettingsArray(escStore.firstValidEscData.data.settings, escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number);
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
                // honour v3 devinfo so the filename block is located at the
                // bootloader-reported filename address (DroneCAN builds link
                // it away from the EEPROM), not the static-table default.
                mcu.setInfo(escStore.firstValidEscData.data);
                const offset = mcu.getFlashOffset();
                // a point 2 bytes inside the 32-byte file-name block
                const fileNameProbe = mcu.getFileNameStartByte() + 2;

                const fileFlash = Flash.parseHex(await fileInput.value.text());
                const tmp = escStore.firstValidEscData.data.meta.am32;
                if (fileFlash && tmp.mcuType && tmp.fileName) {
                    const findFileNameBlock = fileFlash.data.find(d =>
                        fileNameProbe > (d.address - offset) && fileNameProbe < (d.address - offset + d.bytes)
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
        // v3 devinfo (address_shift, firmware/eeprom starts) from the
        // connect-time read, so 128k parts address correctly
        mcu.setInfo(escStore.firstValidEscData.data);
        if (parsed) {
            escStore.activeTarget = 0;
            escStore.bytesWritten = 0;

            // One merged 0xFF-filled image, written in aligned chunks from
            // the firmware start - the same shape the four-way writeHex
            // path uses. Writing per hex block double-programmed any
            // aligned window shared by two blocks (losing the first
            // block's bytes to the second write's padding) and could not
            // address blocks whose start the v3 address_shift cannot
            // express.
            const endAddress = parsed.data[parsed.data.length - 1].address + parsed.data[parsed.data.length - 1].bytes;
            const image = Flash.fillImage(parsed, endAddress - mcu.getFlashOffset(), mcu.getFlashOffset());
            if (!image) {
                toast.add({
                    title: 'Error',
                    color: 'red',
                    description: 'hex file addresses fall outside the flash!'
                });
                return;
            }
            const begin = mcu.getFirmwareStartByte();
            escStore.totalBytes = image.byteLength - begin;
            escStore.step = 'Writing';

            // boot bit: clear before flashing, set again via the config
            // rewrite (or reset seeding) after success, as writeHex does -
            // a power loss mid-flash must not leave a half image bootable.
            // LAYOUT_REVISION 0 is a zeroed eeprom, not a configuration.
            const preFlashSettings = escStore.firstValidEscData.data.settings;
            const havePreConfig = (preFlashSettings.BOOT_BYTE as number) <= 1 &&
                (preFlashSettings.LAYOUT_REVISION as number) >= 1 &&
                (preFlashSettings.LAYOUT_REVISION as number) <= 64;
            if (havePreConfig) {
                // the whole buffer, not just the leading bytes: the eeprom
                // write erases its page, so a short guard would trade the
                // rest of the stored settings for the boot byte
                const guard = Uint8Array.from(escStore.firstValidEscData.data.settingsBuffer);
                guard[0] = 0x00;
                await Direct.getInstance().writeChunked(mcu.getEepromStartByte(), guard, mcu.getDirectWriteChunk());
            }

            const CHUNK_SIZE = mcu.getDirectWriteChunk();
            for (let off = begin; off < image.byteLength; off += CHUNK_SIZE) {
                const end = Math.min(off + CHUNK_SIZE, image.byteLength);
                let chunk: Uint8Array = image.subarray(off, end);
                if (chunk.length % 8 !== 0) {
                    // the bootloader's flash write requires an 8-byte
                    // aligned length; pad the image tail with erased flash
                    const padded = new Uint8Array((chunk.length + 7) & ~7).fill(0xFF);
                    padded.set(chunk);
                    chunk = padded;
                }
                await Direct.getInstance().writeBufferToAddress(off, chunk);
                escStore.bytesWritten += end - off;
            }
            // A factory-fresh ESC has an erased settings area: there is
            // no valid layout to serialise (LAYOUT_REVISION reads 0xFF,
            // and the version-gated fields are absent from the parsed
            // settings) and nothing worth preserving, so leave it erased
            // and let 'Send default config' seed it. Rewriting is for
            // keeping a real pre-flash configuration across the update.
            if (havePreConfig) {
                escStore.step = 'Rewriting config';
                // the flash completed: the ESC must boot it, whatever the
                // boot byte said before - a reconnect after an interrupted
                // flash reads back the 0 the guard wrote
                escStore.firstValidEscData.data.settings.BOOT_BYTE = 1;
                await writeConfig();
            } else {
                logStore.log('eeprom is erased; use "Send default config" to initialise it');
            }
            escStore.step = 'Resetting';
            await Direct.getInstance().writeCommand(DIRECT_COMMANDS.cmd_Reset, 0);
            await delay(3000);
            escStore.step = 'Read config';
            await Direct.getInstance().init();

            escStore.activeTarget = -1;
        }
    } else {
        for (const n of savingOrApplyingSelectedEscs.value) {
            // n is a position in the filtered selectedEscInfo list the modal
            // shows; map it to the escData slot / four-way target behind it
            const i = escStore.selectedEscIndices[n - 1];
            if (i === undefined) {
                continue;
            }
            escStore.activeTarget = i;
            await FourWay.getInstance().writeHex(i, escStore.escData[i].data, hexString, 200);
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

        await connectToEsc();
        /* if (file_input.value) {
            file_input.value.value = '';
        } */
    }
};

// newest eeprom layout we know defaults for
const HIGHEST_LAYOUT_REVISION = 4;

const applyDefaultConfig = async () => {
    const rawEscVersion = escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number;
    const escName = escStore.firstValidEscData?.data.meta.am32.fileName;
    // an erased eeprom reads 0xFF (or 0x00 when zeroed) - not a real layout.
    // Start the descent from the newest known layout instead of walking
    // hundreds of bogus versions (or, for 0, never running at all).
    const layoutIsValid = rawEscVersion >= 1 && rawEscVersion <= HIGHEST_LAYOUT_REVISION;
    const escVersion = layoutIsValid ? rawEscVersion : HIGHEST_LAYOUT_REVISION;

    // Find a default image the ESC can actually take: its own layout
    // first, then older layouts (whose fields are a subset), the named
    // target before the generic default at each step. Every response is
    // validated before use - an API error page written to the eeprom
    // bricks the settings, which is exactly what used to happen here.
    const fetchDefault = async (): Promise<{ buffer: Uint8Array, version: number } | null> => {
        for (let version = escVersion; version >= 1; version--) {
            for (const name of [escName, 'DEFAULT']) {
                if (!name) {
                    continue;
                }
                const url = await fetch(`/api/eeprom/${name}?version=${version}`)
                    .then(res => (res.status === 200 ? res.text() : null))
                    .catch(() => null);
                if (!url) {
                    continue;
                }
                const blob = await fetch(url)
                    .then(res => (res.status === 200 ? res.arrayBuffer() : null))
                    .catch(() => null);
                if (!blob) {
                    continue;
                }
                const buffer = new Uint8Array(blob);
                // a settings image, not an error page: the layout byte
                // must be the one we asked for and the boot byte sane
                if (buffer.length >= 48 && buffer[1] === version && buffer[0] <= 1) {
                    return { buffer, version };
                }
            }
        }
        return null;
    };

    const found = await fetchDefault();
    if (!found) {
        logError(`No valid default config available for ${escName} (eeprom v${escVersion})`);
        if (applyDefaultConfigModalOpen.value) {
            applyDefaultConfigModalOpen.value = false;
        }
        return;
    }

    const defaults = bufferToSettings(found.buffer, found.version);
    defaults.STARTUP_MELODY = (new Array(128)).fill(0xFF);
    // a default config must not change what the ESC is, only how it is
    // tuned: identity fields always come from the ESC itself. An erased
    // eeprom has no identity to keep, though - preserving its 0xFF boot
    // byte would leave the ESC unbootable - so remember the default's
    // boot/layout bytes for that case.
    const defaultBootByte = defaults.BOOT_BYTE;
    const defaultLayout = defaults.LAYOUT_REVISION;
    delete defaults.BOOT_BYTE;
    delete defaults.LAYOUT_REVISION;
    delete defaults.BOOT_LOADER_REVISION;
    delete defaults.MAIN_REVISION;
    delete defaults.SUB_REVISION;

    for (const n of savingOrApplyingSelectedEscs.value) {
        const i = escStore.selectedEscIndices[n - 1];
        if (i === undefined) {
            continue;
        }
        const current = escStore.escData[i].data.settings;
        // fields the (possibly older-layout) default lacks keep their
        // current values rather than becoming undefined
        const merged = { ...current, ...defaults };
        const currentLayout = current.LAYOUT_REVISION as number;
        if (!(currentLayout >= 1 && currentLayout <= HIGHEST_LAYOUT_REVISION)) {
            merged.BOOT_BYTE = defaultBootByte;
            merged.LAYOUT_REVISION = defaultLayout;
        }
        escStore.escData[i].data.settings = merged;
        escStore.escData[i].data.settingsDirty = true;
    }

    await writeConfig().catch((err) => {
        logError(err.message);
    });

    if (applyDefaultConfigModalOpen.value) {
        applyDefaultConfigModalOpen.value = false;
    }

    if (applyConfigFile.value) {
        applyConfigFile.value.input.value = '';
    }
};

const downloadEscConfig = () => {
    for (const n of savingOrApplyingSelectedEscs.value) {
        const i = escStore.selectedEscIndices[n - 1];
        if (i === undefined) {
            continue;
        }
        const blob = new Blob([escStore.escData[i].data.settingsBuffer.buffer as ArrayBuffer], {
            type: 'application/octet-stream'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `esc${i + 1}_config.bin`;
        link.click();
        URL.revokeObjectURL(link.href);
    }
};

const applyConfig = async () => {
    if (applyConfigFile.value.input.files.length === 1) {
        const file: File = applyConfigFile.value.input.files[0];
        if (file) {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const settings = bufferToSettings(buffer, escStore.firstValidEscData?.data.settings.LAYOUT_REVISION as number);

            for (const n of savingOrApplyingSelectedEscs.value) {
                const i = escStore.selectedEscIndices[n - 1];
                if (i === undefined) {
                    continue;
                }
                escStore.escData[i].data.settings = settings;
                escStore.escData[i].data.settingsDirty = true;
            }

            await writeConfig();
        }

        if (applyConfigFile.value) {
            applyConfigFile.value.input.value = '';
        }
    }
};
</script>
