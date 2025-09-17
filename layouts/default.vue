<template>
  <div>
    <div>
      <div class="flex flex-col sm:flex-row text-white ">
        <div class="flex justify-center items-center">
          <div class="m-2 bg-red-800 min-w-[100px] max-h-[180px] rounded-2xl">
            <img :src="logo" class="max-h-[180px] w-auto">
          </div>
        </div>
        <div class="flex-grow hidden sm:block h-[200px] max-h-[200px]">
          <div class="h-full font-bold text-3xl text-red-800 flex flex-col">
            <div v-if="logStore.entries.length === 0">
              AlkaMotors
            </div>

            <Log v-else class="h-full overflow-auto" />
          </div>
        </div>
        <div v-if="serialStore.hasSerial" class="">
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
          v0.1.1
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
