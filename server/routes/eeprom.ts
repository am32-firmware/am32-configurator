import { readFile } from 'node:fs/promises';
import { resolveStorageFile } from '~/server/utils/fileStorage';

export default defineEventHandler(async (event) => {
    const schemaPath = await resolveStorageFile('schemas/eeprom.json');

    if (!schemaPath) {
        throw createError({
            statusCode: 404,
            statusMessage: 'schema not found'
        });
    }

    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8');

    return await readFile(schemaPath, 'utf8');
});
