export default defineEventHandler(async (event) => {
    const sessionToken = getCookie(event, 'session');

    if (!sessionToken) {
        throw createError({
            statusCode: 401,
            statusMessage: 'unauthorized'
        });
    }

    const session = await getSession(sessionToken);

    if (!session || session.expiresAt < Date.now()) {
        if (session) {
            await deleteSession(sessionToken);
        }
        deleteCookie(event, 'session');
        throw createError({
            statusCode: 401,
            statusMessage: 'unauthorized'
        });
    }

    return { data: { username: session.username } };
});
