import { hash } from 'bcrypt';

export default defineEventHandler(async (event) => {
    await validateAdminSession(event);

    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'id is required'
        });
    }

    if (isMethod(event, 'GET')) {
        const user = await getUserById(id);
        if (!user) {
            throw createError({
                statusCode: 404,
                statusMessage: 'user not found'
            });
        }
        return { data: user };
    }

    if (isMethod(event, 'PUT')) {
        const body = await readBody(event);

        const updates: {
            username?: string;
            password?: string;
            email?: string | null;
            role?: string;
            active?: boolean;
        } = {};

        if (body.username !== undefined) {
            const existing = await getUserByUsername(body.username);
            if (existing && existing.id !== id) {
                throw createError({
                    statusCode: 409,
                    statusMessage: 'username already exists'
                });
            }
            updates.username = body.username;
        }

        if (body.password !== undefined) {
            updates.password = await hash(body.password, 10);
        }

        if (body.email !== undefined) {
            updates.email = body.email || null;
        }

        if (body.role !== undefined) {
            updates.role = body.role;
        }

        if (body.active !== undefined) {
            updates.active = body.active;
        }

        const user = await updateUser(id, updates);
        if (!user) {
            throw createError({
                statusCode: 404,
                statusMessage: 'user not found'
            });
        }

        return { data: user };
    }

    if (isMethod(event, 'DELETE')) {
        const deleted = await deleteUser(id);
        if (!deleted) {
            throw createError({
                statusCode: 404,
                statusMessage: 'user not found'
            });
        }
        return { data: { id } };
    }

    throw createError({
        statusCode: 405,
        statusMessage: 'method not allowed'
    });
});
