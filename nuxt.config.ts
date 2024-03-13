// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: {
        enabled: true,

        timeline: {
            enabled: true
        }
    },
    typescript: {
        shim: false,
        typeCheck: true
    },
    ssr: false,
    modules: [
        '@vite-pwa/nuxt',
        'nuxt-svgo',
        'dayjs-nuxt',
        '@nuxt/ui',
        '@pinia/nuxt',
        '@vueuse/nuxt',
        ['@nuxtjs/google-fonts', {
            families: {
                Roboto: true,
                'Nunito Sans': true
            }
        }],
        '@nuxt/content'
    ],
    pinia: {
        storesDirs: ['./stores/**']
    },
    colorMode: {
        preference: 'dark'
    },
    pwa: {
        registerType: 'autoUpdate',
        manifest: {
            name: 'AM32 configurator',
            short_name: 'AM32CONF',
            theme_color: '#000000',
            description: "Configurator for the ESC firmware AM32",
            icons: [
                {
                    src: 'assets/images/logo.svg',
                    sizes: '48x48 72x72 96x96 128x128 256x256 512x512',
                    type: 'image/svg',
                    purpose: 'any'
                }
            ],
            screenshots: [
                {
                    "src": "assets/images/screenshot1.png",
                    "sizes": "640x320",
                    "type": "image/png",
                    "form_factor": "wide",
                    "label": "4in1 ESC"
                },
                {
                    "src": "assets/images/screenshot1.png",
                    "sizes": "640x320",
                    "type": "image/png",
                    "form_factor": "narrow",
                    "label": "4in1 ESC"
                }
            ]
        },
        workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,ico}']
        },
        client: {
            installPrompt: true,
            // you don't need to include this: only for testing purposes
            // if enabling periodic sync for update use 1 hour or so (periodicSyncForUpdates: 3600)
            periodicSyncForUpdates: 3600
        },
        devOptions: {
            enabled: true,
            suppressWarnings: true,
            navigateFallbackAllowlist: [/^\/$/],
            type: 'module'
        }
    }
});
