import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Octokit } from 'octokit';
import { coerce, compare } from 'semver';
import 'dotenv';
import { getFilesRoot, isSafePathSegment, listStorageFiles } from '../server/utils/fileStorage';

type Repository = {
    /** sub-directory of FILES_ROOT the assets are written to */
    directory: string,
    owner: string,
    repo: string,
    /** releases older than this tag are skipped */
    minTag: string,
    /** '2.08' style patch numbers are not semver, pad them before comparing */
    normalizeTag?: (tag: string) => string
};

const padMinorTag = (tag: string) => tag.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2');

async function listExistingAssets (directory: string) {
    const existing: Record<string, string[]> = {};

    for (const entry of await listStorageFiles(directory)) {
        const [release, ...rest] = entry.path.split('/');

        if (!release || rest.length === 0) {
            continue;
        }

        existing[release] ??= [];
        existing[release].push(rest.join('/'));
    }

    return existing;
}

async function syncRepository (octo: Octokit, repository: Repository) {
    const { data: releases } = await octo.rest.repos.listReleases({
        owner: repository.owner,
        repo: repository.repo
    });

    console.log(`got ${releases.length} releases for ${repository.owner}/${repository.repo}`);

    const normalize = repository.normalizeTag ?? ((tag: string) => tag);
    const minVersion = coerce(normalize(repository.minTag));
    const existing = await listExistingAssets(repository.directory);
    const root = getFilesRoot();

    for (const release of releases) {
        const version = coerce(normalize(release.tag_name));

        if (!version || !minVersion || compare(version, minVersion) < 0) {
            continue;
        }

        console.log(`processing: ${release.tag_name}`);

        const releaseVersion = release.prerelease ? `${release.tag_name}-rc` : release.tag_name;

        // tag and asset names come from upstream; they end up as path
        // segments under FILES_ROOT, so nothing may traverse out of it
        if (!isSafePathSegment(releaseVersion)) {
            console.error(`\t refusing unsafe tag name: ${releaseVersion}`);
            continue;
        }

        for (const asset of release.assets) {
            if (!isSafePathSegment(asset.name)) {
                console.error(`\t refusing unsafe asset name: ${asset.name}`);
                continue;
            }

            if (existing[releaseVersion]?.includes(asset.name)) {
                console.log(`\t found ${asset.name}, skipping ...`);
                continue;
            }

            console.log(`\t downloading ${asset.name}`);

            const response = await fetch(asset.browser_download_url);

            if (!response.ok) {
                console.error(`\t failed to download ${asset.name}: ${response.status}`);
                continue;
            }

            const target = join(root, repository.directory, releaseVersion, asset.name);
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, Buffer.from(await response.arrayBuffer()));
        }
    }

    return releases;
}

/**
 * Mirrors the GitHub release assets into the folder the server distributes
 * files from (FILES_ROOT). Run it on the host that owns the mount.
 */
export default async function (minTag?: string) {
    const octo = new Octokit();

    const releases = await syncRepository(octo, {
        directory: 'releases',
        owner: 'am32-firmware',
        repo: 'am32',
        minTag: minTag ?? 'v0.0',
        normalizeTag: padMinorTag
    });

    await syncRepository(octo, {
        directory: 'bootloaders',
        owner: 'am32-firmware',
        repo: 'AM32-bootloader',
        minTag: 'v12.0.0'
    });

    return releases;
}
