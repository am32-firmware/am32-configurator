import type { Config } from '@netlify/functions';
import fetchReleases from '~/src/fetch-and-upload-releases';

export default async (_request: Request) => {
    await fetchReleases('v2.08');
};

export const config: Config = {
    schedule: '@daily'
};
