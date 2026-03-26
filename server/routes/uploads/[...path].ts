import { extname } from 'path';

const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.zip': 'application/zip',
    '.bin': 'application/octet-stream'
};

export default defineEventHandler(async (event) => {
    const storage = useStorage('uploads');
    const path = await getRouterParam(event, 'path');

    if (!path) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Path is required'
        });
    }

    const ext = extname(path).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    setResponseHeader(event, 'Content-Type', contentType);

    return await storage.getItemRaw(path);
});
