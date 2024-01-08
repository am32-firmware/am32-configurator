import mergeUint8Arrays from "~/utils/mergeUint8Arrays";

class Serial {
    private log: LogFn = (s: string) => {};
    private logError: LogFn  = (s: string) => {};
    private logWarning: LogFn = (s: string) => {};

    private reader: ReadableStreamDefaultReader | null = null;
    private writer: WritableStreamDefaultWriter | null = null;

    public init(
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

    public deinit()
    {
        this.reader = null;
        this.writer = null;
    }

    public async write(data: ArrayBuffer) {
        if (this.writer) {
            if (this.reader) {
                await this.writer.write(data);
                console.log("serial: wait for read response");
                let ret = new Uint8Array();
                let result = await this.readWithTimeout<Uint8Array>().catch(err => {
                    return null
                });
                console.log(result);
                if (result && result.value) {
                    ret = mergeUint8Arrays(ret, result.value);
                }
                console.log(ret);
                while(result && !result.done && result.value.length > 0) {
                    try {
                        result = await this.readWithTimeout<Uint8Array>().catch(err => {
                            return null;
                        });
                        if (result && result.value) {
                            ret = mergeUint8Arrays(ret, result.value);
                        }
                    } catch(e) {
                        console.log(e);
                    }
                }
                console.log(ret);
                return ret;
            }
            return this.writer.write(data);
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }

    public canRead(): boolean
    {
        return this.reader !== null;
    }

    public read<T = any>(): Promise<ReadableStreamReadResult<T>> {
        if (this.reader) {
            return this.reader.read();
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }

    public async readWithTimeout<T = any>(ms = 500): Promise<ReadableStreamReadResult<T> | null> {
        if (this.reader) {
            let timeoutObj: NodeJS.Timeout;
            const timeout = new Promise((_, reject) => {
                timeoutObj = setTimeout(() => {
                    reject(new Error('serial read timeout reached'));
                }, ms);
            });

            const res = new Promise<ReadableStreamReadResult<T>>(async (resolve) => {
                const result = await this.read<T>();
                resolve(result);
            });
            const ret = await Promise.race([timeout, res])
                .finally(() => {
                    clearTimeout(timeoutObj);
                }) as ReadableStreamReadResult<T> | null;
            return ret;
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }
}

export default new Serial();