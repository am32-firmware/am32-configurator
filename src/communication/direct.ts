import serial from "./serial";

export enum DIRECT_COMMANDS {
    cmd_SetAddress = 0xff,
    cmd_SetBufferSize = 0xfe,
    cmd_WriteFlash = 0x01,
    cmd_ReadFlash = 0x03
}

export class Direct {
    static instance: Direct;

    static init (
        log: (s: string) => void,
        logWarning: (s: string) => void,
        logError: (s: string) => void
    ) {
        Direct.instance = new Direct(log, logWarning, logError);
    }

    static getInstance () {
        if (!Direct.instance) {
            useLogStore().logError('Direct instance missing!');
            throw new Error('Direct instance missing!');
        }
        return Direct.instance;
    }

    constructor (
        private readonly log: ((s: string) => void),
        private readonly logError: ((s: string) => void),
        private readonly logWarning: ((s: string) => void)
    ) {
    }

    /*makeCRC(pBuff: Uint8Array){
        let CRC_16 = 0;
  
        for(let i = 0; i < pBuff.length; i++) {
            let xb = pBuff[i];
            for (let j = 0; j < 8; j++)
            {
                if (((xb & 0x01) ^ (CRC_16 & 0x0001)) !=0 ) {
                    CRC_16 = CRC_16 >> 1;
                    CRC_16 = CRC_16 ^ 0xA001;
                } else {
                    CRC_16 = CRC_16 >> 1;
                }
                xb = xb >> 1;
            }
        }
        calculated_crc_low_byte = CRC_16.bytes[0];
        calculated_crc_high_byte = CRC_16.bytes[1];
        return [CRC_16]
      }*/
    crc16(buffer: number[]) {
        let crc = 0xFFFF;
        let odd;

        for (let i = 0; i < buffer.length; i++) {
            crc = crc ^ buffer[i];

            for (let j = 0; j < 8; j++) {
                odd = crc & 0x0001;
                crc = crc >> 1;
                if (odd) {
                    crc = crc ^ 0xA001;
                }
            }
        }

        return crc;
    };

    checkCRC(pBuff: number[]) {
        const low_byte = pBuff[pBuff.length - 2];          // one higher than len in buffer
        const high_byte = pBuff[pBuff.length - 1];
        const crc_byte = low_byte.toString(16) + high_byte.toString(16);

        const crc = this.crc16(pBuff);

        console.log(crc.toString(16), crc_byte);

        return crc.toString(16) === crc_byte;
    }

    async init() {
        const init = new Uint8Array([0, 0,    0,   0,   0,   0,   0,   0,   0,    0,   0,
            0, 0x0D, 'B'.charCodeAt(0), 'L'.charCodeAt(0), 'H'.charCodeAt(0), 'e'.charCodeAt(0), 'l'.charCodeAt(0), 'i'.charCodeAt(0), 0xF4, 0x7D
        ]);
        const result = await serial.write(init);
        if (result) {
            console.log(result.byteLength, result.subarray(init.length), [0x34,0x37,0x31,0x00,0x1f,0x06,0x06,0x01,0x30]);
        }
        const eeprom = await this.writeCommand(DIRECT_COMMANDS.cmd_SetAddress, 0x7c00);
        console.log(eeprom);
    }

    writeCommand(command: DIRECT_COMMANDS, address: number, payload?: Uint8Array) {
        const buffer: number[] = [];
        switch(command) {
            case DIRECT_COMMANDS.cmd_SetAddress:
                buffer.push(DIRECT_COMMANDS.cmd_SetAddress);
                buffer.push(0x00);
                buffer.push((address >> 8) & 0xFF);
                buffer.push(address & 0xFF);
                const crc = this.crc16(buffer);
                console.log(crc.toString(16), crc >> 2);
                buffer.push(crc & 0xFF);
                buffer.push(crc >> 8 & 0xFF);
                break;
            default:
                break;
        }
        console.log(address, address >> 8, buffer);
        return serial.write(new Uint8Array(buffer));
    }
}