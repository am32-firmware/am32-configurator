export interface EepromField {
    offset: number;
    size: number;
}

export const EepromLayout: {
    [key: string]: EepromField
} = {
    BOOT_BYTE: {
        offset: 0x00,
        size: 1
    },
    LAYOUT_VERSION: {
        offset: 0x01,
        size: 1,
    },
    BOOT_LOADER_VERSION: {
        offset: 0x02,
        size: 1,
    },
    FIRMWARE_VERSION_MAJOR: {
        offset: 0x03,
        size: 1,
    },
    FIRMWARE_VERSION_MINOR: {
        offset: 0x04,
        size: 1,
    },
    NAME: {
        offset: 0x05,
        size: 12,
    },
    MOTOR_DIRECTION: {
        offset: 0x11,
        size: 1,
    },
}