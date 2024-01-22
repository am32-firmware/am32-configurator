<template>
  <NuxtPwaManifest />
  <div class="min-h-screen bg-gray-950">
    <NuxtLayout v-if="serialStore.hasSerial" class="h-full">
      <NuxtPage />
    </NuxtLayout>
    <div v-else>
      No WebSerial
    </div>
    <footer class="absolute bottom-0 w-full bg-gray-800">
      <div class="grid grid-cols-3 leading-loose">
        <div class="text-center">
          AM32 Configurator
        </div>
        <div class="text-center">
          powered by Nuxt and Netlify
        </div>
        <div class="text-center">
          v0.0.1
        </div>
      </div>
    </footer>
    <UNotifications />
  </div>
</template>
<script setup>
import { FourWay } from './src/communication/four_way';
import Msp from './src/communication/msp';
const { $pwa } = useNuxtApp();

const toast = useToast();

onMounted(() => {
    if ($pwa.offlineReady) {
        toast.add({
            icon: 'i-material-symbols-install-desktop',
            color: 'green',
            title: 'Installation',
            description: 'App successfully installed. Offline work available.'
        });
    }

    if ($pwa.needRefresh) {
        toast.add({
            icon: 'i-material-symbols-cloud-sync',
            color: 'green',
            title: 'Update',
            description: 'Update avaiable, please reload.',
            timeout: 3,
            callback: () => {
                window.location.reload();
            }
        });
    }
});

const serialStore = useSerialStore();
const { log, logWarning, logError } = useLogStore();

if (navigator && 'serial' in navigator) {
    serialStore.hasSerial = true;
    Msp.init(log, logWarning, logError);
    FourWay.init(log, logWarning, logError);

    log('initializing...');
} else {
    logError('WebSerial not supported, use other browser!');
}
</script>
