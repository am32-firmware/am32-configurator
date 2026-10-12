# src/ — Core Domain Logic

## OVERVIEW

Hardware abstraction layer: MCU definitions, EEPROM layout, hex parsing, and serial communication protocols for AM32 ESCs.

## STRUCTURE

```
src/
├── mcu.ts               # MCU variant registry + flash geometry
├── eeprom.ts            # EEPROM byte-level layout (offsets, sizes, version gates)
├── flash.ts             # Intel HEX file parser
├── db.ts                # Dexie (IndexedDB) wrapper for cached hex files
├── fetch-and-upload-releases.ts  # Release upload script (deploy tooling)
└── communication/
    ├── serial.ts         # WebSerial wrapper — packet-framed read/write
    ├── msp.ts            # MSP V1/V2 protocol (flight controller comms)
    ├── four_way.ts       # FourWay interface (ESC passthrough flashing)
    ├── direct.ts         # Direct USB connection protocol
    └── commands.queue.ts # Command queue — serializes concurrent requests
```

## COMMUNICATION ARCHITECTURE

Protocol stack (layered):

```
SerialDevice.vue (UI)
    ↓
MSP (negotiate passthrough)
    ↓
FourWay / Direct (ESC access)
    ↓
Serial (WebSerial I/O + packet framing)
    ↓
CommandQueue (serialization)
```

- **MSP**: Entry protocol. Talks to flight controller, initiates FourWay passthrough.
  - V1: 6 bytes overhead. V2: 9 bytes overhead. ALWAYS reserve these.
  - Request header: `$M<` (bytes `36, 77, 60`)
  - Response header: `$M>` (bytes `36, 77, 62`) + length check at byte[3]
- **FourWay**: ESC flashing protocol over MSP passthrough.
  - Header byte `0x2E`, length at byte[4] (0 = 256), packet total = len + 8
  - Commands: connect, read, write, erase, reset per ESC
- **Direct**: USB direct connection (no flight controller needed).
  - Separate command/response enums
- **Serial**: Singleton. Wraps `webserial-wrapper`. Detects MSP vs FourWay by first packet bytes.
- **CommandQueue**: Prevents concurrent serial access. Promise-based.

## WHERE TO LOOK

| Task | File | Key Details |
|------|------|-------------|
| Add MCU variant | `mcu.ts` | Add to `Mcu.variants` — signature, page_size, flash_size, offsets |
| Add EEPROM field | `eeprom.ts` | Add to `EepromLayout` — offset, size, optional `minEepromVersion` |
| Modify protocol | `communication/*.ts` | Singleton class with `init(log, logWarning, logError)` |
| Change serial framing | `communication/serial.ts` | `writeWithResponse()` — packet completion logic |
| Fix hex parsing | `flash.ts` | Record types 0x02, 0x03 throw NOT IMPLEMENTED |
| Cached firmware | `db.ts` | Dexie table for IndexedDB hex file storage |

## CONVENTIONS

- All protocol classes are singletons: `export default new ClassName()`
- `init(log, logWarning, logError)` for dependency injection of logging
- Byte values use hex literals (`0x08000000`, `0x7c00`)
- EEPROM fields version-gated via `minEepromVersion` / `maxEepromVersion`
- MCU signatures are uppercase hex string keys (`'1F06'`, `'3506'`)

## ANTI-PATTERNS

- Do NOT use extended segment address (0x02) or start segment address (0x03) hex records — will throw
- MSP overhead bytes MUST be reserved: 6 for V1, 9 for V2 — underallocation corrupts packets
