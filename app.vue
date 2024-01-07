<template>
  <div class="dark">
    <NuxtLayout v-if="serialStore.hasSerial">
      <NuxtPage />
    </NuxtLayout>
    <div v-else>
      No WebSerial
    </div>
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