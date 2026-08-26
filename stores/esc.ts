import type { EscData } from '~/src/mcu';

export const useEscStore = defineStore('esc', () => {
    const count = ref(0);
    const expectedCount = ref(0);

    const escData = ref<EscData[]>([]);

    const selectedEscInfo = computed(() => escData.value.filter(e => !e.isError && e.data?.isSelected).map(e => e.data) ?? []);
    // escData indices (== four-way targets) behind each selectedEscInfo
    // position, so UI selections over the filtered list can be mapped back
    // to the right physical ESC
    const selectedEscIndices = computed(() => escData.value
        .map((e, i) => (!e.isError && e.data?.isSelected) ? i : -1)
        .filter(i => i >= 0));
    const firstValidEscData = computed(() => escData.value?.find(d => !d.isError && d.data));

    const settingsDirty = ref(false);
    const isSaving = ref(false);
    const isLoading = ref(false);

    const activeTarget = ref(-1);
    const totalBytes = ref(0);
    const bytesWritten = ref(0);
    const step = ref('Writing');

    const $reset = () => {
        count.value = 0;
        expectedCount.value = 0;
        escData.value = [];

        activeTarget.value = -1;
        totalBytes.value = 0;
        bytesWritten.value = 0;
        step.value = 'Writing';
    };

    return { settingsDirty, isSaving, isLoading, count, expectedCount, escData, selectedEscInfo, selectedEscIndices, firstValidEscData, activeTarget, totalBytes, bytesWritten, step, $reset };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot));
}
