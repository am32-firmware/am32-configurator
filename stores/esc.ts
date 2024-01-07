export const useEscStore = defineStore('esc', () => {
    const count = ref(0);

    const escData = ref<EscData[]>([]);

    const escInfo = ref<McuInfo[]>([]);

    const $reset = () => {
        count.value = 0;
        escData.value = [];
        escInfo.value = [];
    }

    return { count, escData, escInfo, $reset }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot))
 }