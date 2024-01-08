import CommandQueue from '~/src/communication/commands.queue';
import Serial from '~/src/communication/serial';
import Flash from '../flash';
import { MagicString } from 'vue/compiler-sfc';
import Mcu from '../mcu';

export enum FOUR_WAY_COMMANDS {
    cmd_InterfaceTestAlive = 0x30,
    cmd_ProtocolGetVersion = 0x31,
    cmd_InterfaceGetName = 0x32,
    cmd_InterfaceGetVersion = 0x33,
    cmd_InterfaceExit = 0x34,
    cmd_DeviceReset = 0x35,
    cmd_DeviceInitFlash = 0x37,
    cmd_DeviceEraseAll = 0x38,
    cmd_DevicePageErase = 0x39,
    cmd_DeviceRead = 0x3a,
    cmd_DeviceWrite = 0x3b,
    cmd_DeviceC2CK_LOW = 0x3c,
    cmd_DeviceReadEEprom = 0x3d,
    cmd_DeviceWriteEEprom = 0x3e,
    cmd_InterfaceSetMode = 0x3f,
  };
  
  export enum FOUR_WAY_ACK {
    ACK_OK = 0x00,
    ACK_I_UNKNOWN_ERROR = 0x01,
    ACK_I_INVALID_CMD = 0x02,
    ACK_I_INVALID_CRC = 0x03,
    ACK_I_VERIFY_ERROR = 0x04,
    ACK_D_INVALID_COMMAND = 0x05,
    ACK_D_COMMAND_FAILED = 0x06,
    ACK_D_UNKNOWN_ERROR = 0x07,
    ACK_I_INVALID_CHANNEL = 0x08,
    ACK_I_INVALID_PARAM = 0x09,
    ACK_D_GENERAL_ERROR = 0x0f,
  };

export class FourWay {

    static instance: FourWay;

    static init(
      log: (s: string) => void,
      logWarning: (s: string) => void,
      logError: (s: string) => void
    ) {
        FourWay.instance = new FourWay(log, logWarning, logError);
    }
  
    static getInstance() {
      if (!FourWay.instance) {
        useLogStore().logError('FourWay instance missing!');
        throw new Error('FourWay instance missing!');
      }
      return FourWay.instance;
    }

    public commandCount = 0;

    constructor(
      private log: ((s: string) => void),
      private logError: ((s: string) => void),
      private logWarning: ((s: string) => void),
    ) {
    }

    makePackage(cmd: FOUR_WAY_COMMANDS, params: number[], address: number) {    
        if (params.length === 0) {
            params.push(0);
        } else if (params.length > 256) {
            this.logError('Too many parameters ' + params.length);
            return;
        }
    
        const bufferOut = new ArrayBuffer(7 + params.length);
        const bufferView = new Uint8Array(bufferOut);
    
        bufferView[0] = 0x2f;
        bufferView[1] = cmd;
        bufferView[2] = (address >> 8) & 0xff;
        bufferView[3] = address & 0xff;
        bufferView[4] = params.length === 256 ? 0 : params.length;
    
        // Copy params
        const outParams = bufferView.subarray(5);
        for (let i = 0; i < params.length; i += 1) {
          outParams[i] = params[i];
        }
    
        // Calculate checksum
        const msgWithoutChecksum = bufferView.subarray(0, -2);
        const checksum = msgWithoutChecksum.reduce(this.crc16XmodemUpdate, 0);
    
        bufferView[5 + params.length] = (checksum >> 8) & 0xff;
        bufferView[6 + params.length] = checksum & 0xff;
    
        return bufferOut;
    }

