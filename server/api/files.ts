import { list } from '@vercel/blob';

export default defineEventHandler(async (_event) => {
    const { blobs } = await list();

    const folders: BlobFolder[] = [];

    for (const blob of blobs) {
        const parts = blob.pathname.trim().split('/').filter(Boolean);
        if (blob.size === 0) {
            folders.push({
                name: parts[0],
                files: [],
                children: []
            });
        } else {
            const folder = folders.find(f => f.name === parts[0]);
            if (folder) {
                if (parts.length > 2) {
                    let subfolder = folder.children.find(sf => sf.name === parts[1]);
                    if (!subfolder) {
                        subfolder = {
                            name: parts[1],
                            files: [],
                            children: []
                        };
                        folder.children.push(subfolder);
                    }
                    subfolder.files.push({
                        name: parts[2],
                        url: blob.downloadUrl
                    });
                } else {
                    folder.files.push({
                        name: parts[1],
                        url: blob.downloadUrl
                    });
                }
            }
        }
    }
    return {
        data: folders
    };
});
