<template>
    <div class="m-auto w-[1000px]">
        <div v-if="!serialStore.hasSerial">
            <div class="text-3x text-red-500">
                WebSerial not supported! Please use other browser!
            </div>
        </div>
        <div v-else class="pt-4 h-full">
            <div v-if="serialStore.isFourWay" class="h-full">
                <div class="flex gap-4 w-full justify-center">
                    <div v-for="n of escStore.count">
                        <EscView :is-loading="!hasEsc(n - 1)" :index="n - 1" :esc="escStore.escData[n - 1]" :mcu="escStore.escInfo[n - 1]"></EscView>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">

const serialStore = useSerialStore();
const escStore = useEscStore();

const hasEsc = (n: number) => {
    return !!escStore.escData[n] && !!escStore.escInfo[n];
}
</script>