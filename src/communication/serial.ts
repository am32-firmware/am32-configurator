class Serial {
    private log: LogFn = (_s: string) => {};
    private logError: LogFn = (_s: string) => {};
    private logWarning: LogFn = (_s: string) => {};

    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;

    public init (
        log: LogFn,
        logError: LogFn,
        logWarning: LogFn,

        reader: ReadableStreamDefaultReader,
        writer: WritableStreamDefaultWriter
    ) {
        this.log = log;
        this.logError = logError;
        this.logWarning = logWarning;

        this.reader = reader;
        this.writer = writer;
    }

    public deinit () {
        this.reader = null;
        this.writer = null;
    }

    public async write (data: ArrayBuffer, ms = 100) {
        if (this.writer) {
            if (this.reader) {
                await this.writer.write(data);
                let ret: Uint8Array | null = null;
                let result: ReadableStreamReadResult<Uint8Array> | null = await this.readWithTimeout<Uint8Array>(ms).catch((err) => {
                    console.log(err);
                    return null;
                }) as ReadableStreamReadResult<Uint8Array> | null;
                while (result && !result.done) {
                    if (result && result.value) {
                        ret = mergeUint8Arrays(ret ?? new Uint8Array(), result.value);
                    }
                    result = await this.readWithTimeout<Uint8Array>(ms).catch((_err) => {
                        return null;
                    }) as ReadableStreamReadResult<Uint8Array> | null;
                }
                return ret;
            }
            return this.writer.write(data);
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }

    public canRead (): boolean {
        return this.reader !== null;
    }

    public read<T = any> (): Promise<ReadableStreamReadResult<T>> {
        if (this.reader) {
            return this.reader.read();
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }

    public readWithTimeout<T = any> (ms = 100): Promise<ReadableStreamReadResult<T> | Error | null> {
        if (this.reader) {
            // eslint-disable-next-line no-async-promise-executor
            return new Promise<ReadableStreamReadResult<T>>(async (resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('serial timeout hit', ms);
                    this.reader!.releaseLock();
                    const serialStore = useSerialStore();
                    this.reader = serialStore.refreshReader();
                }, ms);
                try {
                    const result = await this.read<T>();
                    clearTimeout(timeout);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }
}

export default new Serial();
