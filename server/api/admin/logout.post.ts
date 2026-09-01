export default defineEventHandler(async (event) => {
    const sessionToken = getCookie(event, 'session');

    if (sessionToken) {
        await deleteSession(sessionToken);
    }

    deleteCookie(event, 'session');

    return { data: { success: true } };
});
