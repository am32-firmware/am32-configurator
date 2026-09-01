import { compare } from 'bcrypt';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);

    if (!body.username || !body.password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'username and password are required'
        });
    }

    const user = await getUserByUsername(body.username);

    if (!user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'invalid credentials'
        });
    }

    if (!user.active) {
        throw createError({
            statusCode: 403,
            statusMessage: 'account is disabled'
        });
    }

    const passwordValid = await compare(body.password, user.password);

    if (!passwordValid) {
        throw createError({
            statusCode: 401,
            statusMessage: 'invalid credentials'
        });
    }

    const sessionToken = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await createSession(sessionToken, user.username, expiresAt);

    setCookie(event, 'session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60
    });

    return { data: { username: user.username } };
});
