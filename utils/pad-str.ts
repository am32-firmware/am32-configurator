export default function (text: string, pad: number, padChar: string) {
    if (text.length < pad) {
        return padChar.repeat(pad - text.length) + text;
    }
    return text;
}
