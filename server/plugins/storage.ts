import redisDriver from 'unstorage/drivers/redis';

export default defineNitroPlugin(() => {
    const storage = useStorage();

    const tools = redisDriver({
        base: 'redis',
        host: useRuntimeConfig().redis.host,
        port: useRuntimeConfig().redis.port,
        db: 0
    });

    const releases = redisDriver({
        base: 'redis',
        host: useRuntimeConfig().redis.host,
        port: useRuntimeConfig().redis.port,
        db: 1
    });

    const bootloaders = redisDriver({
        base: 'redis',
        host: useRuntimeConfig().redis.host,
        port: useRuntimeConfig().redis.port,
        db: 2
    });

    storage.mount('tools', tools);
    storage.mount('releases', releases);
    storage.mount('bootloaders', bootloaders);
});
