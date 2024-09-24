import { finished } from 'node:stream/promises';
import { Octokit } from 'octokit';
import { coerce, compare } from 'semver';
import * as Minio from 'minio';
import 'dotenv';

export default async function (minTag?: string) {
    const octo = new Octokit();
    const releases = await octo.rest.repos.listReleases({
        owner: 'am32-firmware',
        repo: 'am32'
    });

    const releasesData = await releases.data;

    console.log(`got ${releasesData.length} releases`);

    const semverMinTag = minTag?.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2') ?? 'v0.0';

    const minioClient = new Minio.Client({
        endPoint: process.env.MINIO_URL ?? '',
        port: 443,
        useSSL: true,
        accessKey: process.env.MINIO_ACCESS_KEY ?? '',
        secretKey: process.env.MINIO_SECRET_KEY ?? ''
    });

    const releasesStream = minioClient.listObjectsV2('releases', '', true, '');

    const uploadedReleases: {
        [key: string]: string[]
    } = {};

    releasesStream.on('data', (obj) => {
        if (obj.name) {
            const [release, asset] = obj.name.split('/');
            if (!uploadedReleases[release]) {
                uploadedReleases[release] = [];
            }
            uploadedReleases[release].push(asset);
        }
    });

    await finished(releasesStream);

    for (const release of releasesData) {
        const semverTagName = release.tag_name.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2');
        const verTag = coerce(semverTagName);
        const verMinTag = coerce(semverMinTag);

        if (verTag && verMinTag && compare(verTag, verMinTag) >= 0) {
            console.log(`processing: ${release.tag_name}`);
            for (const asset of release.assets) {
                console.log(`\t asset: ${asset.name}`);
                let releaseVersion = `${release.tag_name}`;
                if (release.prerelease) {
                    releaseVersion += '-rc';
                }
                if (!uploadedReleases[releaseVersion] || !uploadedReleases[releaseVersion].includes(asset.name)) {
                    console.log(`\t uploading ${asset.name}`);
                    const request = await fetch(asset.browser_download_url);
                    const blob = await request.blob();
                    await minioClient.putObject('releases', `${releaseVersion}/${asset.name}`, Buffer.from(await blob.arrayBuffer()));
                } else {
                    console.log(`\t found ${asset.name}, skipping ...`);
                }
            }
        }
    }

    const bootloader = await octo.rest.repos.listReleases({
        owner: 'am32-firmware',
        repo: 'AM32-bootloader'
    });
    
    const bootloaderData = await bootloader.data;

    console.log(`got ${bootloaderData.length} bootloader releases`);


    const bootloaderStream = minioClient.listObjectsV2('bootloaders', '', true, '');

    const uploadedBootloaders: {
        [key: string]: string[]
    } = {};

    bootloaderStream.on('data', (obj) => {
        if (obj.name) {
            const [release, asset] = obj.name.split('/');
            if (!uploadedBootloaders[release]) {
                uploadedBootloaders[release] = [];
            }
            uploadedBootloaders[release].push(asset);
        }
    });


    await finished(bootloaderStream);

    for (const release of bootloaderData) {
        const semverTagName = release.tag_name;
        const verTag = coerce(semverTagName);
        const verMinTag = coerce('v12.0.0');

        if (verTag && verMinTag && compare(verTag, verMinTag) >= 0) {
            console.log(`processing: ${release.tag_name}`);
            for (const asset of release.assets) {
                console.log(`\t asset: ${asset.name}`);
                let releaseVersion = `${release.tag_name}`;
                if (release.prerelease) {
                    releaseVersion += '-rc';
                }
                if (!uploadedBootloaders[releaseVersion] || !uploadedBootloaders[releaseVersion].includes(asset.name)) {
                    console.log(`\t uploading ${asset.name}`);
                    const request = await fetch(asset.browser_download_url);
                    const blob = await request.blob();
                    await minioClient.putObject('bootloaders', `${releaseVersion}/${asset.name}`, Buffer.from(await blob.arrayBuffer()));
                } else {
                    console.log(`\t found ${asset.name}, skipping ...`);
                }
            }
        }
    }

    return releasesData;
}
