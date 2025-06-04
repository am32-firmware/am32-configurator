export class BLE implements IConnectionInterface {
    private readBufferTimeout: NodeJS.Timeout | null = null;

    private log: LogFn = (_s: string) => { };
    private logError: LogFn = (_s: string) => { };
    private logWarning: LogFn = (_s: string) => { };

    private readCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
    private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

    private isMSP: boolean = false;

    public init (
        log: LogFn,
        logError: LogFn,
        logWarning: LogFn,
        read: BluetoothRemoteGATTCharacteristic,
        write: BluetoothRemoteGATTCharacteristic
    ) {
        this.log = log;
        this.logError = logError;
        this.logWarning = logWarning;

        this.readCharacteristic = read;
        this.writeCharacteristic = write;
        this.isMSP = false;
    }

    public writeWithResponse (data: ArrayBuffer, timeout = 250): Promise<Uint8Array | null> {
        console.log('writeWithResponse:  to= ' + timeout);
        console.log(data);

        this.readCharacteristic?.stopNotifications();

        if (!this.readCharacteristic || !this.writeCharacteristic) {
            throw new Error('read or write characteristic instance missing');
        }

        if (this.readBufferTimeout) {
            clearTimeout(this.readBufferTimeout);
        }

        return new Promise((resolve, reject) => {
            if (this.readCharacteristic && this.writeCharacteristic) {
                let ret: Uint8Array | null = null;
                let t: NodeJS.Timeout | null = null;

                const endStream = () => {
                    this.readCharacteristic?.removeEventListener('characteristicvaluechanged', onData);
                    this.readCharacteristic?.stopNotifications();
                    resolve(ret);
                };

                const onData = async (event: Event) => {
                    if (t) {
                        clearTimeout(t);
                    }
                    console.log('characteristicvaluechanged', event);
                    const data = (event.target as BluetoothRemoteGATTCharacteristic).value;
                    if (data) {
                        console.log('Received chunk');
                        console.log(data);
                        if (data.buffer.byteLength === 1) {
                            endStream();
                            return;
                        }

                        ret = mergeUint8Arrays(ret ?? new Uint8Array(), new Uint8Array(data.buffer));
                        // check packet is completely received
                        if (this.isMSP) {
                            console.log('Parsing MSP response of size ' + ret.length);
                            if (ret.length < 4) {
                                console.log('Too short');
                                this.readCharacteristic?.readValue();
                                t = setTimeout(endStream, timeout); // to short to be reply
                            } else if ((ret.length === (ret[3] + 6)) && (ret[0] === 36) && (ret[1] === 77) && (ret[2] === 62)) {
                                console.log('Ending stream! All good.');
                                endStream();
                            } else {
                                console.log('Not yet complete');
                                this.readCharacteristic?.readValue();
                                t = setTimeout(endStream, timeout); // to short to be reply
                            }
                        } else {
                            console.log('Parsing 4way response of size ' + ret.length);
                            if (ret.length < 7) {
                                console.log('Not enough data');
                                this.readCharacteristic?.readValue();
                                t = setTimeout(endStream, timeout); // to short to be reply
                            } else {
                                let tmpLen = ret[4];
                                if (tmpLen === 0) { tmpLen = 256; }
                                if ((ret[0] === 46) && (ret.length === (tmpLen + 8))) {
                                    console.log('Ending stream, all All good!');
                                    endStream();
                                } else {
                                    t = setTimeout(endStream, timeout); // to short to be reply
                                    this.readCharacteristic?.readValue();
                                }
                            }
                        }
                    }
                };

                this.readCharacteristic.addEventListener('characteristicvaluechanged', onData);
                this.readCharacteristic.startNotifications();

                const packet = new Uint8Array(data);
                this.isMSP = (packet[0] === 36 && packet[1] === 77 && packet[2] === 60);
                console.log('Processing MSP: ' + this.isMSP);
                this.writeCharacteristic.writeValue(packet).then(() => {
                    this.readCharacteristic?.readValue();
                }).catch((err) => {
                    console.error(err);
                    reject(err);
                });
                t = setTimeout(endStream, 1000);
            } else {
                resolve(null);
            }
        });
    }

    public async write<T = any>(data: ArrayBuffer, _ms = 50): Promise<T | null> {
        return await this.writeWithResponse(data, _ms) as T | null;
    }

    public async read<T = any>(): Promise<ReadableStreamReadResult<T>> {
        const data = await this.readCharacteristic?.readValue() ?? null;
        return { value: new Uint8Array(data?.buffer ?? new ArrayBuffer(0)) as T, done: false };
    }

    public canRead(): boolean {
        return this.readCharacteristic !== null;
    }
}

export default new BLE();
