import { getStore, listStores } from '@netlify/blobs';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);

    const filter = query.filter?.toString().split(',') ?? ['releases', 'bootloader', 'tools'];

    const { stores } = await listStores({
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

    const folders: BlobFolder[] = [];

    for (const name of stores) {
        if (filter.includes(name)) {
            const store = getStore({
                name,
                siteID: process.env.NETLIFY_SITE_ID,
                token: process.env.NETLIFY_TOKEN
            });
            folders.push({
                name,
                children: [],
                files: []
            });
            for (const file of (await store.list()).blobs) {
                const parts = file.key.split('/').filter(Boolean);
                const folder = folders.find(f => f.name === name);
                if (folder) {
                    if (parts.length > 1) {
                        let subfolder = folder.children.find(sf => sf.name === parts[0]);
                        if (!subfolder) {
                            subfolder = {
                                name: parts[0],
                                files: [],
                                children: []
                            };
                            folder.children.push(subfolder);
                        }
                        subfolder.files.push({
                            name: parts[1],
                            url: Buffer.from(`${name}:${file.key}`, 'ascii').toString('base64')
                        });
                    } else {
                        folder.files.push({
                            name: parts[0],
                            url: Buffer.from(`${name}:${file.key}`, 'ascii').toString('base64')
                        });
                    }
                }
            }
        }
    }

    return {
        data: folders
    };
});
