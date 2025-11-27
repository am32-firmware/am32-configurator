export default defineEventHandler((event) => {
    const url = getRequestURL(event);
    if (url.pathname.endsWith('json')) {
        sendRedirect(event, url.pathname.replace(/\.json$/, ''));
    }
});
