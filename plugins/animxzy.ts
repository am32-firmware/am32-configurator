import VueAnimXyz from '@animxyz/vue3';
import '@animxyz/core';

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(VueAnimXyz);
});
