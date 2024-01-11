<template>
    <div class="grid grid-cols-12 text-white ">
        <div class="col-span-2 flex justify-center items-center">
            <svgo-logo-full class="text-white text-[150px]"></svgo-logo-full>
        </div>
        <div class="col-span-8 h-[200px] max-h-[200px]">
            <div class="h-full font-bold text-3xl text-red-800 flex flex-col">
                <div v-if="logStore.entries.length === 0">AlkaMotors</div>

                <Log v-else class="h-full overflow-auto"></Log>
            </div>
        </div>
        <div v-if="serialStore.hasSerial" class="col-span-2">
            <SerialDevice></SerialDevice>
        </div>
    </div>
    <div class="h-full">
        <slot></slot>
    </div>
</template>
<script setup lang="ts">
const serialStore = useSerialStore();
const logStore = useLogStore();
</script>