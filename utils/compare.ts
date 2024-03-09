export default function compare (a: Uint8Array, b: Uint8Array) {
    if (a.byteLength !== b.byteLength) {
        return false;
    }

    for (let i = 0; i < a.byteLength; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}
