export default defineEventHandler(async () => {
    const sponsors = await getActiveSponsors();
    return { data: sponsors };
});
