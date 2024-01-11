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
                <div v-if="allLoaded" class="p-4 max-w-[1400px] m-auto">
                    <div class="flex flex-col gap-4 justify-center">
                        <SettingFieldGroup class="w-[500px]" title="Essentials" :cols="1">
                            <SettingField
                                :esc-info="escStore.escInfo"
                                field="ESC_PROTOCOL"
                                name="Protocol"
                                type="select"
                                :options="protocolOptions"
                                placeholder="Select input protocol"
                                help="Help text"
                                @change="onSettingsChange"
                            ></SettingField>
                        </SettingFieldGroup>
                        <SettingFieldGroup title="Motor" :cols="3">
                            <SettingField
                                :esc-info="escStore.escInfo"
                                field="TIMING_ADVANCE"
                                name="Motor timing"
                                type="number"
                                :min="0"
                                :max="22.5"
                                :step="7.5"
                                :display-factor="7.5"
                                @change="onSettingsChange"
                            ></SettingField>
                            <SettingField
                                :esc-info="escStore.escInfo"
                                field="STARTUP_POWER"
                                name="Startup power"
                                type="number"
                                :min="50"
                                :max="150"
                                :step="1"
                                @change="onSettingsChange"
                            ></SettingField>
                            <SettingField
                                :esc-info="escStore.escInfo"
                                field="MOTOR_KV"
                                name="Motor KV"
                                type="number"
                                :min="20"
                                :max="10220"
                                :step="40"
                                :display-factor="40"
                                :offset="20"
                                @change="onSettingsChange"
                            ></SettingField>
                        </SettingFieldGroup>
                    </div>
                </div>
            </div>
        </div>
        <div v-else>
            <nav class="w-full border-b border-t flex justify-center">
                <ContentNavigation v-slot="{ navigation }">
                    <div
                        v-for="link of navigation"
                        :key="link._path"
                        class="py-4 transition-all hover:bg-slate-900 relative text-xl w-fit block after:block after:content-[''] after:bottom-0 after:absolute after:h-[3px] after:bg-white after:w-full after:scale-x-0 after:hover:scale-x-100 after:transition after:duration-300 after:origin-center">
                        <NuxtLink active-class="!bg-slate-800" class="p-4 transition-all bg-transparent" :to="link._path">{{ link.title }}</NuxtLink>
                    </div>
                </ContentNavigation>
            </nav>
            <div class="p-4 max-w-[1400px] m-auto prose prose-invert">
                <ContentDoc />
            </div>
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

const protocolOptions = [
    {
        value: 0,
        label: 'Auto',
    },
    {
        value: 1,
        label: 'DShot',
    },
    {
        value: 2,
        label: 'Servo',
    },
    {
        value: 3,
        label: 'Serial',
    },
    {
        value: 4,
        label: 'EDT ARM',
    },
];

const onSettingsChange = (payload: { field: EepromLayoutKeys, value: number }) => {
    if (escStore.escInfo[0].settings[payload.field] !== payload.value) {
        escStore.settingsDirty = true;
    }
    for (let i = 0; i < escStore.escInfo.length; ++i) {
        escStore.escInfo[i].settings[payload.field] = payload.value;
    }
}
</script>