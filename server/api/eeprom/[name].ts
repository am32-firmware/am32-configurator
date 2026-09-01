import { buildFileUrl, resolveStorageFile } from '~/server/utils/fileStorage';

export default defineEventHandler(async (event) => {
    const requestedVersion = Number.parseInt(getQuery(event).version?.toString() ?? '', 10);
    const version = Number.isNaN(requestedVersion) ? 2 : requestedVersion;
    const name = getRouterParam(event, 'name');

    if (!name) {
        throw createError({
            statusCode: 404,
            statusMessage: 'not found'
        });
    }

    const filePath = `${name}/v${version}.bin`;

    // the mounted folder is the primary store; a deployment without it (or
    // without that binary) falls back to defaults bundled with the site. The
    // client validates whatever it ends up fetching either way.
    if (await resolveStorageFile(`binaries/${filePath}`)) {
        return buildFileUrl('binaries', filePath);
    }

    return `/eeprom-defaults/${filePath}`;
});
