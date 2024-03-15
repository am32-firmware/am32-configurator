import type { Config } from 'tailwindcss';
import { iconsPlugin, getIconCollections } from '@egoist/tailwindcss-icons';
import typography from '@tailwindcss/typography';

export default {
    content: [],
    theme: {
        extend: {
        },
        fontFamily: {
            sans: ["'Nunito Sans'"]
        }
    },
    plugins: [
        iconsPlugin({
            // Select the icon collections you want to use
            // You can also ignore this option to automatically discover all icon collections you have installed
            collections: getIconCollections(['heroicons', 'material-symbols', 'svg-spinners'])
        }),
        typography()
    ]
} satisfies Config;
