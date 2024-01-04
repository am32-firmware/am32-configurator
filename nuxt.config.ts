// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({  
  devtools: { enabled: true },
  typescript: {
    shim: false
  },
  ssr: false,
  modules: ['dayjs-nuxt', '@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', ['@nuxtjs/google-fonts', {
      families: {
        Roboto: true,
        "Nunito Sans": true,
      }
    }]
  ],
  pinia: {
    storesDirs: ['./stores/**'],
  },
});