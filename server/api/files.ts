import { promiseTimeout } from '@vueuse/core';
import { useMinio } from '~/composables/useMinio';

type CachedObject = {
    key: string,
    value: string | null
};

type SectionConfig = {
    filterName: string,
    folderName: string,
    bucketName: string,
    cacheNamespace: string,
    storageName: string,
    nested: boolean,
    includePrereleaseFilter?: boolean
};

function delay (ms: number) {
    return promiseTimeout(ms);
}

async function getCachedObjects (
    minioClient: ReturnType<typeof useMinio>,
    cache: ReturnType<typeof useStorage>,
    bucketName: string,
    cacheNamespace: string
): Promise<CachedObject[]> {
    const stream = minioClient.listObjectsV2(bucketName, '', true, '');

    return await new Promise((resolve) => {
        stream.on('data', async (obj) => {
            if (obj.name && !(await cache.hasItem(`${cacheNamespace}:${obj.name}`))) {
                const url = await minioClient.presignedUrl('get', bucketName, obj.name, 24 * 60 * 60);
                await cache.setItem(
                    `${cacheNamespace}:${obj.name}`,
                    `${url}`,
                    {
                        ttl: (24 * 60 * 60) - 1
                    }
                );
            }
        });

        stream.on('end', async () => {
            await delay(200);
            const keys = await cache.getKeys(cacheNamespace);
            const result: CachedObject[] = [];

            for (const key of keys) {
                result.push({
                    key,
                    value: (await cache.getItem(key))?.toString() ?? ''
                });
            }

            resolve(result);
        });
    });
}

function buildNestedFolder (
    folderName: string,
    entries: CachedObject[],
    includePrereleases = true
) {
    const folder = {
        name: folderName,
        children: [] as BlobFolder[],
        files: [] as BlobFolderFile[]
    };

    for (const entry of entries) {
        const [, fileOrVersion, ...subParts] = entry.key.split(':').filter(Boolean);

        if (!fileOrVersion) {
            continue;
        }

        if (!includePrereleases && fileOrVersion.endsWith('-rc')) {
            continue;
        }

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
                name: subParts.join('/'),
                url: entry.value ?? ''
            });
        } else {
            folder.files.push({
                name: fileOrVersion,
                url: entry.value ?? ''
            });
        }
    }

    return folder;
}

function buildFlatFolder (folderName: string, entries: CachedObject[]) {
    return {
        name: folderName,
        children: [] as BlobFolder[],
        files: entries.filter(entry => entry.value).map(entry => ({
            name: entry.key.split(':').pop() ?? entry.key,
            url: entry.value ?? ''
        }))
    };
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const includePrereleases = query.prereleases !== undefined;
    const filter = query.filter?.toString().split(',') ?? ['releases', 'kiss-ultra-releases', 'bootloader', 'tools', 'unlocker'];

    const sectionConfigs: SectionConfig[] = [
        {
            filterName: 'releases',
            folderName: 'releases',
            bucketName: 'releases',
            cacheNamespace: 'releases',
            storageName: 'releases',
            nested: true,
            includePrereleaseFilter: true
        },
        {
            filterName: 'kiss-ultra-releases',
            folderName: 'kiss-ultra-releases',
            bucketName: 'kiss-ultra-releases',
            cacheNamespace: 'kiss-ultra-releases',
            storageName: 'kiss-ultra-releases',
            nested: true
        },
        {
            filterName: 'bootloader',
            folderName: 'bootloader',
            bucketName: 'bootloaders',
            cacheNamespace: 'bootloaders',
            storageName: 'bootloaders',
            nested: true
        },
        {
            filterName: 'tools',
            folderName: 'tools',
            bucketName: 'am32-tools',
            cacheNamespace: 'tools',
            storageName: 'tools',
            nested: false
        },
        {
            filterName: 'unlocker',
            folderName: 'unlocker',
            bucketName: 'unlocker',
            cacheNamespace: 'unlocker',
            storageName: 'unlocker',
            nested: true
        }
    ];

    const minioClient = useMinio();
    const folders: BlobFolder[] = [];

    for (const section of sectionConfigs) {
        if (!filter.includes(section.filterName)) {
            continue;
        }

        const cache = useStorage(section.storageName);
        const entries = await getCachedObjects(minioClient, cache, section.bucketName, section.cacheNamespace);

        folders.push(section.nested
            ? buildNestedFolder(
                section.folderName,
                entries,
                section.includePrereleaseFilter ? includePrereleases : true
            )
            : buildFlatFolder(section.folderName, entries));
    }

    return {
        data: folders
    };
});
