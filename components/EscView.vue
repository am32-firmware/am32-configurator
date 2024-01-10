<template>
    <div class="h-[150px] w-[400px] p-4 border bg-slate-500 border-slate-900 rounded-xl">
        <div class="h-full">
            <div class="text-gray-400 mb-4 flex gap-2">
                <div>
                    <UBadge :color="badgeColor">
                        <UIcon :name="iconName" dynamic class="text-white h-[20px] w-[20px]"></UIcon>
                    </UBadge>
                </div>
                <USkeleton v-if="isLoading" class="h-[30px] w-full"></USkeleton>
                <div class="text-gray-700 font-bold text-lg" v-else-if="esc?.isLoading">Loading ...</div>
                <div class="text-gray-700 w-full flex items-start gap-6" v-else-if="mcu?.bootloader.pin">
                    <div>
                        <div class="font-bold">Bootloader</div>
                        <div class="grid grid-cols-3 text-xs">
                            <div class="col-span-2">PIN</div>
                            <div class="">{{ mcu.bootloader.pin }}</div>
                        </div>
                        <div class="grid grid-cols-3 text-xs">
                            <div class="col-span-2">Version</div>
                            <div>{{ mcu.bootloader.version }}</div>
                        </div>
                    </div>
                    <div>
                        <div class="font-bold">MCU</div>
                        <div class="text-xs">
                            <div>{{ mcu?.meta.am32.mcuType }}</div>
                        </div>
                    </div>
                    <div>
                        <div class="font-bold">Firmware</div>
                        <div class="grid grid-cols-5 text-xs">
                            <div class="col-span-2">Name</div>
                            <div class="col-span-3">{{ mcu?.meta.am32.fileName }}</div>
                            <div class="col-span-2">Version</div>
                            <div class="col-span-3">{{ getSettingValue('MAIN_REVISION') }}.{{ getSettingValue('SUB_REVISION') }}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="esc?.isLoading" class="flex justify-center items-center h-[calc(100%-46px)]">
                <UIcon class="text-gray-700 w-[40px] h-[40px]" name="i-svg-spinners-blocks-wave" dynamic></UIcon>
            </div>
            <div v-else-if="mcu">
                <div>
                    <UCheckbox v-model="isReversed" label="Reversed"></UCheckbox>
                </div>
                <div>
                    <UCheckbox v-model="is3DMode" label="3D mode"></UCheckbox>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';
import type { McuInfo } from '~/src/mcu';

const props = defineProps<{
    isLoading: boolean,
    index: number,
    esc: EscData | null | undefined,
    mcu: McuInfo | null | undefined
}>()

const emit = defineEmits<{
    (e: 'change', value: { index: number, field: EepromLayoutKeys, value: boolean }): void
}>();

const iconName = computed(() => `i-material-symbols-counter-${props.index + 1}-outline`);

const badgeColor = computed(() => {
    let color = 'green';
    if (!props.esc) {
        color = 'red';
    } else if (props.isLoading) {
        color = 'yellow';
    }
    return color;
});

const isReversed = computed({
    get: () => (getSettingValue<number>('MOTOR_DIRECTION') ?? 0) === 1,
    set (value) {
        emit('change', {
            index: props.index,
            field: 'MOTOR_DIRECTION',
            value
        })
    }
});

const is3DMode = computed({
    get: () => (getSettingValue<number>('BIDIRECTIONAL_MODE') ?? 0) === 1,
    set (value) {
        emit('change', {
            index: props.index,
            field: 'BIDIRECTIONAL_MODE',
            value
        })
    }
});

function getSettingValue<T>(name: EepromLayoutKeys): T | null {
    return props.mcu?.settings[name] as T ?? null;
}
</script>