export default function (ascii: string) {
    const buffer = new Uint8Array(ascii.length);

    for (let i = 0; i < ascii.length; i += 1) {
        buffer[i] = ascii.charCodeAt(i);
    }

    return buffer;
}
