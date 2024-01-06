<template>
    <div class="h-[150px] w-[200px] p-4 border bg-slate-500 border-slate-900 rounded-xl">
        <div class="h-full">
            <div class="text-gray-400 mb-4 flex gap-2">
                <UBadge :color="badgeColor">
                    <UIcon :name="iconName" dynamic class="text-white h-[20px] w-[20px]"></UIcon>
                </UBadge>
                <USkeleton v-if="isLoading" class="h-[20px] w-full"></USkeleton>
                <div class="text-gray-700 font-bold text-lg" v-else-if="esc?.isLoading">Loading ...</div>
                <div class="text-gray-700 font-bold text-xs" v-else>{{ mcu?.meta.am32.fileName }}<br />{{ mcu?.meta.am32.mcuType }}</div>
            </div>
            <USkeleton v-if="isLoading" class="h-[20px] w-full"></USkeleton>
            <USkeleton v-if="isLoading" class="h-[20px] w-1/2 mt-2"></USkeleton>
            <div v-if="esc?.isLoading" class="flex justify-center items-center h-[calc(100%-46px)]">
                <UIcon class="text-gray-700 w-[40px] h-[40px]" name="i-svg-spinners-blocks-wave" dynamic></UIcon>
            </div>
            <div v-else>
                {{ mcu }}
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
const props = defineProps<{
    isLoading: boolean,
    index: number,
    esc: EscData | null,
    mcu: McuInfo | null
}>()

const iconName = computed(() => `i-material-symbols-counter-${props.index}-outline`);

const badgeColor = computed(() => {
    let color = 'green';
    console.log(props.esc);
    if (!props.esc) {
        color = 'red';
    } else if (props.isLoading) {
        color = 'yellow';
    }
    return color;
});
</script>