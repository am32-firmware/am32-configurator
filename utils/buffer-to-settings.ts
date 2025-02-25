import type { EepromField, McuSettings } from './../src/eeprom';
import { EepromLayout } from './../src/eeprom';
export default function (buffer: Uint8Array, eepromVersion: number) {
    const object: McuSettings = {};
    const entries: [string, EepromField][] = Object.entries(EepromLayout);

    for (const [prop, setting] of entries) {
        const {
            size,
            offset
        } = setting;

        if ((setting.maxEepromVersion !== undefined && eepromVersion > setting.maxEepromVersion) ||
            (setting.minEepromVersion !== undefined && eepromVersion < setting.minEepromVersion)) {
            continue;
        }

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
