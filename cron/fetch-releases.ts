import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlobNotFoundError, head, put } from '@vercel/blob';
import { Octokit } from 'octokit';

export default async function handler (
    _request: VercelRequest,
    response: VercelResponse
) {
    const octo = new Octokit();
    const releases = await octo.rest.repos.listReleases({
        owner: 'am32-firmware',
        repo: 'am32'
    });
    const data = await releases.data;

    for (const release of data) {
        for (const asset of release.assets) {
            const path = `/releases/${release.tag_name}/${asset.name}`;
            try {
                await head(path);
            } catch (e) {
                if (e instanceof BlobNotFoundError) {
                    const request = await fetch(asset.browser_download_url);
                    const blob = await request.blob();
                    await put(path, blob, { access: 'public' });
                }
            }
        }
    }

    return response.json({ releases: data });
}
