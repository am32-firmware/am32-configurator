<template>
    <div class="h-full">
        <div v-if="!serialStore.hasSerial">
            <div class="text-3x text-red-500">
                WebSerial not supported! Please use other browser!
            </div>
        </div>
        <div v-else-if="serialStore.isFourWay" class="pt-4 h-full">
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
        <div v-else>
            <nav class="w-full border-b border-t flex justify-center">
                <ContentNavigation v-slot="{ navigation }">
                    <div v-for="link of navigation" :key="link._path" class="py-4 transition-all hover:bg-slate-900">
                        <NuxtLink active-class="!bg-slate-800" class="p-4 transition-all bg-transparent" :to="link._path">{{ link.title }}</NuxtLink>
                    </div>
                </ContentNavigation>
            </nav>
            <ContentDoc />
        </div>
    </div>
</template>
<script setup lang="ts">
import type { EepromLayoutKeys } from '~/src/eeprom';

const serialStore = useSerialStore();
const escStore = useEscStore();

const hasEsc = (n: number) => {
    return !!escStore.escData[n] && !!escStore.escInfo[n];
}

const allLoaded = computed(() => escStore.escInfo.length > 0 && escStore.escInfo.length === escStore.count && !escStore.escData.find((e) => e.isLoading === true));

const onChange = (payload: { index: number, field: EepromLayoutKeys, value: boolean }) => {
    escStore.escInfo[payload.index].settingsDirty = escStore.escInfo[payload.index].settings[payload.field] !== (payload.value ? 1 : 0)
    escStore.escInfo[payload.index].settings[payload.field] = (payload.value ? 1 : 0);
}
</script>