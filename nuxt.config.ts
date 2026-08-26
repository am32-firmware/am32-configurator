import { execSync } from 'node:child_process';

// short git hash for display; docker builds have no .git in the context,
// so they pass it in via NUXT_PUBLIC_GIT_HASH (from the GIT_SHA build arg)
const gitShortHash = () => {
    try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
        return '';
    }
};

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: {
        enabled: true,

        timeline: {
            enabled: true
        }
    },

    typescript: {
        // the cli harness is plain Node JS gluing the app modules
        // together; letting the typecheck ingest its globalThis
        // assignments turns the auto-imported store types into any
        tsConfig: {
            exclude: ['../cli']
        },
        shim: false,
        typeCheck: true
    },

    nitro: {
        storage: {
            uploads: {
                driver: 'fs',
                base: './public/uploads'
            }
        }
    },

    ssr: false,

    runtimeConfig: {
        public: {
            gitHash: process.env.NUXT_PUBLIC_GIT_HASH || gitShortHash()
        },
        redis: { // Default values
            host: process.env.REDIS_HOST,
            port: 6379
            /* other redis connector options */
        },
        mariadb: {
            host: process.env.MYSQL_HOST || 'mariadb',
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            user: process.env.MYSQL_USER || 'am32',
            password: process.env.MYSQL_PASSWORD || 'am32password',
            database: process.env.MYSQL_DATABASE || 'am32'
        }
    },

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
        '@nuxt/content',
        '@nuxt/image'
    ],

    pinia: {
        storesDirs: ['./stores/**']
    },

    colorMode: {
        preference: 'dark'
    },

    svgo: {
        autoImportPath: false,
        explicitImportsOnly: true
    },

    pwa: {
        registerType: 'autoUpdate',
        manifest: {
            id: '/',
            name: 'AM32 configurator',
            short_name: 'AM32CONF',
            theme_color: '#000000',
            description: 'Configurator for the ESC firmware AM32',
            icons: [
                {
                    src: 'assets/images/am32-logo.png',
                    sizes: '848x848',
                    type: 'image/png'
                },
                {
                    src: 'assets/images/192x192.png',
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: 'assets/images/144x144.png',
                    sizes: '144x144',
                    type: 'image/png',
                    purpose: 'any'
                },
                {
                    src: 'assets/images/96x96.png',
                    sizes: '96x96',
                    type: 'image/png',
                    purpose: 'any'
                }
            ],
            screenshots: [
                {
                    src: 'assets/images/screenshot1.png',
                    sizes: '1742x918',
                    type: 'image/png',
                    form_factor: 'wide',
                    label: '4in1 ESC'
                },
                {
                    src: 'assets/images/screenshot1.png',
                    sizes: '1742x918',
                    type: 'image/png',
                    form_factor: 'narrow',
                    label: '4in1 ESC'
                }
            ]
        },
        // workbox: {
        //    globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        //    navigateFallback: '/'
        // },
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
    },

    compatibilityDate: '2024-09-16'
});
