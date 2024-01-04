export const useEscStore = defineStore('esc', () => {
    const count = ref(0);

    return { count }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useEscStore, import.meta.hot))
 }