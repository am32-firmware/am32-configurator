// A WebSerial SerialPort look-alike over a local tty/pty, so the app's
// real serial stack (webserial-wrapper + @am32/serial-msp + Serial) can
// run under Node against an emulated or real ESC adapter.
import fs from 'node:fs';
import tty from 'node:tty';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';

export function openNodeSerialPort (path) {
    // raw, no echo: the pty carries a binary protocol
    execFileSync('stty', ['-F', path, 'raw', '-echo', '-echoe', '-echok']);
    const rfd = fs.openSync(path, fs.constants.O_RDWR | fs.constants.O_NOCTTY);
    const wfd = fs.openSync(path, fs.constants.O_RDWR | fs.constants.O_NOCTTY);
    // a tty stream polls via the event loop; an fs stream would park a
    // blocking read in the threadpool, which even process.exit() cannot
    // get past
    const rs = new tty.ReadStream(rfd);
    // the wrapper writes DataView chunks, which Node streams reject, so
    // the sink converts; writes go straight to the fd. A fresh stream per
    // access sidesteps writer-lock races between overlapping commands
    // (the fd serialises the actual writes either way).
    const makeWritable = () => new WritableStream({
        write (chunk) {
            const u8 = ArrayBuffer.isView(chunk)
                ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                : new Uint8Array(chunk);
            return new Promise((resolve, reject) => {
                fs.write(wfd, u8, (err) => err ? reject(err) : resolve());
            });
        }
    });
    return {
        readable: Readable.toWeb(rs),
        get writable () { return makeWritable(); },
        getInfo: () => ({ usbVendorId: 0x1A86, usbProductId: 0x0001 }),
        open: async () => {},
        close: async () => {
            try { fs.closeSync(rfd); } catch {}
            try { fs.closeSync(wfd); } catch {}
        }
    };
}
