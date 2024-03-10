export default async function () {
    return await $fetch('https://api.github.com/repos/am32-firmware/AM32/releases');
}
