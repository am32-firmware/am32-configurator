<template>
  <div class="dark min-h-screen">
    <NuxtLayout v-if="serialStore.hasSerial">
      <NuxtPage />
    </NuxtLayout>
    <div v-else>
      No WebSerial
    </div>
    <footer class="absolute bottom-0 w-full bg-gray-800">
      <div class="grid grid-cols-3 leading-loose">
        <div class="text-center">AM32 Configurator</div>
        <div class="text-center">
          powered by Nuxt and Netlify
        </div>
        <div class="text-center">v0.0.1</div>
      </div>
    </footer>
  </div>
</template>
<script setup>
import { FourWay } from './src/communication/four_way';
import Msp from './src/communication/msp';
const serialStore = useSerialStore();
const { log, logWarning, logError } = useLogStore();

if ('serial' in navigator) {
  serialStore.hasSerial = true;
  Msp.init(log, logWarning, logError);
  FourWay.init(log, logWarning, logError);
  
  log('initializing...');
} else {
  logError("WebSerial not supported, use other browser!")
}
</script>