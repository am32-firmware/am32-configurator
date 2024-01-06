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

    public write(data: ArrayBuffer) {
        if (this.writer) {
            return this.writer.write(data);
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }

    public read<T = any>(): Promise<ReadableStreamReadResult<T>> {
        if (this.reader) {
            return this.reader.read();
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }
}

export default new Serial();