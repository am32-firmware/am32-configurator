import type { WebSerial } from 'webserial-wrapper';
import { SerialTransport, inferPacketProbe, type SerialPacketProbe } from '@am32/serial-msp';

class Serial {
    private log: LogFn = (_s: string) => {};
    private logError: LogFn = (_s: string) => {};
    private logWarning: LogFn = (_s: string) => {};

    private serial: WebSerial | null = null;
    private port: SerialPort | null = null;
    private transport: SerialTransport | null = null;

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
        this.transport = new SerialTransport({
            log,
            logError,
            logWarning,
            serial,
            port,
            getStream: () => useSerialStore().deviceHandles.stream,
            setStream: (stream) => {
                useSerialStore().deviceHandles.stream = stream;
            }
        });
    }

    public deinit () {
        this.transport = null;
    }

    public writeWithResponse (data: ArrayBuffer, timeout = 250, probe?: SerialPacketProbe): Promise<Uint8Array | null> {
        if (!this.transport || !this.serial || !this.port) {
            throw new Error('WebSerial or SerialPort instance missing');
        }

        return this.transport.exchange(data, {
            timeout,
            probe: probe ?? inferPacketProbe(new Uint8Array(data))
        });
    }

    public write (data: ArrayBuffer, ms = 50, probe?: SerialPacketProbe) {
        return this.writeWithResponse(data, ms, probe);
    }

    public canRead (): boolean {
        return this.port !== null;
    }

    public read<T = any> (): Promise<ReadableStreamReadResult<T>> {
        if (this.transport) {
            return this.transport.read<T>();
        }

        this.logError('Serial not initiated!');
        throw new Error('Serial not initiated!');
    }
}

export default new Serial();
