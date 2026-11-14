import { EepromLayout } from './../src/eeprom';
import Mcu from '~/src/mcu';
import type { EepromField, McuSettings } from '~/src/eeprom';

export default function (settingsObject: McuSettings, eepromVersion: number) {
    const array = new Uint8Array(Mcu.LAYOUT_SIZE).fill(0xFF);
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

        // a field that was never read (truncated source) keeps the erased value
        if (settingsObject[prop] === undefined) {
            continue;
        }

        if (size === 1) {
            array[offset] = Number(settingsObject[prop]);
        } else if (size === 2) {
            const value = Number(settingsObject[prop]);
            array[offset] = (value >> 8) & 0xFF;
            array[offset + 1] = value & 0xFF;
        } else if (size > 2) {
            // tune and CAN block are raw byte blocks; a short tune is padded
            // with 0 (end of melody), anything else with the erased value
            const bytes = settingsObject[prop] as ArrayLike<number>;
            const pad = prop === 'STARTUP_MELODY' ? 0x00 : 0xFF;
            for (let i = 0; i < size; i += 1) {
                array[offset + i] = i < bytes.length ? bytes[i] & 0xFF : pad;
            }
        } else {
            throw new Error('ConversionError');
        }
    }

    return array;
}
