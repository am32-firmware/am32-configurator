import type { EscData } from '~/src/mcu';

export const useEscStore = defineStore('esc', () => {
    const count = ref(0);
    const expectedCount = ref(0);

    const escData = ref<EscData[]>([]);

    const validEscInfo = computed(() => escData.value.length > 0 ? escData.value.filter(e => !e.isError && !e.isLoading) : []);
    const selectedEscInfo = computed(() => validEscInfo.value.filter(e => e.data?.isSelected).map(e => e.data) ?? []);
    const firstValidEscData = computed(() => escData.value?.find(d => !d.isError && d.data));

    const settingsDirty = ref(false);
    const isSaving = ref(false);
    const isLoading = ref(false);

    const $reset = () => {
        count.value = 0;
        escData.value = [];
    };

    const activeTarget = ref(-1);
    const totalBytes = ref(0);
    const bytesWritten = ref(0);
    const step = ref('Writing');

    return { settingsDirty, isSaving, isLoading, count, expectedCount, escData, selectedEscInfo, validEscInfo, firstValidEscData, activeTarget, totalBytes, bytesWritten, step, $reset };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot));
}
