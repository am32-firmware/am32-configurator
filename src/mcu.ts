import type { McuSettings } from './eeprom';

export interface McuVariant {
    name: string;
    signature: string;
    page_size: number;
    flash_size: number;
    flash_offset: string;
    firmware_start: string;
    eeprom_offset: string;
}

/*
  v3 deviceInfo block read via ADDRESS_MAGIC_DEVINFO (0x23).
  All *_start values are CMD_SET_ADDRESS values (already >> address_shift);
  the bootloader reconstructs the real flash address with
  (addr << address_shift) + flash_offset, matching its decodeInput().
 */
export interface DevinfoV3 {
    length: number;
    address_shift: number;
    firmware_start: number;
    filename_start: number;
    eeprom_start: number;
    tune_start: number;
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
    /*
      Bootloader protocol features the configurator detected on this ESC.
      v3 != null means the bootloader responded to the ADDRESS_MAGIC_DEVINFO
      read with valid magic, so its address_shift / *_start values are
      authoritative and override the per-MCU defaults.
     */
    v3: DevinfoV3 | null;
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
            1506: {
                name: 'NXP ESC_8KB_PAGE',
                signature: '0x1506',
                page_size: 1024,
                flash_size: 65536,
                flash_offset: '0x08000000',
                firmware_start: '0x4000',
                eeprom_offset: '0xE000'
            },
            '2B06': {
                // STM32G431/G491 (128k AM32 CAN ESCs). The firmware_start /
                // eeprom_offset here are pre-v3 defaults; v3 bootloaders override
                // them via the magic devinfo block (see McuInfo.v3).
                name: 'STM32G431',
                signature: '0x2b06',
                page_size: 2048,
                flash_size: 131072,
                flash_offset: '0x08000000',
                firmware_start: '0x4000',
                eeprom_offset: '0x1f800'
            }
        };

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

    /**
     * Bootloader CMD_SET_ADDRESS shift. 0 by default; for 128k parts the v3
     * devinfo block reports 2 (so the 16-bit wire address can reach above
     * 0xFFFF). Pre-v3 ESCs default to 0 — the configurator only had 64k MCU
     * variants in that era, so no scaling was needed.
     */
    getAddressShift (): number {
        return this.info?.v3?.address_shift ?? 0;
    }

    /**
     * Convert a physical byte offset (from flash_offset) to the CMD_SET_ADDRESS
     * value the bootloader expects. The bootloader reconstructs the real flash
     * address with (wire << address_shift) + flash_offset.
     */
    toWireAddress (byteOffset: number): number {
        const shift = this.getAddressShift();
        if (shift > 0) {
            const align = (1 << shift) - 1;
            if ((byteOffset & align) !== 0) {
                // address_shift loses these low bits; the caller should be
                // stepping in aligned chunks.
                throw new Error(`toWireAddress: 0x${byteOffset.toString(16)} not aligned to ${1 << shift}`);
            }
        }
        const wire = byteOffset >>> shift;
        if (wire > 0xFFFF) {
            // the bootloader wire address is 16-bit. If the byte offset
            // doesn't fit after shifting, masking to 0xFFFF would silently
            // wrap (e.g. on a 128k part without v3, 0x1f800 -> 0xf800), so
            // hard-fail instead of corrupting flash addressing.
            throw new Error(`toWireAddress: 0x${byteOffset.toString(16)} exceeds 16-bit wire range with shift ${shift}; v3 devinfo needed for this MCU`);
        }
        return wire;
    }

    /**
     * Byte offset (from flash_offset) of the application entry. With v3 this
     * comes from the bootloader; otherwise from the per-MCU variant default.
     */
    getFirmwareStartByte (): number {
        const v3 = this.info?.v3;
        if (v3) {
            return v3.firmware_start << v3.address_shift;
        }
        return this.getFirmwareStart();
    }

    /**
     * Byte offset (from flash_offset) of the EEPROM region. With v3 this comes
     * from the bootloader; otherwise from the per-MCU variant default.
     */
    getEepromStartByte (): number {
        const v3 = this.info?.v3;
        if (v3) {
            return v3.eeprom_start << v3.address_shift;
        }
        return this.getEepromOffset();
    }

    /**
     * CMD_SET_ADDRESS value at which the EEPROM region starts.
     */
    getEepromWireAddress (): number {
        const v3 = this.info?.v3;
        if (v3) {
            return v3.eeprom_start;
        }
        return this.toWireAddress(this.getEepromOffset());
    }

    /**
     * Byte offset (from flash_offset) of the 32-byte file-name block. With v3
     * this comes from the bootloader (DroneCAN builds place it away from the
     * EEPROM); otherwise it sits 32 bytes below the EEPROM region.
     */
    getFileNameStartByte (): number {
        const v3 = this.info?.v3;
        if (v3) {
            return v3.filename_start << v3.address_shift;
        }
        return this.getEepromOffset() - 32;
    }

    /**
     * CMD_SET_ADDRESS value of the file-name region (EEPROM - 32 bytes).
     */
    getFileNameWireAddress (): number {
        const v3 = this.info?.v3;
        if (v3) {
            return v3.filename_start;
        }
        return this.toWireAddress(this.getEepromOffset() - 32);
    }
}

export default Mcu;
