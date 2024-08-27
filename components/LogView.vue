<template>
  <div ref="wrapper" class="p-2 overflow-auto">
    <div v-for="(entry, i) of logStore.entries" :key="i" class="flex flex-row gap-2">
      <div class="text-white">
        {{ dayjs(entry[0]).format('HH:mm:ss') }}
      </div>
      <div v-if="entry[2]">
        <div v-if="entry[2] === 'warning'">
          <UIcon name="i-material-symbols-light-warning" class="text-yellow-400" />
        </div>
        <div v-else-if="entry[2] === 'error'">
          <UIcon name="i-material-symbols-error" class="text-red-400" />
        </div>
      </div>
      <div class="text-left" :class="getTextColor(entry[2])">
        {{ entry[1] }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
const dayjs = useDayjs();
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
};

const scrollToBottom = () => {
    if (wrapper.value && wrapper.value.scrollHeight > wrapper.value?.scrollTop) {
        wrapper.value?.scrollTo({
            behavior: 'instant',
            top: wrapper.value.scrollHeight
        });
    }
};

useIntervalFn(() => {
    if (logStore.entries.length > lastLogLength.value) {
        scrollToBottom();
        lastLogLength.value = logStore.entries.length;
    }
}, 200);
</script>
