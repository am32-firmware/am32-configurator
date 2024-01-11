<template>
    <div class="relative">
        <UFormGroup>
            <template #label>
                <div class="flex items-center gap-1 mb-1">
                    <div>{{ name }}</div>
                    <UTooltip v-if="help" :text="help" :popper="{ placement: 'right' }">
                        <UIcon name="i-material-symbols-help-outline" class="text-blue-500 text-lg"></UIcon>
                    </UTooltip>
                </div>
            </template>
            <div v-if="type === 'select'">
                <USelect v-model="value" :options="options" :placeholder="placeholder"></USelect>
            </div>
            <UToggle v-else-if="type === 'bool'"></UToggle>
            <div v-else-if="type === 'number'">
                <URange v-model="value" :min="min" :max="max" :step="step"></URange>
                <div>{{ value }}</div>
            </div>
        </UFormGroup>
        <div v-if="otherValues && otherValues.length > 0" class="absolute top-0 right-0 flex gap-1">
            <div v-for="o of otherValues">
                <div class="w-[10px] h-[10px] rounded-full" :class="{
                    'bg-green-500': getCompareValue(o) === value,
                    'bg-red-500': getCompareValue(o) !== value,
                }"></div>
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
}

const props = withDefaults(defineProps<SettingFieldProps>(), {
    displayFactor: 1,
    offset: 0
});

const emits = defineEmits<{
    (e: 'change', value: { field: EepromLayoutKeys, value: number }): void
}>();

const value = computed({
    get: () => {
        let value = props.escInfo[0].settings[props.field] as number;
        if (props.type === 'number') {
            value = value * props.displayFactor + props.offset;
        }
        console.log(value, props.type, props.displayFactor, props.offset);
        return value;
    },
    set: (val) => {
        let value = val;
        if (props.type === 'number') {
            value = Math.round((value - props.offset) / props.displayFactor)
        }
        console.log(value);
        emits('change', {
            field: props.field,
            value
        });
    }
})

const getCompareValue = (value: number) => {
    return props.type === 'number' ? value * props.displayFactor + props.offset : value;
}

const otherValues = computed(() => props.escInfo?.map(i => i.settings[props.field]) as number[] ?? []);
</script>