import fetchReleases from './src/fetch-releases';
import 'dotenv';

(async function () {
    console.log('fetching releases');
    await fetchReleases(process.env.BLOB_READ_WRITE_TOKEN!, 'v2.08');
})();
