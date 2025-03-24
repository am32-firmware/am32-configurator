import { getIconCollections, iconsPlugin } from '@egoist/tailwindcss-icons';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
    content: {
        relative: true,
        files: [
            './pages/**/*.{html,js,vue}',
            './components/**/*.{html,js,vue}'
        ]
    },
    safelist: [
        'invert',
        'grayscale',
        'contrast-200',
        'brightness-200'
    ],
    theme: {
        extend: {
            screens: {
                sm: '480px',
                md: '640px',
                lg: '800px'
            }
        },
        fontFamily: {
            sans: ["'Nunito Sans'"]
        }
    },
    plugins: [
        iconsPlugin({
            // Select the icon collections you want to use
            // You can also ignore this option to automatically discover all icon collections you have installed
            collections: getIconCollections(['mdi', 'heroicons', 'material-symbols', 'svg-spinners'])
        }),
        typography()
    ]
} satisfies Config;
