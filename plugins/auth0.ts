import { createAuth0 } from '@auth0/auth0-vue';

export default defineNuxtPlugin((nuxtApp) => {
    const config = useRuntimeConfig();

    const auth0 = createAuth0({
        domain: config.public.auth0_domain,
        clientId: config.public.auth0_client_id
    });

    console.log(auth0);

    if (process.client) {
        nuxtApp.vueApp.use(auth0);
    }

    addRouteMiddleware('auth', () => {
        if (process.client) {
            auth0.checkSession();
            if (!auth0.isAuthenticated.value) {
                auth0.loginWithPopup();
            }
        }
    });
});
