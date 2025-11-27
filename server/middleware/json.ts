export default defineEventHandler((event) => {
    const url = getRequestURL(event);
    console.log(event.node);
    if (url.pathname.endsWith('json')) {
        // sendRedirect(event, url.pathname.replace(/\.json$/, ''));
        // event.context.matchedRoute = url.pathname.replace(/\.json$/, '');
    }
});
