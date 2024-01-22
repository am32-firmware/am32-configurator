import type { McuSettings } from './../src/eeprom';
import { EepromLayout } from './../src/eeprom';
export default function (buffer: Uint8Array) {
    const object: McuSettings = {};

    for (const [prop, setting] of Object.entries(EepromLayout)) {
        const {
            size,
            offset
        } = setting;

        if (size === 1) {
            object[prop] = buffer[offset];
        } else if (size === 2) {
            object[prop] = (buffer[offset] << 8) | buffer[offset + 1];
        } else if (size > 2) {
            if (prop === 'STARTUP_MELODY') {
                object[prop] = buffer.subarray(offset, offset + size);
                object[prop] = Array.from(object[prop] as Uint8Array);
            } else {
                object[prop] = new TextDecoder().decode(buffer.subarray(offset, offset + size)).trim();
            }
        } else {
            throw new Error('conversion error');
        }
    }

    return object;
}
