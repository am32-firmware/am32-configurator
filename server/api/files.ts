import { getStore, listStores } from '@netlify/blobs';
import { Octokit } from 'octokit';
import * as Minio from 'minio';
import dayjs from 'dayjs';

export default defineEventHandler(async (event) => {
    const octo = new Octokit();

    const query = getQuery(event);

    const filter = query.filter?.toString().split(',') ?? ['releases', 'bootloader'];
    const includePrereleases = query.prereleases !== undefined;

    const githubStore = getStore({
        name: 'github-releases-cache',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

    const minioCacheStore = getStore({
        name: 'minio-cache',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

    let minioCache: {
        name: string,
        url: string,
        expireAt: string
    }[] = (await minioCacheStore.get('url-cache', { type: 'json' })) ?? [];

    const minioClient = new Minio.Client({
        endPoint: 's3.am32.ca',
        port: 443,
        useSSL: true,
        accessKey: process.env.MINIO_ACCESS_KEY ?? '',
        secretKey: process.env.MINIO_SECRET_KEY ?? ''
    });

    const toolsStream = minioClient.listObjectsV2('am32-tools', '', true, '');

    const getTools = (): Promise<{
        name: string,
        url: string
    }[]> => new Promise((resolve) => {
        let minioCacheChanged = false;

        toolsStream.on('data', (obj) => {
            if (obj.name) {
                console.log(obj.name);
                const entry = minioCache.find(n => n.name === obj.name);
                if (!entry || dayjs(entry.expireAt).isBefore(dayjs())) {
                    if (entry) {
                        minioCache = minioCache.filter(n => n.name !== obj.name);
                    }

                    minioCache.push({
                        name: obj.name,
                        expireAt: dayjs().add((24 * 60 * 60) - 1, 'seconds').format(),
                        url: ''
                    });
                    minioCacheChanged = true;
                }
            }
        });

        toolsStream.on('end', async () => {
            for (const cache of minioCache.filter(c => c.url === '')) {
                cache.url = await minioClient.presignedUrl('get', 'am32-tools', cache.name, 24 * 60 * 60);
            }
            if (minioCacheChanged) {
                await minioCacheStore.setJSON('url-cache', minioCache);
            }
            resolve(minioCache);
        });
    });

    const tools = await getTools();

    const githubReleasesCache: Awaited<ReturnType<typeof octo.rest.repos.listReleases>> | null = await githubStore.get('releases-cache', { type: 'json' });

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
                const [fileOrVersion, ...subParts] = file.key.split('/').filter(Boolean);

                const cache = githubReleasesCache?.data.find(r => r.tag_name === fileOrVersion);

                const folder = folders.find(f => f.name === name);
                if (folder && (
                    !cache ||
                    includePrereleases ||
                    cache.prerelease === false
                )) {
                    if (subParts.length > 0) {
                        let subfolder = folder.children.find(sf => sf.name === fileOrVersion + (cache?.prerelease ? cache?.name?.split('-').pop() ?? '' : ''));
                        if (!subfolder) {
                            subfolder = {
                                name: fileOrVersion + (cache?.prerelease ? cache?.name?.split('-').pop() ?? '' : ''),
                                files: [],
                                children: []
                            };
                            folder.children.push(subfolder);
                        }
                        subfolder.files.push({
                            name: subParts[0],
                            url: Buffer.from(`${name}:${file.key}`, 'ascii').toString('base64')
                        });
                    } else {
                        folder.files.push({
                            name: fileOrVersion,
                            url: Buffer.from(`${name}:${file.key}`, 'ascii').toString('base64')
                        });
                    }
                }
            }
        }
    }

    folders.push({
        name: 'tools',
        children: [],
        files: tools.map(t => ({
            name: t.name,
            url: t.url
        }))
    });

    return {
        data: folders
    };
});
