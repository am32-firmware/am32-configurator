import type { WebSerial } from 'webserial-wrapper';
class Serial {
    private readBuffer: Uint8Array | null = null;
    private readBufferTimeout: NodeJS.Timeout | null = null;
    private log: LogFn = (_s: string) => {};
    private logError: LogFn = (_s: string) => {};
    private logWarning: LogFn = (_s: string) => {};

    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;

    private serial: WebSerial | null = null;
    private port: SerialPort | null = null;

    private isMSP: boolean = false;

    public init (
        log: LogFn,
        logError: LogFn,
        logWarning: LogFn,
        serial: WebSerial,
        port: SerialPort
    ) {
        this.log = log;
        this.logError = logError;
        this.logWarning = logWarning;

        this.serial = serial;
        this.port = port;
        this.isMSP = false;
    }

    public deinit () {
        this.reader = null;
        this.writer = null;
    }

    public writeWithResponse (data: ArrayBuffer, timeout = 250): Promise<Uint8Array | null> {
        console.log('writeWithResponse:  to= ' + timeout);
        console.log(data);

        if (!this.serial || !this.port) {
            throw new Error('WebSerial or SerialPort instance missing');
        }

        const serialStore = useSerialStore();

        if (this.readBufferTimeout) {
            clearTimeout(this.readBufferTimeout);
        }

        return new Promise((resolve, reject) => {
            if (this.serial && this.port) {
                let ret: Uint8Array | null = null;
                let t: NodeJS.Timeout;

                const endStream = () => {
                    if (!serialStore.deviceHandles.stream) {
                        return;
                    }
                    if (serialStore.deviceHandles.stream.port.readable && serialStore.deviceHandles.stream.reader) {
                        try {
                            // serialStore.deviceHandles.stream.reader.releaseLock();
                            serialStore.deviceHandles.stream!.ondata = () => {};
                        } catch (a) {
                            console.error(a);
                            reject(a);
                        } finally {
                            resolve(ret);
                        }
                        if (serialStore.deviceHandles.stream.transforms) {
                            serialStore.deviceHandles.stream.reader.cancel().catch(() => {});
                        }
                    } else {
                        reject(new Error('port not read or writeable'));
                    }
                    // stream.port.close().catch(err => console.error(err));
                };

                if (!serialStore.deviceHandles.stream) {
                    serialStore.deviceHandles.stream = this.serial.createStream({
                        port: this.port,
                        frequency: 1,
                        ondata: () => {}
                    });
                }

                serialStore.deviceHandles.stream!.ondata = (data) => {
                    clearTimeout(t);
                    ret = mergeUint8Arrays(ret ?? new Uint8Array(), data);
                    console.log('Received chunk');
                    console.log(data);
                    // check packet is completely received
                    if (this.isMSP) {
                        console.log('Parsing MSP response of size ' + ret.length);
                        if (ret.length < 4) {
                            console.log('Too short');
                            t = setTimeout(endStream, timeout); // to short to be reply
                        } else if ((ret.length === (ret[3] + 6)) && (ret[0] === 36) && (ret[1] === 77) && (ret[2] === 62)) {
                            console.log('Ending stream! All good.');
                            endStream();
                        } else {
                            console.log('Not yet complete');
                            t = setTimeout(endStream, timeout); // to short to be reply
                        }
                    } else {
                        console.log('Parsing 4way response of size ' + ret.length);

                        if (ret.length < 7) {
                            console.log('Not enough data');
                            t = setTimeout(endStream, timeout); // to short to be reply
                        } else {
                            let tmpLen = ret[4];
                            if (tmpLen === 0) { tmpLen = 256; }
                            if ((ret[0] === 46) && (ret.length === (tmpLen + 8))) {
                                console.log('Ending stream, all All good!');
                                endStream();
                            } else {
                                t = setTimeout(endStream, timeout); // to short to be reply
                            }
                        }
                    }
                };

                t = setTimeout(endStream, timeout);

                const packet = new Uint8Array(data);
                this.isMSP = (packet[0] === 36 && packet[1] === 77 && packet[2] === 60);
                console.log('Processing MSP: ' + this.isMSP);
                this.serial.writeStream(serialStore.deviceHandles.stream!, [...packet]).then(() => {
                    try {
                        delay(0).then(() => {
                            this.serial!.readStream(serialStore.deviceHandles.stream!);
                        });
                    } catch (a) {
                        reject(a);
                        console.error(a);
                    }
                }).catch(() => {});
            } else {
                resolve(null);
            }
        });
    }

    public write (data: ArrayBuffer, ms = 50) {
        return this.writeWithResponse(data, ms);
    }

    public canRead (): boolean {
        return this.port !== null;
    }

    public read<T = any> (): Promise<ReadableStreamReadResult<T>> {
        if (this.serial && this.port) {
            return this.serial.readWithTimeout(this.port, 100);
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }
}

export default new Serial();
