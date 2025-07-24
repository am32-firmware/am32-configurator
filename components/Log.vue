<script setup lang="ts">
const logModal = ref(false);
</script>
<template>
  <div class="bg-gray-900 rounded-xl p-1 h-full relative">
    <div class="flex flex-col text-sm h-full flex-1">
      <LogView />
    </div>
    <div class="absolute top-2 -right-5 size-[60px]">
      <UIcon
        name="i-ph-arrows-out"
        class="drop-shadow-sm cursor-pointer transition-all hover:text-red-500 active:text-red-950"
        @click="logModal = true"
      />
    </div>
    <UModal
      v-model="logModal"
      :ui="{
        width: 'w-full sm:max-w-xl',
      }"
    >
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 text-white">Log</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              class="-my-1"
              @click="logModal = false"
            />
          </div>
        </template>
        <LogView class="w-full max-h-[1000px] overflow-auto" />
      </UCard>
    </UModal>
  </div>
</template>
