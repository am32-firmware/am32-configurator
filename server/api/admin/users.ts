import { hash } from 'bcrypt';

export default defineEventHandler(async (event) => {
    await validateAdminSession(event);

    if (isMethod(event, 'GET')) {
        const users = await getAllUsers();
        return { data: users };
    }

    if (isMethod(event, 'POST')) {
        const body = await readBody(event);

        if (!body.username || !body.password) {
            throw createError({
                statusCode: 400,
                statusMessage: 'username and password are required'
            });
        }

        const existing = await getUserByUsername(body.username);
        if (existing) {
            throw createError({
                statusCode: 409,
                statusMessage: 'username already exists'
            });
        }

        const hashedPassword = await hash(body.password, 10);
        const user = await createUser({
            username: body.username,
            password: hashedPassword,
            email: body.email,
            role: body.role
        });

        return { data: user };
    }

    throw createError({
        statusCode: 405,
        statusMessage: 'method not allowed'
    });
});
