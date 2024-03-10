import type { McuInfo } from '~/src/mcu';

export const useEscStore = defineStore('esc', () => {
    const count = ref(0);

    const escData = ref<EscData[]>([]);

    let escInfo = reactive<McuInfo[]>([]);

    const settingsDirty = ref(false);
    const isSaving = ref(false);

    const $reset = () => {
        count.value = 0;
        escData.value = [];
        escInfo = [];
    };

    const activeTarget = ref(-1);
    const totalBytes = ref(0);
    const bytesWritten = ref(0);

    return { settingsDirty, isSaving, count, escData, escInfo, activeTarget, totalBytes, bytesWritten, $reset };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot));
}
