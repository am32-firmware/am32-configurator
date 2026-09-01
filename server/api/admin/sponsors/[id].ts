export default defineEventHandler(async (event) => {
    await validateAdminSession(event);

    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'id is required'
        });
    }

    if (isMethod(event, 'PUT')) {
        const body = await readBody(event);

        const sponsor = await updateSponsor(id, {
            name: body.name,
            image: body.image,
            url: body.url,
            class: body.class,
            hideAfter: body.hideAfter !== undefined
                ? (body.hideAfter ? new Date(body.hideAfter).toISOString() : null)
                : null
        });

        if (!sponsor) {
            throw createError({
                statusCode: 404,
                statusMessage: 'sponsor not found'
            });
        }

        return { data: sponsor };
    }

    if (isMethod(event, 'DELETE')) {
        const deleted = await deleteSponsor(id);

        if (!deleted) {
            throw createError({
                statusCode: 404,
                statusMessage: 'sponsor not found'
            });
        }

        return { data: { id } };
    }

    throw createError({
        statusCode: 405,
        statusMessage: 'method not allowed'
    });
});
