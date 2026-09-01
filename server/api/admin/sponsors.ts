export default defineEventHandler(async (event) => {
    await validateAdminSession(event);

    if (isMethod(event, 'GET')) {
        const sponsors = await getAllSponsors();
        return { data: sponsors };
    }

    if (isMethod(event, 'POST')) {
        const body = await readBody(event);

        if (!body.name || !body.image || !body.url) {
            throw createError({
                statusCode: 400,
                statusMessage: 'name, image, and url are required'
            });
        }

        const id = crypto.randomUUID();

        const sponsor = await createSponsor({
            id,
            name: body.name,
            image: body.image,
            url: body.url,
            class: body.class ?? '',
            hideAfter: body.hideAfter ? new Date(body.hideAfter).toISOString() : null
        });

        return { data: sponsor };
    }

    throw createError({
        statusCode: 405,
        statusMessage: 'method not allowed'
    });
});
