import type { McuInfo } from "~/src/mcu";

export const useEscStore = defineStore('esc', () => {
    const count = ref(0);

    const escData = ref<EscData[]>([]);

    let escInfo = reactive<McuInfo[]>([]);

    const settingsDirty = ref(false);

    const $reset = () => {
        count.value = 0;
        escData.value = [];
        escInfo = [];
    }

    return { settingsDirty, count, escData, escInfo, $reset }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot))
 }