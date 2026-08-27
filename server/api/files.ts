import { buildFileUrl, listStorageFiles, type StorageEntry } from '~/server/utils/fileStorage';

type SectionConfig = {
    /** value accepted by the ?filter= query */
    filterName: string,
    /** name the folder gets in the response — the front end keys off it */
    folderName: string,
    /** sub-directory of FILES_ROOT holding this section */
    directory: string,
    /** true: group files by their first path segment (the release tag) */
    nested: boolean,
    includePrereleaseFilter?: boolean
};

const SECTION_CONFIGS: SectionConfig[] = [
    {
        filterName: 'releases',
        folderName: 'releases',
        directory: 'releases',
        nested: true,
        includePrereleaseFilter: true
    },
    {
        filterName: 'kiss-ultra-releases',
        folderName: 'kiss-ultra-releases',
        directory: 'kiss-ultra-releases',
        nested: true
    },
    {
        filterName: 'bootloader',
        folderName: 'bootloader',
        directory: 'bootloaders',
        nested: true
    },
    {
        filterName: 'tools',
        folderName: 'tools',
        directory: 'am32-tools',
        nested: false
    },
    {
        filterName: 'unlocker',
        folderName: 'unlocker',
        directory: 'unlocker',
        nested: true
    }
];

function buildFileEntry (name: string, section: SectionConfig, entry: StorageEntry): BlobFolderFile {
    const url = buildFileUrl(section.directory, entry.path);

    return {
        name,
        url,
        downloadUrl: url
    };
}

function buildNestedFolder (section: SectionConfig, entries: StorageEntry[], includePrereleases: boolean): BlobFolder {
    const folder: BlobFolder = {
        name: section.folderName,
        children: [],
        files: []
    };

    for (const entry of entries) {
        const [fileOrVersion, ...subParts] = entry.path.split('/').filter(Boolean);

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

            subfolder.files.push(buildFileEntry(subParts.join('/'), section, entry));
        } else {
            folder.files.push(buildFileEntry(fileOrVersion, section, entry));
        }
    }

    return folder;
}

function buildFlatFolder (section: SectionConfig, entries: StorageEntry[]): BlobFolder {
    return {
        name: section.folderName,
        children: [],
        files: entries.map(entry => buildFileEntry(entry.name, section, entry))
    };
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const includePrereleases = query.prereleases !== undefined;
    const filter = query.filter?.toString().split(',') ?? SECTION_CONFIGS.map(section => section.filterName);

    const sections = SECTION_CONFIGS.filter(section => filter.includes(section.filterName));

    // each section is an independent directory read
    const folders = await Promise.all(sections.map(async (section) => {
        const entries = await listStorageFiles(section.directory);

        return section.nested
            ? buildNestedFolder(section, entries, section.includePrereleaseFilter ? includePrereleases : true)
            : buildFlatFolder(section, entries);
    }));

    return {
        data: folders
    };
});
