import { list } from '@vercel/blob';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);

    const releaseQuery = query.release?.toString();
    const listQuery = query.list?.toString();

    if (releaseQuery && releaseQuery.startsWith('v')) {
        const [version, fileName] = releaseQuery.split('/');
        const { blobs } = await list({
            prefix: `releases/${version}`
        });
        const blob = blobs.find(b => b.pathname.endsWith(fileName));

        if (blob) {
            return blob.downloadUrl;
        }

        throw createError({
            statusCode: 404,
            statusMessage: 'file not found'
        });
    } else if (listQuery) {
        const [, type] = listQuery.split('=');
        switch (type) {
        case 'tags': {
            const { blobs } = await list({
                prefix: 'releases',
                mode: 'folded'
            });
            return blobs.map(b => b.pathname);
        };
        default: {
            const { blobs } = await list({
                prefix: `/releases/${type}`
            });
            return blobs.map(b => b.pathname);
        };
        }
    }

    throw createError({
        statusCode: 400,
        statusMessage: 'url not allowed'
    });
});
