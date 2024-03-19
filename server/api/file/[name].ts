import { getStore } from '@netlify/blobs';

export default defineEventHandler(async (event) => {
    const name = getRouterParam(event, 'name');
    if (name) {
        const url = Buffer.from(name, 'base64').toString('ascii');
        const [storeName, path] = url.split(':');
        const store = getStore({
            name: storeName,
            siteID: process.env.NETLIFY_SITE_ID,
            token: process.env.NETLIFY_TOKEN
        });
        if (store) {
            const blob = await store.get(path, {
                type: 'blob'
            });

            const parts = path.split('/');

            const file = new File([blob], parts[parts.length - 1]);

            return sendStream(event, file.stream());
        }
    }

    throw createError({
        statusCode: 404,
        statusMessage: 'not found'
    });
});
