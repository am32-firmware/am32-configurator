import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { resolveStorageFile } from '~/server/utils/fileStorage';

const MIME_TYPES: Record<string, string> = {
    '.hex': 'application/octet-stream',
    '.bin': 'application/octet-stream',
    '.zip': 'application/zip',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
};

function decodePath (raw: string) {
    // decode per segment so an encoded slash can never introduce a new one
    return raw
        .split('/')
        .filter(Boolean)
        .map(segment => decodeURIComponent(segment))
        .join('/');
}

function getContentDisposition (fileName: string) {
    const escapedFileName = fileName.replace(/(["\\])/g, '\\$1');

    return `attachment; filename="${escapedFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export default defineEventHandler(async (event) => {
    const raw = getRouterParam(event, 'path');

    if (!raw) {
        throw createError({
            statusCode: 404,
            statusMessage: 'not found'
        });
    }

    let requestedPath: string;

    try {
        requestedPath = decodePath(raw);
    } catch {
        throw createError({
            statusCode: 400,
            statusMessage: 'invalid file request'
        });
    }

    const filePath = await resolveStorageFile(requestedPath);

    if (!filePath) {
        throw createError({
            statusCode: 404,
            statusMessage: 'not found'
        });
    }

    // the ingest script writes into the same tree we read from, so the file
    // may have gone away between resolving it and stat-ing it
    const stats = await stat(filePath).catch(() => null);

    if (!stats) {
        throw createError({
            statusCode: 404,
            statusMessage: 'not found'
        });
    }

    const fileName = basename(filePath);
    const contentType = MIME_TYPES[extname(fileName).toLowerCase()] ?? 'application/octet-stream';

    // paths are stable now, so the browser may keep what it downloaded
    if (handleCacheHeaders(event, {
        modifiedTime: stats.mtime,
        etag: `"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`,
        maxAge: 60 * 60
    })) {
        return;
    }

    setResponseHeader(event, 'Content-Type', contentType);
    setResponseHeader(event, 'Content-Disposition', getContentDisposition(fileName));
    setResponseHeader(event, 'Content-Length', stats.size);

    const stream = createReadStream(filePath);

    // the response is already committed at this point, so a read error can
    // only be reported by cutting the connection short
    stream.on('error', (error) => {
        // eslint-disable-next-line no-console
        console.error(`[file] streaming ${filePath} failed:`, error);
        event.node.res.destroy();
    });

    return sendStream(event, stream);
});
