// Mirrors the AM32 firmware EEprom_t (Inc/eeprom.h): 48 setting bytes, a
// 128 byte startup tune and a 16 byte CAN block - 192 bytes in total.
// Fields wider than two bytes are raw byte blocks, never text.
export interface EepromField {
    offset: number;
    size: number;
    minEepromVersion?: number;
    maxEepromVersion?: number;
    // Replaces an out-of-range value the same way the firmware's
    // loadEEpromSettings() rewrites it on boot, so the UI shows what the ESC
    // actually runs with instead of garbage the controls cannot represent.
    sanitize?: (value: number) => number;
}

export type EepromLayoutField = {
    [key: string]: EepromField;
}

export const EepromLayout = {
    BOOT_BYTE: {
        offset: 0x00,
        size: 1
    },
    LAYOUT_REVISION: {
        offset: 0x01,
        size: 1
    },
    BOOT_LOADER_REVISION: {
        offset: 0x02,
        size: 1
    },
    MAIN_REVISION: {
        offset: 0x03,
        size: 1
    },
    SUB_REVISION: {
        offset: 0x04,
        size: 1
    },
    MAX_RAMP: {
        offset: 0x05,
        size: 1,
        minEepromVersion: 3
    },
    MINIMUM_DUTY_CYCLE: {
        offset: 0x06,
        size: 1,
        minEepromVersion: 3
    },
    DISABLE_STICK_CALIBRATION: {
        offset: 0x07,
        size: 1,
        minEepromVersion: 3
    },
    ABSOLUTE_VOLTAGE_CUTOFF: {
        offset: 0x08,
        size: 1,
        minEepromVersion: 3
    },
    CURRENT_P: {
        offset: 0x09,
        size: 1,
        minEepromVersion: 3
    },
    CURRENT_I: {
        offset: 0x0A,
        size: 1,
        minEepromVersion: 3
    },
    CURRENT_D: {
        offset: 0x0B,
        size: 1,
        minEepromVersion: 3
    },
    ACTIVE_BRAKE_POWER: {
        offset: 0x0C,
        size: 1,
        minEepromVersion: 3
    },
    // added with eeprom layout 4 / firmware 2.21; before that byte 13 held
    // part of the firmware name
    BRAKE_ON_ZERO_THROTTLE: {
        offset: 0x0D,
        size: 1,
        minEepromVersion: 4,
        sanitize: (value: number) => (value > 9 ? 0 : value)
    },
    // added with firmware 2.22 without a layout bump (still layout 4), so
    // the UI gates it on the firmware version. 0 off, 1 coast only,
    // 2/3/4 = 1/32, 1/16, 1/8 power cut after demag recovery
    DEMAG_COMPENSATION: {
        offset: 0x0E,
        size: 1,
        minEepromVersion: 4,
        sanitize: (value: number) => (value > 4 ? 0 : value)
    },
    MOTOR_DIRECTION: {
        offset: 0x11,
        size: 1
    },
    BIDIRECTIONAL_MODE: {
        offset: 0x12,
        size: 1
    },
    SINUSOIDAL_STARTUP: {
        offset: 0x13,
        size: 1
    },
    COMPLEMENTARY_PWM: {
        offset: 0x14,
        size: 1
    },
    VARIABLE_PWM_FREQUENCY: {
        offset: 0x15,
        size: 1
    },
    STUCK_ROTOR_PROTECTION: {
        offset: 0x16,
        size: 1
    },
    TIMING_ADVANCE: {
        offset: 0x17,
        size: 1
    },
    PWM_FREQUENCY: {
        offset: 0x18,
        size: 1
    },
    STARTUP_POWER: {
        offset: 0x19,
        size: 1
    },
    MOTOR_KV: {
        offset: 0x1A,
        size: 1
    },
    MOTOR_POLES: {
        offset: 0x1B,
        size: 1
    },
    BRAKE_ON_STOP: {
        offset: 0x1C,
        size: 1
    },
    STALL_PROTECTION: {
        offset: 0x1D,
        size: 1
    },
    BEEP_VOLUME: {
        offset: 0x1E,
        size: 1
    },
    INTERVAL_TELEMETRY: {
        offset: 0x1F,
        size: 1
    },
    SERVO_LOW_THRESHOLD: {
        offset: 0x20,
        size: 1
    },
    SERVO_HIGH_THRESHOLD: {
        offset: 0x21,
        size: 1
    },
    SERVO_NEUTRAL: {
        offset: 0x22,
        size: 1
    },
    SERVO_DEAD_BAND: {
        offset: 0x23,
        size: 1
    },
    LOW_VOLTAGE_CUTOFF: {
        offset: 0x24,
        size: 1
    },
    LOW_VOLTAGE_THRESHOLD: {
        offset: 0x25,
        size: 1
    },
    RC_CAR_REVERSING: {
        offset: 0x26,
        size: 1
    },
    USE_HALL_SENSORS: {
        offset: 0x27,
        size: 1
    },
    SINE_MODE_RANGE: {
        offset: 0x28,
        size: 1,
        sanitize: (value: number) => (value < 5 || value > 25 ? 5 : value)
    },
    BRAKE_STRENGTH: {
        offset: 0x29,
        size: 1,
        sanitize: (value: number) => (value === 0 || value > 10 ? 10 : value)
    },
    RUNNING_BRAKE_LEVEL: {
        offset: 0x2A,
        size: 1,
        sanitize: (value: number) => (value === 0 || value > 9 ? 10 : value)
    },
    TEMPERATURE_LIMIT: {
        offset: 0x2B,
        size: 1,
        sanitize: (value: number) => (value < 70 || value > 140 ? 255 : value)
    },
    CURRENT_LIMIT: {
        offset: 0x2C,
        size: 1
    },
    SINE_MODE_POWER: {
        offset: 0x2D,
        size: 1,
        sanitize: (value: number) => (value === 0 || value > 10 ? 5 : value)
    },
    ESC_PROTOCOL: {
        offset: 0x2E,
        size: 1
    },
    AUTO_ADVANCE: {
        offset: 0x2F,
        size: 1
    },
    STARTUP_MELODY: {
        offset: 0x30,
        size: 128
    },
    // can_node, esc_index, require_arming, telem_rate, require_zero_throttle,
    // filter_hz, debug_rate, term_enable, 8 reserved - passed through untouched
    CAN_SETTINGS: {
        offset: 0xB0,
        size: 16
    }
};

export type EepromLayoutKeys = keyof typeof EepromLayout;
export type EepromLayoutValues = typeof EepromLayout[EepromLayoutKeys];

export type McuSettings = {
    [key in EepromLayoutKeys as string]: number | number[] | Uint8Array | string;
};
