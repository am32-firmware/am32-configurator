<template>
  <div>
    <div>
      <div class="grid grid-cols-12 text-white ">
        <div class="col-span-2 flex justify-center items-center">
          <div class="bg-red-800 max-h-[180px] rounded-2xl">
            <img :src="logo" class="max-h-[180px] w-auto">
          </div>
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
        <div class="text-center min-w-[300px] flex gap-4">
          <div>
            <NuxtLink class="underline" to="https://github.com/am32-firmware/am32" target="_blank" external>
              Repository
            </NuxtLink>
          </div>
          <div>
            powered by <NuxtLink class="underline" to="https://nuxt.com/" target="_blank" external>
              Nuxt
            </NuxtLink> and <NuxtLink class="underline" to="https://netlify.com" target="_blank" external>
              Netlify
            </NuxtLink>
          </div>
        </div>
        <div class="text-center min-w-[200px]">
          v0.0.2
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
