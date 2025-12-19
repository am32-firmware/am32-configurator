<template>
  <div>
    <NuxtPwaManifest />
    <div class="min-h-screen bg-gray-950">
      <NuxtLayout v-if="serialStore.hasSerial" class="h-full">
        <NuxtPage />
      </NuxtLayout>
      <div v-else>
        No WebSerial
      </div>
      <UNotifications />
    </div>
  </div>
</template>
<script setup>
import { Direct } from './src/communication/direct';
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

    this.$matomo && this.$matomo.trackPageView();
});

const serialStore = useSerialStore();
const { log, logWarning, logError } = useLogStore();

if (navigator && 'serial' in navigator) {
    serialStore.hasSerial = true;
    Msp.init(log, logWarning, logError);
    FourWay.init(log, logWarning, logError);
    Direct.init(log, logWarning, logError);

    log('initializing...');
} else {
    logError('WebSerial not supported, use other browser!');
}
</script>
