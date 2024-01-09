import type { McuInfo } from "./mcu";

class Flash {
    static getInfo(flash: FourWayResponse) {
        const info: McuInfo = {
            meta: {
                signature: (flash.params[1] << 8) | flash.params[0],
                input: flash.params[2],
                interfaceMode: flash.params[3],
                available: true,
                am32: {
                        fileName: null,
                        mcuType: null,
                },
            },
            displayName: 'UNKNOWN',
            firmwareName: 'UNKNOWN',
            supported: true,
            bootloader: {
                input: 0,
                valid: false,
                pin: '',
                version: 0
            },
            layoutSize: 0,
            settingsDirty: false,
            settings: {}
        };
    
        return info;
    }
}

export default Flash;
