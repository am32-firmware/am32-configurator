<template>
  <div>
    <div>
      <div class="max-w-[1400px] p-4 grid grid-rows-[80px_140px_200px] sm:grid-rows-[140px_200px] lg:grid-rows-[200px] grid-cols-1 sm:grid-cols-[auto_1fr] lg:grid-cols-[200px_1fr_320px] gap-y-4 sm:gap-x-4 mx-auto text-white">
        <img :src="logo" class="h-full col-start-1 aspect-auto rounded-2xl bg-red-800 justify-self-center">

        <div class="h-full row-start-3 sm:row-start-2 lg:row-start-1 col-start-1 col-span-2 lg:col-start-2 lg:col-span-1 flex flex-col text-red-800 font-bold text-3xl">
          <span v-if="logStore.entries.length === 0">
            AlkaMotors
          </span>
          <Log v-else class="overflow-auto h-full" />
        </div>

        <div v-if="serialStore.hasSerial" class="h-full row-start-2 sm:row-start-1 col-start-1 sm:col-start-2 lg:col-start-3">
          <SerialDevice />
        </div>
      </div>
      <div class="fixed bottom-0 left-0 right-0 flex justify-between p-2 z-10 bg-gray-800">
        <div class="text-center min-w-[200px]">
          AM32 Configurator
        </div>
        <div class="text-center min-w-[300px] flex items-center gap-4">
          <div>
            <NuxtLink class="underline" to="https://github.com/am32-firmware/am32" target="_blank" external>
              Repository
            </NuxtLink>
          </div>
          <div>
            powered by <NuxtLink class="underline" to="https://nuxt.com/" target="_blank" external>
              Nuxt
            </NuxtLink>
          </div>
        </div>
        <div class="text-center min-w-[200px]">
          v0.1.0
        </div>
      </div>
    </div>
    <TopNavigation />
    <div class="max-w-[1920px] m-auto">
      <slot />
    </div>
  </div>
</template>
<script setup lang="ts">
import logo from '~/assets/icons/am32-logo.svg';
const serialStore = useSerialStore();
const logStore = useLogStore();
</script>
