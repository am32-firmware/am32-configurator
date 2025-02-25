import { EepromLayout } from './../src/eeprom';
import Mcu from '~/src/mcu';
import type { McuSettings } from '~/src/eeprom';

export default function (settingsObject: McuSettings, eepromVersion: number) {
    const array = new Uint8Array(Mcu.LAYOUT_SIZE).fill(0xFF);

    for (const [prop, setting] of Object.entries(EepromLayout)) {
        const {
            size,
            offset
        } = setting;

        if ((setting.maxEepromVersion !== undefined && eepromVersion > setting.maxEepromVersion) ||
            (setting.minEepromVersion !== undefined && eepromVersion < setting.minEepromVersion)) {
            continue;
        }

        const value: number | number[] | string = settingsObject[prop] as number;

        if (size === 1) {
            array[offset] = value;
        } else if (size === 2) {
            array[offset] = (value >> 8) & 0xFF;
            array[offset + 1] = value & 0xFF;
        } else if (size > 2) {
            const { length } = settingsObject[prop] as any[];
            for (let i = 0; i < size; i += 1) {
                if (prop === 'STARTUP_MELODY') {
                    array[offset + i] = i < length ? (value as unknown as any[])[i] % 256 : 0;
                } else {
                    array[offset + i] = i < length ? (value as unknown as string).charCodeAt(i) : ' '.charCodeAt(0);
                }
            }
        } else {
            throw new Error('ConversionError');
        }
    }

    return array;
}
