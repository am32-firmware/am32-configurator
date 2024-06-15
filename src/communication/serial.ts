import type { StreamInfo, WebSerial } from 'webserial-wrapper';

class Serial {
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

    public async writeWithResponse (data: ArrayBuffer, timeout = 100) {
        if (!this.serial || !this.port) {
            throw new Error('WebSerial or SerialPort instance missing');
        }
        /* let ret = new Uint8Array();
        let t: NodeJS.Timeout;
        let stream: StreamInfo | null = null;
        const endStream = () => {
            if (!stream) {
                return;
            }
            stream.running = false;
            if (stream.port.readable && stream.reader) {
                try {
                    stream.reader.releaseLock();
                } catch (a) {
                    // console.error(a);
                }
                if (stream.transforms) {
                    stream.reader.cancel().catch(() => {});
                }
            }
            // stream.port.close().catch(err => console.error(err));
        };
        stream = this.serial.createStream({
            port: this.port,
            frequency: 1,
            ondata: (data) => {
                ret = mergeUint8Arrays(ret, data);
                clearTimeout(t);
                t = setTimeout(endStream, 10);
            }
        });
        t = setTimeout(endStream, 10);

        await this.serial.writeStream(stream!, data).catch(() => {});
        try {
            this.serial.readStream(stream!);
        } catch {}
        while (stream!.running) {
            await delay(5);
        }
        return ret; */
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
                return value;
            }
            throw new Error('writing to port not successfull');
        }).catch((err) => {
            console.error(err);
            return null;
        });
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
            return this.serial.readWithTimeout(this.port, 10);
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
