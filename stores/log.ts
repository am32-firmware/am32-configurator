import { defineStore, acceptHMRUpdate } from 'pinia';

export const useLogStore = defineStore('log', () => {
    const entries = ref<LogMessage[]>([]);
    function addLogEntry (text: string, type?: LogMessageType) {
        entries.value.push(
            [new Date(), text, type]
        );
    }

    function log (text: string) {
        return addLogEntry(text);
    }

    function logWarning (text: string) {
        return addLogEntry(text, 'warning');
    }

    function logError (text: string) {
        return addLogEntry(text, 'error');
    }
    return { addLogEntry, log, logWarning, logError, entries };
});

export type LogStore = ReturnType<typeof useLogStore>;

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useLogStore, import.meta.hot));
}
