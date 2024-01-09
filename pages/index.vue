<template>
    <div class="h-full">
        <div v-if="!serialStore.hasSerial">
            <div class="text-3x text-red-500">
                WebSerial not supported! Please use other browser!
            </div>
        </div>
        <div v-else class="pt-4 h-full">
            <div v-if="serialStore.isFourWay" class="h-full">
                <div class="flex gap-4 w-full justify-center">
                    <div v-for="n of escStore.count">
                        <EscView :is-loading="!hasEsc(n - 1)" :index="n - 1" :esc="escStore.escData[n - 1]" :mcu="escStore.escInfo[n - 1]" @change="onChange"></EscView>
                    </div>
                </div>
                <div v-if="allLoaded">
                    settings
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { FourWay } from '~/src/communication/four_way';
import type { EepromLayoutKeys } from '~/src/eeprom';

const serialStore = useSerialStore();
const escStore = useEscStore();

const hasEsc = (n: number) => {
    return !!escStore.escData[n] && !!escStore.escInfo[n];
}

const allLoaded = computed(() => escStore.escInfo.length === escStore.count && !escStore.escData.find((e) => e.isLoading === true));

const onChange = (payload: { index: number, field: EepromLayoutKeys, value: boolean }) => {
    FourWay.getInstance()
}
</script>