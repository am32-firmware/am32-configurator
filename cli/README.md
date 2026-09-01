# am32cli - the configurator's protocol stack on the command line

A Node harness that runs the web app's own protocol implementation
(`four_way.ts`, `direct.ts`, `serial.ts`, `mcu.ts`, `flash.ts`,
`eeprom.ts`, plus the real `webserial-wrapper` / `@am32/serial-msp`
transport) against a serial device, so the protocol can be validated
against emulated or real ESCs without driving a browser.

It is not a reimplementation: the app modules are loaded unmodified via
jiti, with stand-ins only for what the browser/Nuxt runtime provides -
the auto-imported utils and pinia stores, and a `SerialPort` look-alike
over a local tty (`node-serial-port.mjs`). The suite flows mirror
`SerialDevice.vue`'s connect / save-settings / flash handlers, so a pass
here is representative of the deployed app for everything except
WebSerial's own browser-side timing and the UI wiring.

    # direct single-wire adapter (or emulated equivalent)
    node cli/am32cli.mjs direct-suite  /dev/ttyUSB0 firmware.hex

    # 4-way passthrough via a flight controller (or MSP stub)
    node cli/am32cli.mjs fourway-suite /dev/ttyACM0 firmware.hex

Each suite connects, reads and rewrites the settings with a readback
check, flashes the given firmware hex the way the app does, and
reconnects afterwards. Exit code 0 on success.

Notes:
- the post-flash direct reconnect relies on the freshly booted firmware
  quiet-timing-out back into the bootloader; the retry loop leaves real
  gaps because probes themselves count as signal to the firmware.
- against the AM32 renode lab, use launch.py's "Serial port (pty)"
  configurator option and point the suite at the pty it prints.
