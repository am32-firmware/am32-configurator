<template>
  <div
    class="relative"
    :class="{
      'before:content-[\'\'] before:absolute before:inset-0 blur-[2px]': isDisabled
    }"
  >
    <UFormGroup>
      <template #label>
        <div class="flex items-center gap-1 mb-1">
          <div>{{ name }}</div>
          <UTooltip v-if="help" :text="help" :popper="{ placement: 'right' }">
            <UIcon name="i-material-symbols-help-outline" class="text-blue-500 text-lg" />
          </UTooltip>
        </div>
      </template>
      <div v-if="type === 'select'">
        <USelect v-model="value" :disabled="isDisabled" :options="options" :placeholder="placeholder" />
      </div>
      <UToggle v-else-if="type === 'bool'" v-model="boolValue" :disabled="isDisabled" />
      <div v-else-if="type === 'number'">
        <URange
          v-model="value"
          :disabled="isDisabled"
          :min="min"
          :max="max"
          :step="step"
          :color="value === disabledValue ? 'orange' : 'primary'"
        />
      </div>
      <slot name="unit" :unit="unit" :value="value">
        <div v-if="unit || showValue" class="flex">
          <div v-if="value === disabledValue">
            DISABLED
          </div>
          <div v-else>
            {{ value }}
          </div>
          <div v-if="unit">
            {{ unit }}
          </div>
        </div>
      </slot>
    </UFormGroup>
    <div v-if="otherValues && otherValues.length > 0" class="absolute top-0 right-0 pt-1 flex gap-1">
      <div v-for="(o, i) of otherValues" :key="i">
        <div
          class="w-[10px] h-[10px] rounded-full"
          :class="{
            'bg-green-500': getCompareValue(o) === value,
            'bg-red-500': getCompareValue(o) !== value,
          }"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';
import type { McuInfo } from '~/src/mcu';

interface SettingFieldProps {
    name: string;
    type: SettingsType;
    escInfo: McuInfo[];
    field: EepromLayoutKeys;
    placeholder?: string;
    description?: string;
    help?: string;
    options?: SettingsSelectOptionsType[];
    min?: number;
    max?: number;
    step?: number;
    displayFactor?: number;
    offset?: number;
    unit?: string;
    showValue?: boolean;
    disabled?: boolean | ((value: number) => boolean),
    disabledValue?: number,
}

const props = withDefaults(defineProps<SettingFieldProps>(), {
    displayFactor: 1,
    offset: 0,
    placeholder: undefined,
    description: undefined,
    help: undefined,
    options: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    unit: undefined,
    showValue: false,
    disabled: false
});

const emits = defineEmits<{(e: 'change', value: { field: EepromLayoutKeys, value: number }): void}>();

const isDisabled = computed(() => {
    if (props.disabled) {
        if (typeof props.disabled === 'function') {
            return props.disabled(value.value);
        }
        return props.disabled;
    }
    return false;
});

const value = computed({
    get: () => {
        let value = props.escInfo[0].settings[props.field] as number;
        if (props.type === 'number') {
            value = value * props.displayFactor + props.offset;
        }
        return value;
    },
    set: (val) => {
        let value = val;
        if (props.type === 'number') {
            value = Math.round((value - props.offset) / props.displayFactor);
        }
        emits('change', {
            field: props.field,
            value
        });
    }
});

const boolValue = computed({
    get: () => {
        return props.escInfo[0].settings[props.field] as number === 1;
    },
    set: (val) => {
        value.value = val ? 1 : 0;
    }
});

const getCompareValue = (value: number) => {
    return props.type === 'number' ? value * props.displayFactor + props.offset : value;
};

const otherValues = computed(() => props.escInfo?.map(i => i.settings[props.field]) as number[] ?? []);
</script>
