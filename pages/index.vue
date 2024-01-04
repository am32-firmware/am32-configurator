<template>
    <div class="m-auto w-[800px]">
        <div v-if="!serialStore.hasSerial">
            <div class="text-3x text-red-500">
                WebSerial not supported! Please use other browser!
            </div>
        </div>
        <div v-else class="pt-4">
        </div>
    </div>
</template>
<script setup>
const serialStore = useSerialStore();
const logStore = useLogStore();

if (!navigator.serial) {
    logStore.addLogEntry("WebSerial not supported, use other browser!", 'error')
    serialStore.setHasSerial(false)
} else {
    serialStore.setHasSerial(true);
}
</script>