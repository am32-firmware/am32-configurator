import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { readFormData } from 'h3';

export default defineEventHandler(async (event) => {
    await validateAdminSession(event);

    const formData = await readFormData(event);
    const file = formData.get('file') as File | null;

    if (!file) {
        throw createError({
            statusCode: 400,
            statusMessage: 'No file provided'
        });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG'
        });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        throw createError({
            statusCode: 400,
            statusMessage: 'File too large. Maximum size: 5MB'
        });
    }

    const storage = useStorage('uploads');

    const ext = file.name.split('.').pop() || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await storage.setItemRaw(`sponsors/${filename}`, buffer);

    return {
        data: {
            url: `/uploads/sponsors/${filename}`
        }
    };
});
