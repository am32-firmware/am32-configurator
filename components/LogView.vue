<template>
    <div ref="wrapper" class="p-2 overflow-auto">
        <div v-for="(entry, i) of logStore.entries" class="flex flex-row">
            <div class="w-[50px] text-center text-white">
                #{{ i }}
            </div>
            <div class="w-[20px] text-center">
                <div v-if="entry[2] === 'warning'">w</div>
                <div v-else-if="entry[2] === 'error'">e</div>
            </div>
            <div class="flex-grow" :class="getTextColor(entry[2])">
                {{ $dayjs(entry[0]).format('HH:mm:ss') }} - {{ entry[1] }}
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
const logStore = useLogStore();
const lastLogLength = ref(0);
const wrapper = ref<HTMLDivElement>();

const getTextColor = (type: LogMessageType) => {
    switch (type) {
        case 'warning':
            return 'text-orange-500';
        case 'error':
            return 'text-red-500';
        default:
            return 'text-white';
    }
}

const scrollToBottom = () => {
    if(wrapper.value && wrapper.value.scrollHeight > wrapper.value?.scrollTop) {
        wrapper.value?.scrollTo({
            behavior: 'instant',
            top: wrapper.value.scrollHeight
        })
    }
}

useIntervalFn(() => {
    if (logStore.entries.length > lastLogLength.value) {
        scrollToBottom();
        lastLogLength.value = logStore.entries.length;
    }
}, 200)
</script>