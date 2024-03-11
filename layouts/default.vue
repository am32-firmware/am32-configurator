<template>
  <div>
    <div>
      <div class="grid grid-cols-12 text-white ">
        <div class="col-span-2 flex justify-center items-center">
          <svgo-logo-full class="text-white text-[150px]" />
        </div>
        <div class="col-span-8 h-[200px] max-h-[200px]">
          <div class="h-full font-bold text-3xl text-red-800 flex flex-col">
            <div v-if="logStore.entries.length === 0">
              AlkaMotors
            </div>

            <Log v-else class="h-full overflow-auto" />
          </div>
        </div>
        <div v-if="serialStore.hasSerial" class="col-span-2">
          <SerialDevice />
        </div>
      </div>
      <div class="fixed bottom-0 left-0 right-0 flex justify-between p-2 z-10 bg-gray-800">
        <div class="text-center min-w-[200px]">
          AM32 Configurator
        </div>
        <div class="text-center min-w-[300px]">
          powered by Nuxt and Vercel
        </div>
        <div class="text-center min-w-[200px]">
          v0.0.1
        </div>
      </div>
    </div>
    <slot />
  </div>
</template>
<script setup lang="ts">
const serialStore = useSerialStore();
const logStore = useLogStore();
</script>
