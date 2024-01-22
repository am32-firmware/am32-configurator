<template>
  <div class="relative min-w-[100px] min-h-[50px] border border-gray-600 rounded ">
    <div class="absolute -top-3 left-5 bg-gray-950 px-2">
      {{ title }}
    </div>
    <div class="flex">
      <div v-if="switches.length > 0" class="p-4">
        <div v-for="{ field, name } of switches" :key="field">
          <UCheckbox :label="name" :value="model(field).value" @update:model-value="model(field).value = $event" />
        </div>
      </div>
      <div class="flex-grow grid gap-4 p-4" :class="`grid-cols-${cols}`">
        <slot />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';

const escStore = useEscStore();

interface SwitchType {
  field: EepromLayoutKeys;
  name: string;
}

interface SettingFieldGroupProps {
    title: string;
    cols: number;
    switches: SwitchType[];
}

const emits = defineEmits<{(e: 'change', value: { field: EepromLayoutKeys, value: number }): void}>();

withDefaults(defineProps<SettingFieldGroupProps>(), {
    title: '',
    cols: 3,
    switches: () => []
});

const model = (field: EepromLayoutKeys) => computed({
    get: () => {
        return escStore.escInfo[0].settings[field];
    },
    set: (_val) => {
        emits('change', {
            value: escStore.escInfo[0].settings[field] === 0 ? 1 : 0,
            field
        });
        console.log(escStore.escInfo[0].settings[field]);
    }
});
</script>
