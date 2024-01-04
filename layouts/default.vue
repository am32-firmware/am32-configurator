<template>
    <div class="h-[150px] grid grid-cols-12 bg-black text-white">
        <div class="col-span-2">
            <img src="/assets/images/logo.svg" class="bg-white h-[150px] w-auto">
        </div>
        <div class="col-span-8">
            <div class="h-full font-bold text-3xl text-red-800 flex flex-col">
                <div v-if="logStore.entries.length === 0">AlkaMotors</div>

                <Log class="h-full max-h-[150px] overflow-auto"></Log>
            </div>
        </div>
        <div v-if="serialStore.hasSerial" class="col-span-2">
            <SerialDevice></SerialDevice>
        </div>
    </div>
    <div>
        <slot></slot>
    </div>
</template>
<script setup lang="ts">
const serialStore = useSerialStore();
const logStore = useLogStore();
</script>