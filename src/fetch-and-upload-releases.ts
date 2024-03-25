import { getStore } from '@netlify/blobs';
import { Octokit } from 'octokit';
import semver from 'semver';
import 'dotenv';

export default async function (minTag?: string) {
    const octo = new Octokit();
    const releases = await octo.rest.repos.listReleases({
        owner: 'am32-firmware',
        repo: 'am32'
    });
    const data = await releases.data;

    console.log(`got ${data.length} releases`);

    const semverMinTag = minTag?.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2') ?? 'v0.0';

    const releasesStore = getStore({
        name: 'releases',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

    const githubStore = getStore({
        name: 'github-releases-cache',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

    await githubStore.setJSON('releases-cache', releases);

    for (const release of data) {
        const semverTagName = release.tag_name.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2');

        if (semver.compare(semver.coerce(semverTagName)!, semver.coerce(semverMinTag)!) >= 0) {
            console.log(`processing: ${release.tag_name}`);

            const path = `${release.tag_name}`;
            const check = await releasesStore.list({
                prefix: release.tag_name
            });
            for (const asset of release.assets) {
                console.log(`\t asset: ${asset.name}`);
                if (!check.blobs.find(b => b.key.endsWith(asset.name))) {
                    console.log(`\t uploading ${asset.name}`);
                    const request = await fetch(asset.browser_download_url);
                    const blob = await request.blob();
                    await releasesStore.set(`${path}/${asset.name}`, blob);
                } else {
                    console.log(`\t found ${asset.name}, skipping ...`);
                }
            }
        }
    }

    return data;
}
