import { useMinio } from '~/composables/useMinio';

export default defineEventHandler(async (event) => {
    const version = Number(getQuery(event).version?.toString() ?? '2');
    const name = getRouterParam(event, 'name');

    const filePath = `${name}/v${version}.bin`;

    // minio is the primary store; a deployment without it (or without
    // the object) falls back to defaults bundled with the site. The
    // client validates whatever it ends up fetching either way.
    try {
        const minioClient = useMinio();
        const binariesCache = useStorage('binaries');

        if (!(await binariesCache.hasItem(`binaries:${filePath}`))) {
            const binsStream = minioClient.listObjects('binaries', filePath, true);

            const bins = await binsStream.toArray();

            if (bins.length === 0) {
                throw new Error('not in minio');
            }

            const url = await minioClient.presignedUrl('get', 'binaries', filePath, 24 * 60 * 60);
            await binariesCache.setItem(`binaries:${filePath}`, `${url}`, {
                ttl: (24 * 60 * 60) - 1
            });
        }

        return binariesCache.getItem(`binaries:${filePath}`);
    } catch {
        return `/eeprom-defaults/${filePath}`;
    }
});
