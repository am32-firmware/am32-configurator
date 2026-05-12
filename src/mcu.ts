import type { McuSettings } from './eeprom';

export interface McuVariant {
    name: string;
    signature: string;
    page_size: number;
    flash_size: number;
    flash_offset: string;
    firmware_start: string;
    eeprom_offset: string;
    address_shift?: number;
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
                eeprom_offset: '0x7c00'
            },
            3506: {
                name: 'ARM64K',
                signature: '0x3506',
                page_size: 1024,
                flash_size: 65536,
                flash_offset: '0x08000000',
                firmware_start: '0x1000',
                eeprom_offset: '0xF800'
            },
            '2B06': {
                name: 'STM32G431',
                signature: '0x2b06',
                page_size: 2048,
                flash_size: 131072,
                flash_offset: '0x08000000',
                firmware_start: '0x1000',
                eeprom_offset: '0x1f800',
                address_shift: 2
            }
        };

    static CAN_FIRMWARE_START = '0x4000';

    static RESET_DELAY_MS = 5000;
    static LAYOUT_SIZE = 0xB8;

    static BOOT_LOADER_VERSION_OFFSET = 0x00C0;
    static BOOT_LOADER_VERSION_SIZE = 1;

    static PORT_CHARACTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    static PIN_CHARACTERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];

    static parseBootLoaderPin (pin: number): [boolean, string] {
        const port = pin >> 4;
        const pinNumber = pin & 0xF;
        if (Mcu.PORT_CHARACTERS[port] && Mcu.PIN_CHARACTERS[pinNumber]) {
            return [true, `P${Mcu.PORT_CHARACTERS[port]}${Mcu.PIN_CHARACTERS[pinNumber]}`];
        }
        return [false, ''];
    }

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
     * Get page size
     *
     * @returns {number}
     */
    getPageSize () {
        return this.mcu.page_size;
    }

    /**
     * Get address shift for 128K+ flash boards.
     * The bootloader left-shifts wire addresses by this amount.
     *
     * @returns {number}
     */
    getAddressShift () {
        return this.mcu.address_shift ?? 0;
    }

    /**
     * Convert a physical flash offset to a wire address for the 4-way protocol.
     * 128K flash boards use ADDRESS_SHIFT=2 in the bootloader.
     *
     * @param {number} physicalOffset
     * @returns {number}
     */
    toWireAddress (physicalOffset: number) {
        return physicalOffset >> this.getAddressShift();
    }

    /**
     * Check if firmware is a DroneCAN build based on file name
     */
    isDroneCAN (): boolean {
        return this.info?.meta.am32.fileName?.includes('CAN') ?? false;
    }

    /**
     * Get firmware start address
     *
     * @returns {number}
     */
    getFirmwareStart () {
        if (this.mcu.firmware_start) {
            if (this.isDroneCAN()) {
                return parseInt(Mcu.CAN_FIRMWARE_START, 16);
            }
            return parseInt(this.mcu.firmware_start, 16);
        }

        throw new Error('MCU does not have firmware start address');
    }
}

export default Mcu;
