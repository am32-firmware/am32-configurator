import type { McuInfo } from '~/src/mcu';

export const useEscStore = defineStore('esc', () => {
    const count = ref(0);

    const escData = ref<EscData[]>([]);

    const escInfo = ref<McuInfo[]>([]);
    const selectedEscInfo = computed(() => escInfo.value.length > 0 ? escInfo.value.filter(e => e.isSelected) : []);

    const settingsDirty = ref(false);
    const isSaving = ref(false);

    const $reset = () => {
        count.value = 0;
        escData.value = [];
        escInfo.value = [];
    };

    const activeTarget = ref(-1);
    const totalBytes = ref(0);
    const bytesWritten = ref(0);
    const step = ref('Writing');

    return { settingsDirty, isSaving, count, escData, escInfo, selectedEscInfo, activeTarget, totalBytes, bytesWritten, step, $reset };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot));
}
