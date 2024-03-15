import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetchReleases from '~/src/fetch-releases';

export default async function handler (
    _request: VercelRequest,
    response: VercelResponse
) {
    const data = await fetchReleases(undefined, 'v2.08');
    return response.json({ releases: data });
}
