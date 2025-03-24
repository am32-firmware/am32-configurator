<template>
  <div class="relative min-w-[100px] min-h-[50px] border border-gray-600 rounded ">
    <div class="absolute -top-3 left-5 bg-gray-950 px-2">
      {{ title }}
    </div>
    <div class="flex">
      <div v-if="switches.length > 0" class="p-4">
        <div v-for="{ field, name, setValue } of filteredSwitches" :key="field">
          <UCheckbox :label="name" :model-value="model(field, setValue).value" />
        </div>
      </div>
      <div class="flex-grow grid gap-4 p-4" :class="`grid-cols-${cols}`">
        <slot />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { coerce, compare } from 'semver';
import type { EepromLayoutKeys } from '~/src/eeprom';

const escStore = useEscStore();

interface SwitchType {
  field: EepromLayoutKeys;
  name: string;
  setValue?: number;
  minEepromVersion?: number;
  minFirmwareVersion?: string;
}

interface SettingFieldGroupProps {
    title: string;
    cols: number;
    eepromVersion?: number;
    firmwareVersion?: string;
    switches?: SwitchType[];
}

const emits = defineEmits<{(e: 'change', value: { field: EepromLayoutKeys, value: number }): void}>();

const props = withDefaults(defineProps<SettingFieldGroupProps>(), {
    title: '',
    cols: 3,
    eepromVersion: 0,
    firmwareVersion: '',
    switches: () => []
});

const semverFirmwareVersion = props.firmwareVersion?.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2') ?? '0.0';

const filteredSwitches = computed(() => props.switches
    .filter(s => (!s.minEepromVersion || props.eepromVersion >= s.minEepromVersion) &&
                (!s.minFirmwareVersion || compare(coerce(semverFirmwareVersion)!, coerce(s.minFirmwareVersion)!) >= 0))
);

const model = (field: EepromLayoutKeys, setValue?: number) => computed({
    get: () => {
        return (escStore.firstValidEscData?.data.settings[field] ?? 0) as number > 0;
    },
    set: (_val) => {
        emits('change', {
            value: [0, 255].includes((escStore.firstValidEscData?.data.settings[field] ?? 0) as number) ? (setValue ?? 1) : 0,
            field
        });
    }
});
</script>
