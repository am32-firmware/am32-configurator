import fs from 'fs';
import path from 'path';

import { getStore } from '@netlify/blobs';
import fetchReleases from '~/src/fetch-and-upload-releases';
import 'dotenv';

(async function () {
    console.log('uploading files');

    const bootloaderStore = getStore({
        name: 'bootloader',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });

    /*
    const toolsStore = getStore({
        name: 'tools',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
    });
    */

    const bootloader = fs.readdirSync(path.resolve(__dirname, 'bootloader'));
    // const tools = fs.readdirSync(path.resolve(__dirname, 'tools'));

    console.log('bootloader:');

    for (const bl of bootloader) {
        const check = await bootloaderStore.list({
            prefix: bl
        });
        if (!check.blobs.find(b => b.key === bl)) {
            console.log(`\tuploading ${bl}`);
            const file = fs.readFileSync(path.resolve(__dirname, 'bootloader', bl));
            await bootloaderStore.set(bl, file);
        } else {
            console.log(`\tskip ${bl}`);
        }
    }

    /*
    console.log('tools:');

    for (const tool of tools) {
        const check = await toolsStore.list({
            prefix: tool
        });
        if (!check.blobs.find(b => b.key === tool)) {
            console.log(`\tuploading ${tool}`);
            const file = fs.readFileSync(path.resolve(__dirname, 'tools', tool));
            await toolsStore.set(tool, file);
        } else {
            console.log(`\tskip ${tool}`);
       }
    }
    */

    await fetchReleases('v2.08');

    /* for (const release of data) {
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
    } */
})();
