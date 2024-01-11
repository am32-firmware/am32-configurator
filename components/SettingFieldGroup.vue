<template>
    <div class="relative min-w-[100px] min-h-[50px] border border-gray-600 rounded ">
        <div class="absolute -top-3 left-5 bg-gray-950 px-2">
            {{ title }}
        </div>
        <div class="grid gap-4 p-4" :class="`grid-cols-${cols}`">
            <slot></slot>
        </div>
    </div>
</template>
<script setup lang="ts">
const props = defineProps<{
    title: string;
    cols: number;
}>();
</script>