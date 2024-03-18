import 'dotenv';

import fetchAndUploadReleases from './src/fetch-and-upload-releases';

(async function () {
    console.log('fetching releases');
    await fetchAndUploadReleases('v2.08');
})();
