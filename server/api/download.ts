export default defineEventHandler(async (event) => {
    const query = getQuery(event);

    if (query.url && query.url.toString().startsWith('https://github.com/am32-firmware')) {
        const file = await fetch(query.url.toString());
        return await file.text();
    }
    
    throw createError({
        statusCode: 400,
        statusMessage: 'url not allowed'
    });
  })