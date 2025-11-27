import { useMinio } from '~/composables/useMinio';

export default defineEventHandler(async () => {
    const minioClient = useMinio();

    const binariesCache = useStorage('schema');

    if (!(await binariesCache.hasItem('schema:eeprom'))) {
        try {
            const schemasStream = minioClient.listObjects('schemas', 'eeprom.json', true);
            const schemas = await schemasStream.toArray();

            if (schemas.length === 0) {
                throw createError({
                    statusCode: 404
                });
            }
            const url = await minioClient.presignedUrl('get', 'schemas', 'eeprom.json', 60);
            await binariesCache.setItem('schema:eeprom', `${url}`, {
                ttl: 60 - 1
            });
        } catch (e) {
            throw createError({
                statusCode: 404,
                statusMessage: 'schema not found'
            });
        }
    }

    const url = await binariesCache.getItem('schema:eeprom');

    return fetch(url as string);
});
