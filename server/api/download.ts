export default defineEventHandler((_event) => {
    /* const query = getQuery(event);

    const releaseQuery = query.release?.toString();
    const listQuery = query.list?.toString();

    if (releaseQuery && releaseQuery.startsWith('v')) {
        const [version, fileName] = releaseQuery.split('/');
        const { blobs } = await list({
            prefix: `releases/${version}`
        });
        const blob = blobs.find(b => b.pathname.endsWith(fileName));

        if (blob) {
            return {
                data: [blob.downloadUrl]
            };
        }

        throw createError({
            statusCode: 404,
            statusMessage: 'file not found'
        });
    } else if (listQuery) {
        switch (listQuery) {
        case 'tags': {
            const { blobs } = await list({
                prefix: 'releases'
            });
            const hexFiles = blobs.filter(b => b.pathname.endsWith('.hex')).map(b => b.pathname);
            const tags: string[] = [];
            for (const hexFile of hexFiles) {
                const [, tag] = hexFile.split('/');
                if (!tags.includes(tag)) {
                    tags.push(tag);
                }
            }
            return {
                data: tags
            };
        };
        default: {
            const { blobs } = await list({
                prefix: `releases/${listQuery}`
            });
            return {
                data: blobs.filter(b => b.pathname.endsWith('.hex')).map(b => b.pathname)
            };
        };
        }
    } */

    throw createError({
        statusCode: 400,
        statusMessage: 'url not allowed'
    });
});
