import { list, put } from '@vercel/blob';
import { Octokit } from 'octokit';
import semver from 'semver';

export default async function (token?: string, minTag?: string) {
    const octo = new Octokit();
    const releases = await octo.rest.repos.listReleases({
        owner: 'am32-firmware',
        repo: 'am32'
    });
    const data = await releases.data;

    console.log(`got ${data.length} releases`);

    const semverMinTag = minTag?.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2') ?? 'v0.0';

    for (const release of data) {
        const semverTagName = release.tag_name.replace(/(v[0-9]+)\.0?([0-9])/i, '$1.$2');

        if (semver.compare(semver.coerce(semverTagName)!, semver.coerce(semverMinTag)!) >= 0) {
            console.log(`processing: ${release.tag_name}`);

            const path = `releases/${release.tag_name}`;
            const check = await list({
                prefix: path,
                token
            });
            for (const asset of release.assets) {
                console.log(`\t asset: ${asset.name}`);
                if (!check.blobs.find(b => b.pathname.endsWith(asset.name))) {
                    console.log(`\t uploading ${asset.name}`);
                    const request = await fetch(asset.browser_download_url);
                    const blob = await request.blob();
                    await put(`${path}/${asset.name}`, blob, { access: 'public', token });
                } else {
                    console.log(`\t found ${asset.name}, skipping ...`);
                }
            }
        }
    }

    return data;
}
