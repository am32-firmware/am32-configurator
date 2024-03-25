import { getStore, listStores } from '@netlify/blobs';
import { Octokit } from 'octokit';

export default defineEventHandler(async (event) => {
    const octo = new Octokit();

    const query = getQuery(event);

    const filter = query.filter?.toString().split(',') ?? ['releases', 'bootloader', 'tools'];
    const includePrereleases = query.prereleases !== undefined;

    const githubStore = getStore({
        name: 'github-releases-cache',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

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
                        let subfolder = folder.children.find(sf => sf.name === fileOrVersion);
                        if (!subfolder) {
                            subfolder = {
                                name: fileOrVersion,
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

    return {
        data: folders
    };
});