    crc16XmodemUpdate(crc: number, byte: number) {
        const poly = 0x1021;
        crc ^= byte << 8;
        for (let i = 0; i < 8; i += 1) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ poly;
            } else {
                crc <<= 1;
            }
        }
    
        return crc & 0xffff;
    }

    initFlash(target: number, retries = 10) {
        return this.sendWithPromise(FOUR_WAY_COMMANDS.cmd_DeviceInitFlash, [target], 0, retries);
    }

    /*buildDisplayName(flash: McuInfo, make: string) {
        const settings = flash.settings;
        let revision = 'Unsupported/Unrecognized';
        if(settings.MAIN_REVISION !== undefined && settings.SUB_REVISION !== undefined) {
          revision = `${settings.MAIN_REVISION}.${settings.SUB_REVISION}`;
        }
    
        if(make === 'NOT READY') {
          revision = 'FLASH FIRMWARE';
        }
    
        //if we can extract the AM32 mcutype, display it here
        const mcuType = flash.meta?.am32?.mcuType ? `, MCU: ${flash.meta.am32.mcuType}` : '';
    
        const bootloader = flash.bootloader.valid ? `, Bootloader v${flash.bootloader.version} (${flash.bootloader.pin})${mcuType}` : ', Bootloader unknown';
    
        return `${make} - ${this.name}, ${revision}${bootloader}`;
    }*/

    async getInfo(target: number) {
        const flash = await this.initFlash(target, 5);
        const info = Flash.getInfo(flash!);
        console.log(info);
        const mcu = new Mcu(info.meta.signature);
        
        const eepromOffset = mcu.getEepromOffset();
    
            //Attempt reading filename
        try {
            const fileNameRead = await this.readAddress(eepromOffset - 32, 16);
            console.log(fileNameRead);
            const fileName = new TextDecoder().decode(fileNameRead!.params.slice(0, fileNameRead?.params.length));

            console.log(fileName);

            if (/[A-Z0-9_]+/.test(fileName)) {
                info.meta.am32.fileName = fileName;
                info.meta.am32.mcuType = fileName.slice(fileName.lastIndexOf('_') + 1);
            }

            if(info.meta.input) {
                info.bootloader.input = info.meta.input;
                info.bootloader.valid = false;
            }

            for(let [key, value] of Object.entries(Mcu.BOOT_LOADER_PINS)) {
                if(value === info.bootloader.input) {
                  info.bootloader.valid = true;
                  info.bootloader.pin = key;
                  info.bootloader.version = '';//info.settings.BOOT_LOADER_REVISION;
                }
            }

            info.layoutSize = Mcu!.LAYOUT_SIZE;

            const settingsArray = (await this.readAddress(eepromOffset, info.layoutSize))!.params;
            console.log(Array.from(settingsArray));
            //info.settings = Convert.arrayToSettingsObject(Array.from(settingsArray), info.layout);
        } catch(e) {
            // Failed reading filename - could be old version of AM32
        }

        //info.displayName = am32Source.buildDisplayName(info, info.meta.am32.fileName ? info.meta.am32.fileName.slice(0, info.meta.am32.fileName.lastIndexOf('_')) : 'UNKNOWN');
        //info.firmwareName = am32Source.getName();

        console.log(mcu);
    
        /*try {
          let mcu = null;
          try {
            mcu = new MCU(info.meta.interfaceMode, info.meta.signature);
            if (!mcu.class) {
              console.debug('Unknown MCU class.');
              throw new UnknownPlatformError('Neither SiLabs nor Arm');
            }
          } catch(e) {
            console.log('Unknown interface', e);
            throw new UnknownPlatformError('Neither SiLabs nor Arm');
          }
    
          let source = null;
    
          if (mcu.class === Arm) {
            // Assume AM32 to be the default
            source = am32Source;
    
            const eepromOffset = mcu.getEepromOffset();
    
            //Attempt reading filename
            try {
              const fileNameRead = await this.read(eepromOffset - 32, 16);
              const fileName = new TextDecoder().decode(fileNameRead.params.slice(0, fileNameRead.params.indexOf(0x00)));
    
              if (/[A-Z0-9_]+/.test(fileName)) {
                info.meta.am32.fileName = fileName;
                info.meta.am32.mcuType = fileName.slice(fileName.lastIndexOf('_') + 1);
              }
            } catch(e) {
              // Failed reading filename - could be old version of AM32
            }
    
            info.layout = source.getLayout();
            info.layoutSize = source.getLayoutSize();
    
            const  settingsArray = (await this.read(eepromOffset, info.layoutSize)).params;
            info.settingsArray = Array.from(settingsArray);
            info.settings = Convert.arrayToSettingsObject(settingsArray, info.layout);

            if(!Object.values(am32Eeprom.BOOT_LOADER_PINS).includes(info.meta.input)) {
              source = null;
    
              info.settings.NAME = 'Unknown';
    
              // TODO: Find out if there is a way to reliably identify BLHeli_32
              // info.settings.NAME = 'BLHeli_32';
            }
          }
    
          const layoutRevision = info.settings.LAYOUT_REVISION.toString();
          info.layoutRevision = layoutRevision;
          if(source) {
            info.defaultSettings = source.getDefaultSettings(layoutRevision);
          }
    
          if(!info.defaultSettings) {
            this.addLogMessage('layoutNotSupported', { revision: layoutRevision });
          }
    
          const layoutName = (info.settings.LAYOUT || '').trim();
          let make = null;
    
          // Arm
          if (info.isArm) {
            if (
              info.settings.NAME === 'BLHeli_32'
            ) {
              let revision = 'Unsupported/Unrecognized';
              make = 'Unknown';
    
              info.displayName = `${make} - ${info.settings.NAME}, ${revision}`;
              info.firmwareName = info.settings.NAME;
    
              info.supported = false;
            } else if (source instanceof sources.AM32Source) {
              info.bootloader = {};
              if(info.meta.input) {
                info.bootloader.input = info.meta.input;
                info.bootloader.valid = false;
              }

              for(let [key, value] of Object.entries(am32Eeprom.BOOT_LOADER_PINS)) {
                if(value === info.bootloader.input) {
                  info.bootloader.valid = true;
                  info.bootloader.pin = key;
                  info.bootloader.version = info.settings.BOOT_LOADER_REVISION;
                }
              }
    
              info.settings.LAYOUT = info.settings.NAME;
    
              info.displayName = am32Source.buildDisplayName(info, info.meta.am32.fileName ? info.meta.am32.fileName.slice(0, info.meta.am32.fileName.lastIndexOf('_')) : info.settings.NAME);
              info.firmwareName = am32Source.getName();
            }
          }
    
          info.make = make;
        } catch (e: any) {
          console.debug(`ESC ${target + 1} read settings failed ${e.message}`, e);
          throw new Error(e);
        }
    
        try {
          //info.individualSettings = getIndividualSettings(info);
        } catch(e: any) {
          console.debug('Could not get individual settings');
          throw new Error(e);
        }*/
    
        return info;
    }

    readAddress(address: number, bytes: number, retries = 10) {
        return this.sendWithPromise(
            FOUR_WAY_COMMANDS.cmd_DeviceRead,
            [bytes === 256 ? 0 : bytes],
            address,
            retries
        );
    }

    async read(): Promise<void> {
        try {
            const readerData: ReadableStreamReadResult<Uint8Array> = await Serial.read<Uint8Array>();
            if (readerData.value) {
                this.parseMessage(readerData.value);
            }
        } catch (err) {
            console.error(`error reading data: ${err}`);
        }
    }

    async send(command: FOUR_WAY_COMMANDS, params: number[] = [0], address: number = 0) {
        this.log(`Sending ${enumToString(command, FOUR_WAY_COMMANDS)}...`);

        const message = this.makePackage(command, params, address);

        if (!message) {
            this.logError('message empty');
            throw new Error('message empty!');
        }

        try {
            this.commandCount++;
            const result = await Serial.write(message);
            return result;
        } catch(e: any) {
            this.logError(`MSP command failed: ${e.message}`);
            return null;
        }
    }

    sendWithCallback(command: FOUR_WAY_COMMANDS, callback: PromiseFn, params: number[] = [0], address: number = 0, retries = 0)
    {
        CommandQueue.addCallback(command, callback, retries);
        return this.send(command, params, address);
    }

    sendWithPromise(command: FOUR_WAY_COMMANDS, params: number[] = [0], address: number = 0, retries: number = 10): Promise<FourWayResponse | null> {
      let currentTry = 0;
      /*const { ready, start, stop } = useTimeout(1000, {
        controls: true,
        callback: () => {
          if (currentTry >= retries) {
            throw new Error('four way timeout');
          }
        }
      });*/

      const callback: (resolve: PromiseFn, reject: PromiseFn) => void = async (resolve, reject) => {
        while(currentTry++ < retries) {
          console.log(currentTry);
          const result = await this.send(command, params, address).catch(err => {
            console.log(err);
            return null;
          });
          if (command === FOUR_WAY_COMMANDS.cmd_InterfaceExit) {
            resolve(null);
            break;
          }

          if (result) {
            try {
              const response = this.parseMessage(result.buffer);
              resolve(response.data);
              break;
            } catch(e) {
              console.error(e);
            }
          }
          await delay(250);
        }

        if (currentTry < retries) {
          reject(new Error('max retries, please check connection'));
        }
      }
      return new Promise(callback);
  }

    /**
   * Parse a message and invoke either resolve or reject callback
   *
   * @param {ArrayBuffer} buffer
   * @param {function} resolve
   * @param {function} reject
   * @returns {Promise}
   */
  parseMessage(buffer: ArrayBuffer) {
    const fourWayIf = 0x2e;

    let view = new Uint8Array(buffer);
    console.log(view);
    if (view[0] !== fourWayIf) {
      const error = `invalid message start: ${view[0]}`;
      throw new Error(error);
    }

    if (view.length < 9) {
      throw new Error('NotEnoughDataError');
    }

    let paramCount = view[4];
    if (paramCount === 0) {
      paramCount = 256;
    }

    if (view.length < 8 + paramCount) {
      throw new Error('NotEnoughDataError');
    }

    const message: FourWayResponse = {
      command: view[1],
      address: (view[2] << 8) | view[3],
      ack: view[5 + paramCount],
      checksum: (view[6 + paramCount] << 8) | view[7 + paramCount],
      params: view.slice(5, 5 + paramCount),
    };

    const msgWithoutChecksum = view.subarray(0, 6 + paramCount);
    const checksum = msgWithoutChecksum.reduce(this.crc16XmodemUpdate, 0);

    if (checksum !== message.checksum) {
      //this.increasePacketErrors(1);

      const error = `checksum mismatch, received: ${message.checksum}, calculated: ${checksum}`;
      this.logError(error);
      throw new Error(error);
    }

    this.commandCount--;
    return {
        commandName: message.command,
        data: message
    }
  }
}
