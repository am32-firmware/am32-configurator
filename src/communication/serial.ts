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
    }

    public deinit () {
        this.reader = null;
        this.writer = null;
    }

    public writeWithResponse (data: ArrayBuffer, timeout = 50): Promise<Uint8Array | null> {
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
                    console.log('endStream', ret);
                    if (serialStore.deviceHandles.stream.port.readable && serialStore.deviceHandles.stream.reader) {
                        try {
                            // serialStore.deviceHandles.stream.reader.releaseLock();
                            serialStore.deviceHandles.stream!.ondata = (data) => {
                                console.log(data);
                            };
                            console.log('resolve', ret);
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
                    console.log('ondata', data);
                    ret = mergeUint8Arrays(ret ?? new Uint8Array(), data);
                    console.log(ret);
                    t = setTimeout(endStream, timeout);
                };

                t = setTimeout(endStream, timeout);

                this.serial.writeStream(serialStore.deviceHandles.stream!, data).then(() => {
                    try {
                        delay(200).then(() => {
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

        /*
        console.log('writeWithResponse', data, timeout);
        return this.serial.writePort(this.port, data).then(async (success) => {
            if (success) {
                let tmp = await this.serial!.readWithTimeout(this.port!, timeout).catch((err) => {
                    console.error(err);
                    return {
                        done: true,
                        value: null
                    };
                });
                let { value } = tmp;
                let i = 0;
                console.log(i, tmp, tmp.done, value);
                while (!tmp.done) {
                    await delay(timeout / 2);
                    tmp = await this.serial!.readWithTimeout(this.port!, timeout).catch((err) => {
                        console.error(err);
                        return {
                            done: true,
                            value: null
                        };
                    });
                    if (tmp.value) {
                        console.log(++i, tmp, tmp.done);
                        value = mergeUint8Arrays(value, tmp.value);
                    }
                }
                console.log(value);
                return value;
            }
            throw new Error('writing to port not successfull');
        }).catch((err) => {
            console.error(err);
            return null;
        });
        */
    }

    public write (data: ArrayBuffer, ms = 100) {
        return this.writeWithResponse(data, ms);
        /* if (this.writer) {
            if (this.reader) {
                await this.writer.write(data);
                console.log(data);
                let ret: Uint8Array | null = null;
                let result: ReadableStreamReadResult<Uint8Array> | null = null;
                if (ms === 0) {
                    await delay(200);
                    result = await this.read<Uint8Array>().catch((err) => {
                        console.log(err);
                        return null;
                    }) as ReadableStreamReadResult<Uint8Array> | null;

                    if (result?.value) {
                        ret = mergeUint8Arrays(ret ?? new Uint8Array(), result.value);
                    }
                } else {
                    result = await this.readWithTimeout<Uint8Array>(ms).catch((err) => {
                        console.log(err);
                        return null;
                    }) as ReadableStreamReadResult<Uint8Array> | null;
                    console.log(result, result?.done);
                    while (result && !result.done) {
                        if (result?.value) {
                            ret = mergeUint8Arrays(ret ?? new Uint8Array(), result.value);
                        }
                        result = await this.readWithTimeout<Uint8Array>(ms).catch((_err) => {
                            return null;
                        }) as ReadableStreamReadResult<Uint8Array> | null;
                        console.log(result, result?.done);
                    }
                    console.log(ret);
                }
                return ret;
            }
            return this.writer.write(data);
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!'); */
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

    /*
    public async readWithTimeout<T = any> (ms = 100): Promise<ReadableStreamReadResult<T> | Error | null | undefined> {
        if (this.reader) {
            const timeout = setTimeout(() => {
                console.log('serial timeout hit', ms);
                this.reader?.releaseLock();
                const serialStore = useSerialStore();
                this.reader = serialStore.refreshReader();
            }, ms);
            const result = await this.read<T>();
            clearTimeout(timeout);
            console.log(result);
            return result;
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    } */
}

export default new Serial();
