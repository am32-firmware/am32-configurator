type LogMessageType = undefined | null | 'warning' | 'error'
type LogMessage = [Date, string, LogMessageType]
type LogFn = (s: string) => void;
type PromiseFn = (a: unknown | PromiseLike) => any
interface MspData {
    type: 'bf' | 'qs' | 'kiss' | null,
    protocol_version: number
    api_version: string,
    batteryData: {
        cellCount: number,
        capacity: number,
        voltage: number,
        drawn: number,
        amps: number
    } | null,
    motorCount: number
}

interface EscData {
    isLoading: boolean;
    boot: number;
    eeprom_version: number;
    bootloader_version: number;
    firmware: {
        major: number;
        minor: number;
    };
    name: string;
    reversed: boolean;
}

interface FourWayResponse {
    command: number;
    address: number;
    ack: number;
    checksum: number;
    params: Uint8Array;
}
interface McuVariant {
    name: string;
    signature: string;
    page_size: number;
    flash_size: number;
    flash_offset: string;
    firmware_start: string;
    eeprom_offset: string;
}
interface McuInfo {
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
        version: string;
    },
    layoutSize: number;
}