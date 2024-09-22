<template>
  <div
    class="min-h-[150px] min-w-[400px] p-4 border border-slate-900 rounded-xl cursor-pointer ring-4"
    :class="{
      'ring-red-500': mcu?.isSelected && mcu.settingsDirty,
      'ring-green-500': mcu?.isSelected && !mcu.settingsDirty,
      'ring-gray-500': !mcu?.isSelected,
      'bg-slate-500': !isEscError,
      'bg-red-100': isEscError
    }"
    @click="toggleSelected"
  >
    <div class="h-full">
      <div class="text-gray-400 mb-4 flex gap-2">
        <div>
          <UBadge :color="!esc || isEscError ? 'red' : (isLoading ? 'yellow' : 'green')">
            <UIcon :name="iconName" dynamic class="text-white h-[20px] w-[20px]" />
          </UBadge>
        </div>
        <USkeleton v-if="isLoading && !esc?.isError" class="h-[30px] w-full" />
        <div v-else-if="esc?.isLoading" class="text-gray-700 font-bold text-lg">
          Loading ...
        </div>
        <div v-else-if="esc?.isError" class="text-black text-xl">
          ESC did not respond!
        </div>
        <div v-else-if="mcu?.bootloader.pin" class="text-gray-700 w-full flex flex-wrap items-start gap-6">
          <div>
            <div class="font-bold">
              Bootloader
            </div>
            <div class="grid grid-cols-3 text-xs">
              <div class="col-span-2">
                PIN
              </div>
              <div class="">
                {{ mcu.bootloader.pin }}
              </div>
            </div>
            <div class="grid grid-cols-3 text-xs">
              <div class="col-span-2">
                Version
              </div>
              <div>{{ mcu.bootloader.version }}</div>
            </div>
          </div>
          <div>
            <div class="font-bold">
              MCU
            </div>
            <div class="text-xs">
              <div>Type: {{ mcu?.meta.am32.mcuType }}</div>
            </div>
            <div class="text-xs">
              <div>EEPROM: v{{ layoutVersion }}</div>
            </div>
          </div>
          <div>
            <div class="font-bold">
              Firmware
            </div>
            <div class="grid grid-cols-5 text-xs">
              <div class="col-span-2">
                Name
              </div>
              <div class="col-span-3">
                {{ mcu?.meta.am32.fileName }}
              </div>
              <div class="col-span-2">
                Version
              </div>
              <div class="col-span-3">
                {{ getSettingValue('MAIN_REVISION') }}.{{ padVersion(getSettingValue<number>('SUB_REVISION') ?? 0) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="esc?.isLoading" class="flex justify-center items-center h-[calc(100%-46px)]">
        <UIcon class="text-gray-700 w-[40px] h-[40px]" name="i-svg-spinners-blocks-wave" dynamic />
      </div>
      <div v-else-if="mcu" class="">
        <div v-if="mcu?.settingsBuffer[0] === 0x01">
          <div>
            <UCheckbox v-model="isReversed" label="Reversed" />
          </div>
          <div>
            <UCheckbox v-model="is3DMode" label="3D mode" />
          </div>
        </div>
        <div v-if="mcu?.settingsBuffer[0] === 0x00" class="flex items-center justify-center gap-4">
          <UIcon name="i-heroicons-exclamation-triangle-16-solid" class="w-10 h-10 text-red-700" /> 
          <div class="text-red-700 font-bold">
            <p>Flash was unsuccessfull.</p>
            <p>Reflash firmware to fix</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';
import type { EscData } from '~/src/mcu';

const props = defineProps<{
    isLoading: boolean,
    index: number,
    esc: EscData | null | undefined
}>();

const emit = defineEmits<{(e: 'change', value: { index: number, field: EepromLayoutKeys, value: boolean }): void,
(e: 'toggle', value: number): void
}>();

const iconName = computed(() => `i-material-symbols-counter-${props.index + 1}-outline`);
const isEscError = computed(() => props.esc?.isError || props.esc?.data.settingsBuffer[0] === 0x00);

const mcu = computed(() => props.esc?.data);

const isReversed = computed({
    get: () => (getSettingValue<number>('MOTOR_DIRECTION') ?? 0) === 1,
    set (value) {
        emit('change', {
            index: props.index,
            field: 'MOTOR_DIRECTION',
            value
        });
    }
});

const is3DMode = computed({
    get: () => (getSettingValue<number>('BIDIRECTIONAL_MODE') ?? 0) === 1,
    set (value) {
        emit('change', {
            index: props.index,
            field: 'BIDIRECTIONAL_MODE',
            value
        });
    }
});

const layoutVersion = computed(() => getSettingValue<number>('LAYOUT_REVISION'));

function getSettingValue<T> (name: EepromLayoutKeys): T | null {
    return mcu.value?.settings[name] as T ?? null;
}

const padVersion = (version: number) => {
    return padStr(version + '', 2, '0');
};

const toggleSelected = () => {
    emit('toggle', props.index);
};
</script>
