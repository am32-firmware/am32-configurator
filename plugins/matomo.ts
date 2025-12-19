import VueMatomo from 'vue-matomo';

export default defineNuxtPlugin((nuxtApp) => {
    if (process.env.NODE_ENV === 'production') {
        nuxtApp.vueApp.use(VueMatomo, {
            host: 'https://matomo.am32.ca',
            router: useRouter(),
            siteId: 1
        });
    }
});
