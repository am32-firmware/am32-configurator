import { list } from '@vercel/blob';

export default defineEventHandler(async (_event) => {
    const { blobs } = await list({
        prefix: 'releases'
    });
    return {
        data: blobs.filter(b => b.downloadUrl.endsWith('.hex'))
    };
});
