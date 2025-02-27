import type { McuSettings } from './eeprom';

export interface McuVariant {
    name: string;
    signature: string;
    page_size: number;
    flash_size: number;
    flash_offset: string;
    firmware_start: string;
    eeprom_offset: string;
    eeprom_address_shift: number;
}

export interface McuInfo {
    meta: {
        signature: number;
        input: number;
        interfaceMode: number;
        available: boolean;
        am32: {
            fileName: string | null;
            mcuType: string | null;
        };
    };
    displayName: string;
    firmwareName: string;
    supported: boolean;
    bootloader: {
        input: number;
        valid: boolean;
        pin: string;
        version: number;
    },
    layoutSize: number;
    settingsDirty: boolean;
    settings: McuSettings;
    settingsBuffer: Uint8Array;
    isSelected: boolean;
}

export interface EscData {
    isLoading: boolean;
    isError: boolean;
    data: McuInfo;
}

class Mcu {
    static variants: {
        [key: string]: McuVariant;
    } = {
            '1F06': {
                name: 'STM32F051',
                signature: '0x1f06',
                page_size: 1024,
                flash_size: 65536,
                flash_offset: '0x08000000',
                firmware_start: '0x1000',
                eeprom_offset: '0x7c00',
                eeprom_address_shift: 0,
            },
            3506: {
                name: 'ARM64K',
                signature: '0x3506',
                page_size: 1024,
                flash_size: 65536,
                flash_offset: '0x08000000',
                firmware_start: '0x1000',
                eeprom_offset: '0xF800',
                eeprom_address_shift: 0,
            },
            '2B06': {
                name: 'STM32G071 128KB',
                signature: '0x2b06',
                page_size: 2048,
                flash_size: 131072,
                flash_offset: '0x08000000',
                firmware_start: '0x1000',
                eeprom_offset: '0x1F800',
                eeprom_address_shift: 2,
            }
        };

    static BOOT_LOADER_PINS = {
        PA2: 0x02,
        PB4: 0x14
    };

    static RESET_DELAY_MS = 5000;
    static LAYOUT_SIZE = 0xB8;

    static BOOT_LOADER_VERSION_OFFSET = 0x00C0;
    static BOOT_LOADER_VERSION_SIZE = 1;

    static getVariant (signature: number) {
        const mcu = Mcu.variants[signature.toString(16).toUpperCase()];
        if (!mcu) {
            throw new Error(`mcu signature ${signature.toString(16).toUpperCase()} unknown!`);
        }
        return mcu;
    }

    private mcu: McuVariant;
    private info: McuInfo | null = null;

    constructor (signature: number) {
        this.mcu = Mcu.getVariant(signature);
    }

    setInfo (info: McuInfo) {
        this.info = info;
    }

    getInfo (): McuInfo {
        return this.info as McuInfo;
    }

    /**
   * Get MCU name
   *
   * @returns {string}
   */
    getName () {
        return this.mcu.name;
    }

    /**
     * Get flash size in bytes
     *
     * @returns {number}
     */
    getFlashSize () {
        return this.mcu.flash_size;
    }

    /**
     * Get address of flash offset
     *
     * @returns {number}
     */
    getFlashOffset () {
        return parseInt(this.mcu.flash_offset, 16);
    }

    /**
     * Get address of EEprom offset
     *
     * @returns {number}
     */
    getEepromOffset () {
        return parseInt(this.mcu.eeprom_offset, 16);
    }

    /**
     * Get shit in number of bits of the EEprom offset for the four way communication.
     * This is needed because the address is coded on 2 bytes but for large flash
     * MCUs the address goes beyond the range (e.g. 0x1F800)
     *
     * @returns {number}
     */
    getEepromAddressShift() {
        return this.mcu.eeprom_address_shift;
    }

    /**
     * Get page size
     *
     * @returns {number}
     */
    getPageSize () {
        return this.mcu.page_size;
    }

    /**
     * Get firmware start address
     *
     * @returns {number}
     */
    getFirmwareStart () {
        if (this.mcu.firmware_start) {
            return parseInt(this.mcu.firmware_start, 16);
        }

        throw new Error('MCU does not have firmware start address');
    }
}

export default Mcu;
