import * as Minio from 'minio';

import { promiseTimeout } from '@vueuse/core';

function delay (ms: number) {
    return promiseTimeout(ms);
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);

    const toolsCache = useStorage('tools');
    const releasesCache = useStorage('releases');
    const bootloadersCache = useStorage('bootloaders');

    const filter = query.filter?.toString().split(',') ?? ['releases', 'bootloader', 'tools'];
    const includePrereleases = query.prereleases !== undefined;

    const minioClient = new Minio.Client({
        endPoint: process.env.MINIO_URL ?? '',
        port: 443,
        useSSL: true,
        accessKey: process.env.MINIO_ACCESS_KEY ?? '',
        secretKey: process.env.MINIO_SECRET_KEY ?? ''
    });

    const folders: BlobFolder[] = [];

    if (filter.includes('releases')) {
        const releasesStream = minioClient.listObjectsV2('releases', '', true, '');

        const getReleases = (): Promise<{
            key: string,
            value: string | null
        }[]> => new Promise((resolve) => {
            releasesStream.on('data', async (obj) => {
                if (obj.name) {
                    if (!(await releasesCache.hasItem(`releases:${obj.name}`))) {
                        const url = await minioClient.presignedUrl('get', 'releases', obj.name, 24 * 60 * 60);
                        await releasesCache.setItem(
                            `releases:${obj.name}`,
                            `${url}`,
                            {
                                ttl: (24 * 60 * 60) - 1
                            }
                        );
                    }
                }
            });

            releasesStream.on('end', async () => {
                await delay(200);
                const keys = await releasesCache.getKeys('releases');
                const result: {
                    key: string,
                    value: string | null
                }[] = [];
                for (const key of keys) {
                    result.push({
                        key,
                        value: await releasesCache.getItem(key)
                    });
                }
                resolve(result);
            });
        });

        const releases = await getReleases();

        const releasesFolder = {
            name: 'releases',
            children: [] as BlobFolder[],
            files: [] as BlobFolderFile[]
        };

        folders.push(releasesFolder);

        for (const release of releases) {
            const [, fileOrVersion, ...subParts] = release.key.split(':').filter(Boolean);
            if (
                includePrereleases ||
                !fileOrVersion.endsWith('-rc')
            ) {
                if (subParts.length > 0) {
                    let subfolder = releasesFolder.children.find(sf => sf.name === fileOrVersion);
                    if (!subfolder) {
                        subfolder = {
                            name: fileOrVersion,
                            files: [],
                            children: []
                        };
                        releasesFolder.children.push(subfolder);
                    }
                    subfolder.files.push({
                        name: subParts[0],
                        url: release.value ?? ''
                    });
                } else {
                    releasesFolder.files.push({
                        name: fileOrVersion,
                        url: release.value ?? ''
                    });
                }
            }
        }
    }

    if (filter.includes('bootloader')) {
        const bootloadersStream = minioClient.listObjectsV2('bootloaders', '', true, '');

        const getBootloaders = (): Promise<{
            key: string,
            value: string | null
        }[]> => new Promise((resolve) => {
            bootloadersStream.on('data', async (obj) => {
                if (obj.name) {
                    if (!(await bootloadersCache.hasItem(`bootloaders:${obj.name}`))) {
                        const url = await minioClient.presignedUrl('get', 'bootloaders', obj.name, 24 * 60 * 60);
                        await bootloadersCache.setItem(
                            `bootloaders:${obj.name}`,
                            `${url}`,
                            {
                                ttl: (24 * 60 * 60) - 1
                            }
                        );
                    }
                }
            });

            bootloadersStream.on('end', async () => {
                await delay(200);
                const keys = await bootloadersCache.getKeys('bootloaders');
                const result: {
                    key: string,
                    value: string | null
                }[] = [];
                for (const key of keys) {
                    result.push({
                        key,
                        value: await bootloadersCache.getItem(key)
                    });
                }
                resolve(result);
            });
        });

        const bootloaders = await getBootloaders();

        console.log(bootloaders);

        const bootloadersFolder = {
            name: 'bootloader',
            children: [] as BlobFolder[],
            files: [] as BlobFolderFile[]
        };

        folders.push(bootloadersFolder);

        for (const bootloader of bootloaders) {
            const [, fileOrVersion, ...subParts] = bootloader.key.split(':').filter(Boolean);

            if (subParts.length > 0) {
                let subfolder = bootloadersFolder.children.find(sf => sf.name === fileOrVersion);
                if (!subfolder) {
                    subfolder = {
                        name: fileOrVersion,
                        files: [],
                        children: []
                    };
                    bootloadersFolder.children.push(subfolder);
                }
                subfolder.files.push({
                    name: subParts[0],
                    url: bootloader.value ?? ''
                });
            } else {
                bootloadersFolder.files.push({
                    name: fileOrVersion,
                    url: bootloader.value ?? ''
                });
            }
        }
    }

    if (filter.includes('bootloader')) {
        const toolsStream = minioClient.listObjectsV2('am32-tools', '', true, '');

        const getTools = (): Promise<{
            key: string,
            value: string | null
        }[]> => new Promise((resolve) => {
            toolsStream.on('data', async (obj) => {
                if (obj.name) {
                    if (!(await toolsCache.hasItem(`tools:${obj.name}`))) {
                        const url = await minioClient.presignedUrl('get', 'am32-tools', obj.name, 24 * 60 * 60);
                        await toolsCache.setItem(
                            `tools:${obj.name}`,
                            `${url}`,
                            {
                                ttl: (24 * 60 * 60) - 1
                            }
                        );
                    }
                }
            });

            toolsStream.on('end', async () => {
                await delay(200);
                const keys = await toolsCache.getKeys('tools');
                const result: {
                    key: string,
                    value: string | null
                }[] = [];
                for (const key of keys) {
                    result.push({
                        key,
                        value: await toolsCache.getItem(key)
                    });
                }
                resolve(result);
            });
        });

        const tools = await getTools();
        folders.push({
            name: 'tools',
            children: [],
            files: tools.filter(t => t.value).map(t => ({
                name: t.key.split(':').pop() ?? t.key,
                url: t.value ?? ''
            }))
        });
    }

    return {
        data: folders
    };
});
