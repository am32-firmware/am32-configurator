import { useMinio } from '~/composables/useMinio';

const getVersion = (version: number) => {
    if (version > 3) {
        return 3;
    }
    return version;
};

export default defineEventHandler(async (event) => {
    const version = Number(getQuery(event).version?.toString() ?? '2');
    const name = getRouterParam(event, 'name');
    const minioClient = useMinio();

    const binariesCache = useStorage('binaries');

    const filePath = `${name}/v${getVersion(version)}.bin`;

    if (!(await binariesCache.hasItem(`binaries:${filePath}`))) {
        const binsStream = minioClient.listObjects('binaries', filePath, true);

        const bins = await binsStream.toArray();

        if (bins.length === 0) {
            throw createError({
                statusCode: 404
            });
        }

        const url = await minioClient.presignedUrl('get', 'binaries', filePath, 24 * 60 * 60);
        await binariesCache.setItem(`binaries:${filePath}`, `${url}`, {
            ttl: (24 * 60 * 60) - 1
        });
    }

    return binariesCache.getItem(`binaries:${filePath}`);
});
