export default function (data: DataView, offset: number, fallback = 0) {
    return data.byteLength > offset ? data.getUint8(offset) : fallback;
}
