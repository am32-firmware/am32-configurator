import CommandQueue from '~/src/communication/commands.queue'

export enum MSP_COMMANDS {
    MSP_API_VERSION = 1,
    MSP_FC_VARIANT = 2,
    MSP_FC_VERSION = 3,
    MSP_BOARD_INFO = 4,
    MSP_BUILD_INFO = 5,
  
    MSP_FEATURE_CONFIG = 36,
    MSP_MOTOR_3D_CONFIG = 124,
  
    MSP_BATTERY_STATE = 130,
  
    MSP_SET_MOTOR = 214,
    MSP_SET_PASSTHROUGH = 245,
  
    // Multiwii MSP commands
    MSP_IDENT = 100,
    MSP_STATUS = 101,
    MSP_MOTOR = 104,
    MSP_3D = 124,
    MSP_MOTOR_CONFIG = 131,
    MSP_SET_3D = 217,
  
    // Additional baseflight commands that are not compatible with MultiWii
    MSP_UID = 160, // Unique device ID
  
    // Betaflight specific
    MSP2_SEND_DSHOT_COMMAND = 0x3003,
};

export class Msp {
  constructor(
    private reader: ReadableStreamDefaultReader,
    private writer: WritableStreamDefaultWriter,
    private log: (s: string) => void,
    private logError: (s: string) => void,
  ) {

  }

  /**
   * Calculate the DVB-S2 checksum for a chunk of data
   *
   * @param {Uint8Array} data
   * @param {number} start
   * @param {number} end
   * @returns {number}
   */
  crc8DvbS2Data(data: Uint8Array, start: number, end: number) {
    let crc = 0;
    for (let i = start; i < end; i += 1) {
      const ch = data[i];
      crc ^= ch;
      for (let i = 0; i < 8; i += 1) {
        if (crc & 0x80) {
          crc = ((crc << 1) & 0xFF) ^ 0xD5;
        } else {
          crc = (crc << 1) & 0xFF;
        }
      }
    }

    return crc;
  }

  /**
   * Encode a MSP V1 command
   *
   * @param {number} command
   * @param {Uint8Array} data
   * @returns {ArrayBuffer}
   */
  encodeV1(command: MSP_COMMANDS, data: Uint8Array) {
    // Always reserve 6 bytes for protocol overhead !
    const size = 6 + data.length;
    const bufferOut = new ArrayBuffer(size);
    const bufView = new Uint8Array(bufferOut);

    bufView[0] = ascii('$'); // 36; // $
    bufView[1] = ascii('M'); // 77; // M
    bufView[2] = ascii('<'); // 60; // <
    bufView[3] = data.length;
    bufView[4] = command;

    if (data.length > 0) {
      let checksum = bufView[3] ^ bufView[4];

      for (let i = 0; i < data.length; i += 1) {
        bufView[i + 5] = data[i];
        checksum ^= bufView[i + 5];
      }

      bufView[5 + data.length] = checksum;
    } else {
      bufView[5] = bufView[3] ^ bufView[4]; // Checksum
    }

    return bufferOut;
  }

  /**
   * Encode a MSP V2 command
   *
   * @param {number} command
   * @param {Uint8Array} data
   * @returns {ArrayBuffer}
   */
  encodeV2(command: MSP_COMMANDS, data: Uint8Array) {
    // Always reserve 9 bytes for protocol overhead!
    const dataLength = data.length;
    const size = 9 + dataLength;
    const bufferOut = new ArrayBuffer(size);
    const bufView = new Uint8Array(bufferOut);

    bufView[0] = ascii('$');// 36; // $
    bufView[1] = ascii('X'); // 88; // X
    bufView[2] = ascii('<'); //60; // <
    bufView[3] = 0;  // flag
    bufView[4] = command & 0xFF;
    bufView[5] = (command >> 8) & 0xFF;
    bufView[6] = dataLength & 0xFF;
    bufView[7] = (dataLength >> 8) & 0xFF;

    for (let i = 0; i < dataLength; i += 1) {
      bufView[8 + i] = data[i];
    }

    bufView[size - 1] = this.crc8DvbS2Data(bufView, 3, size - 1);

    return bufferOut;
  }

  async send(command: MSP_COMMANDS, data?: Uint8Array) {
    let bufferOut: ArrayBuffer;

    if(command <= 254) {
      bufferOut = this.encodeV1(command, data ?? new Uint8Array());
    } else {
      bufferOut = this.encodeV2(command, data ?? new Uint8Array());
    }

    try {
      const result = await this.writer.write(bufferOut);
      return result;
    } catch(e: any) {
      this.logError(`MSP command failed: ${e.message}`);
      return null;
    }
  }

  private state = 0;
  private messageBuffer: ArrayBuffer = new ArrayBuffer(0);
  private messageChecksum = 0;
  private messageLengthExpected = 0;
  private messageLengthReceived = 0;
  private command: MSP_COMMANDS | null = null;
  private messageBufferUint8View = new Uint8Array();

  async read(): Promise<void> {
    try {
      const readerData: ReadableStreamReadResult<Uint8Array> = await this.reader.read();
      if (readerData.value) {
        for(let char of readerData.value) {
          switch(this.state) {
            case 0:
              if (char === ascii('$')) {
                ++this.state;
              }
              break;
            case 1:
              if (char === ascii('M')) {
                ++this.state;
              } else {
                this.state = 0;
              }
              break;
            case 2:
              if ([ascii('<'), ascii('>')].includes(char)) {
                ++this.state
              } else {
                this.state = 0;
                this.logError(`Unknown msp command direction '${char}'`);
              }
              break;
            case 3:
              this.messageLengthExpected = char;
              this.messageChecksum = char;

              this.messageBuffer = new ArrayBuffer(this.messageLengthExpected);
              this.messageBufferUint8View = new Uint8Array(this.messageBuffer);

              ++this.state;
              break;
            case 4:
              this.command = char;
              this.messageChecksum ^= char;

              // Process payload
              if (this.messageLengthExpected > 0) {
                this.state += 1;
              } else {
                // No payload
                this.state += 2;
              }
              break;
            case 5:
              this.messageBufferUint8View[this.messageLengthReceived] = char;
              this.messageChecksum ^= char;
              this.messageLengthReceived += 1;

              if (this.messageLengthReceived >= this.messageLengthExpected) {
                this.state += 1;
              }
              break;
            case 6:
              console.log(this.command, this.messageBuffer);
              if (this.messageChecksum === char) {
                CommandQueue.addCommand({
                  commandName: this.command!,
                  data: new DataView(
                    this.messageBuffer,
                    0
                  )
                })
              }
              this.state = 0;
              this.messageBuffer = new ArrayBuffer(0);
              this.messageChecksum = 0;
              this.messageLengthExpected = 0;
              this.messageLengthReceived = 0;
              this.command = null;
              this.messageBufferUint8View = new Uint8Array();
              break;
          }
        }
      }
    } catch (err) {
      this.logError(`error reading data: ${err}`);
    }
  }
}