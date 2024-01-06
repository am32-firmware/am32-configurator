export const useEscStore = defineStore('esc', () => {
    const count = ref(0);

    const escData = reactive<EscData[]>([]);

    const escInfo = reactive<McuInfo[]>([]);

    return { count, escData, escInfo }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot))
 }