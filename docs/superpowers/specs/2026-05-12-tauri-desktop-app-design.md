# Tauri Desktop App for AM32 Configurator

**Date:** 2026-05-12
**Status:** Approved (brainstorming)
**Author:** Eike Ahmels (with Claude)

## Motivation

WebSerial exposes only `usbVendorId` and `usbProductId` and provides a permission-walled,
limited subset of port control. A native desktop wrapper allows direct access to USB device
descriptors (manufacturer string, product string, serial number, firmware revision via
`bcdDevice`), reliable hot-plug events, and full serial line-control (DTR/RTS/flow control).
This unblocks better device identification in the UI and replaces 500 ms polling with a
true event-driven device list.

## Goals

- Ship a Tauri 2 desktop application for Windows and Linux that wraps the existing
  AM32 configurator and gains richer USB/serial access.
- Re-use the entire existing Nuxt frontend without forks; the desktop app loads
  `https://am32.ca` (with bundled offline fallback).
- Keep the web build at am32.ca working unchanged; transport selection happens at runtime.
- Provide a clean, drop-in serial transport interface so higher layers (MSP, 4way, Direct)
  remain untouched.
- Auto-update via Tauri's built-in updater fed by GitHub releases.

## Non-goals (v1)

- macOS support.
- Windows code signing (SmartScreen warning is acceptable for initial release).
- Direct libusb control transfers bypassing the kernel serial driver.
- Mobile (Android/iOS via Tauri 2 mobile).

## Architecture overview

Single-repo layout. New artifacts:

```
am32-configurator/
├── packages/
│   └── native-serial/          # new: WebSerial-shaped transport over Tauri IPC
│       ├── src/
│       │   ├── index.ts        # NativeSerialTransport, listDevices, watchDevices
│       │   └── tauri-bridge.ts
│       └── package.json
├── desktop/                    # new: Tauri 2 app
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── serial.rs       # serialport-rs commands
│   │   │   ├── usb.rs          # rusb descriptor reads + hotplug
│   │   │   └── updater.rs
│   │   ├── tauri.conf.json     # remote allowlist + bundled fallback
│   │   └── Cargo.toml
│   └── package.json
└── src/communication/serial.ts # modified: pick transport by window.__TAURI__
```

### Runtime flow

1. Tauri launches and probes `https://am32.ca/api/sponsors` with a 1 s timeout.
2. If reachable, the webview navigates to `https://am32.ca/configurator`. Otherwise it
   loads the bundled `dist/index.html` shipped inside the installer (hybrid loader).
3. Tauri injects `window.__TAURI__` into the webview. The remote origin is allowlisted
   via `dangerousRemoteDomainIpcAccess` and limited to the `serial` and `usb` plugins.
4. The Nuxt frontend boots as on web. `src/communication/serial.ts` detects
   `window.__TAURI__` and swaps `SerialTransport` (from `@am32/serial-msp`) for
   `NativeSerialTransport` (from `@am32/native-serial`).
5. All higher layers (`Msp`, `FourWay`, `Direct`, pinia stores, components) are unchanged.

## Native serial transport contract

`@am32/native-serial` ships an interface drop-in compatible with `SerialTransport`.

```ts
export interface NativeDeviceInfo {
    portPath: string;              // "/dev/ttyUSB0" | "COM7"
    usbVendorId: number;
    usbProductId: number;
    manufacturer: string | null;
    product: string | null;
    serialNumber: string | null;
    bcdDevice: number;             // firmware rev, e.g. 0x0264
    bcdUSB: number;
    interfaceClass: number;
    interfaceSubclass: number;
    maxPacketSize: number;
}

export class NativeSerialTransport {
    constructor(opts: {
        log: (s: string) => void;
        logError: (s: string) => void;
        logWarning: (s: string) => void;
        portPath: string;
        getStream: () => StreamInfo | null;
        setStream: (stream: StreamInfo | null) => void;
    });
    open(options: {
        baudRate: number;
        dataBits?: 7 | 8;
        stopBits?: 1 | 2;
        parity?: 'none' | 'even' | 'odd';
        flowControl?: 'none' | 'hardware';
    }): Promise<void>;
    close(): Promise<void>;
    exchange(data: ArrayBuffer, opts: { timeout: number, probe: SerialPacketProbe }): Promise<Uint8Array | null>;
    read<T>(): Promise<ReadableStreamReadResult<T>>;
    setDTR(level: boolean): Promise<void>;
    setRTS(level: boolean): Promise<void>;
}

export function listDevices(): Promise<NativeDeviceInfo[]>;
export function watchDevices(
    cb: (event: { type: 'attach' | 'detach', device: NativeDeviceInfo }) => void
): () => void;
```

### Rust commands

- `serial_list` → `Vec<NativeDeviceInfo>` (combines `serialport::available_ports()` with
  `rusb` descriptor lookup keyed by VID/PID and bus/address).
- `serial_open(port_path, baud, data_bits, stop_bits, parity, flow_control)` → opaque
  `handle_id: u32`.
- `serial_write(handle_id, bytes: Vec<u8>)` → `Result<(), SerialError>`.
- `serial_read(handle_id, max_bytes, timeout_ms)` → `Result<Vec<u8>, SerialError>`.
- `serial_close(handle_id)` → `Result<(), SerialError>`.
- `serial_set_dtr(handle_id, level: bool)` / `serial_set_rts(handle_id, level: bool)`.
- `usb_watch` → emits Tauri events `usb://attach` and `usb://detach` with
  `NativeDeviceInfo` payloads, sourced from a `rusb::Hotplug` callback thread spawned at
  app launch.

### Error enum

```rust
#[derive(Debug, thiserror::Error, serde::Serialize)]
enum SerialError {
    NotFound,
    InUse,
    PermissionDenied,
    DeviceDisconnected,
    IoError(String),
    Timeout,
}
```

The frontend maps these to existing `logError()` + `toast.add()` flows.

## Frontend integration

### `src/communication/serial.ts`

```ts
import type { WebSerial, StreamInfo } from 'webserial-wrapper';
import { SerialTransport, inferPacketProbe, type SerialPacketProbe } from '@am32/serial-msp';
import { NativeSerialTransport, type NativeDeviceInfo } from '@am32/native-serial';

type Transport = SerialTransport | NativeSerialTransport;

class Serial {
    private transport: Transport | null = null;
    private isNative = false;

    public init(log, logError, logWarning, serial: WebSerial, port: SerialPort | NativeDeviceInfo) {
        this.isNative = typeof window !== 'undefined' && !!(window as any).__TAURI__;

        if (this.isNative) {
            this.transport = new NativeSerialTransport({
                log, logError, logWarning,
                portPath: (port as NativeDeviceInfo).portPath,
                getStream: () => useSerialStore().deviceHandles.stream,
                setStream: (s) => { useSerialStore().deviceHandles.stream = s; },
            });
        } else {
            this.transport = new SerialTransport({
                log, logError, logWarning, serial, port: port as SerialPort,
                getStream: () => useSerialStore().deviceHandles.stream,
                setStream: (s) => { useSerialStore().deviceHandles.stream = s; },
            });
        }
    }

    // writeWithResponse / write / read / canRead unchanged — both transports same shape
}
```

### `stores/serial.ts`

- `pairedDevices` typed as `Array<SerialPort | NativeDeviceInfo>`.
- `pairedDevicesOptions` branches on `__TAURI__`. Native rows render labels such as
  `"CH340 (Wch.cn) — COM7 — fw 2.64"` using descriptor strings; web rows keep the existing
  `0xVVVV:0xPPPP` label.

### `components/SerialDevice.vue`

- `requestSerialDevices()` branches:
  - Web: existing `navigator.serial.requestPort` call.
  - Native: `listDevices()` from `@am32/native-serial` (no permission prompt — desktop has
    direct access).
- `useIntervalFn(fetchPairedDevices, 500)` runs only on web. On native, `onMounted`
  subscribes to `watchDevices()`; the returned unsubscribe is called in
  `onBeforeUnmount`.
- All other UI (flash modal, save/apply config, EscView, SettingField*) is untouched.

## Tauri shell

### `desktop/src-tauri/tauri.conf.json`

- `productName: "AM32 Configurator"`, identifier `ca.am32.configurator`.
- Window: 1400 × 900, min 1024 × 720, resizable, dark titlebar.
- Bundle targets: `nsis` (Windows), `deb` and `appimage` (Linux).
- `app.security.dangerousRemoteDomainIpcAccess`:
  ```json
  [{ "domain": "am32.ca", "windows": ["main"], "plugins": ["serial", "usb"] }]
  ```
- `app.security.csp`:
  `default-src 'self' https://am32.ca; connect-src 'self' https://am32.ca ipc: http://ipc.localhost; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://am32.ca https://fonts.googleapis.com; script-src 'self' https://am32.ca`.
- `app.security.navigation.scope: ["https://am32.ca/*"]` — webview navigation is locked.
- `bundle.resources: ["../dist/**"]`.
- Updater enabled, manifest URL
  `https://github.com/am32-firmware/am32-configurator/releases/latest/download/latest.json`.

### `desktop/src-tauri/src/main.rs` sketch

- Register commands from `serial.rs`, `usb.rs`, `updater.rs`.
- Hybrid loader in `setup` hook: spawn `tauri::async_runtime` task; ping
  `https://am32.ca/api/sponsors` with 1 s timeout. If 200, build the webview with
  `WebviewUrl::External(Url::parse("https://am32.ca/configurator")?)`. Else with
  `WebviewUrl::App("index.html".into())` from bundled resources.
- On navigation success, emit `app://ready` for the frontend splash teardown.
- Spawn the `rusb::Hotplug` callback thread.

### `desktop/src-tauri/src/serial.rs` core types

```rust
struct SerialState {
    handles: Mutex<HashMap<HandleId, Box<dyn SerialPort + Send>>>,
}

#[tauri::command]
async fn serial_list(state: tauri::State<'_, SerialState>) -> Result<Vec<NativeDeviceInfo>, SerialError>;

#[tauri::command]
async fn serial_open(
    state: tauri::State<'_, SerialState>,
    port_path: String,
    baud: u32,
    data_bits: u8,
    stop_bits: u8,
    parity: String,
    flow_control: String,
) -> Result<HandleId, SerialError>;

// ... read / write / close / set_dtr / set_rts
```

### `desktop/src-tauri/src/usb.rs`

- `rusb::Context::new()` registers a `Hotplug` callback at app launch.
- The callback runs on its own thread, decodes `Device<Context>` → `NativeDeviceInfo`, and
  emits `usb://attach` / `usb://detach` Tauri events.
- `serial_list` reconciles `serialport::available_ports()` with `rusb::devices()` so each
  port row carries the matching descriptor strings.

### `desktop/package.json` scripts

- `dev`: `concurrently "nuxt dev" "tauri dev"` — Tauri targets `http://localhost:3000`
  with `__TAURI__` injection.
- `build`: `nuxt generate && tauri build`.

## Build, release, CI

### Local dev

- `yarn dev:desktop` (new root script): runs `concurrently "nuxt dev" "tauri dev"`. The
  hybrid loader is bypassed in dev — Tauri always points at `http://localhost:3000`.
- `yarn build:desktop`: `nuxt generate` → `desktop/dist/`, then `cd desktop && tauri build`.

### GitHub Actions (`.github/workflows/desktop-release.yml`)

- Trigger: tag `desktop-v*`.
- Matrix: `windows-latest` (NSIS), `ubuntu-22.04` (deb + AppImage).
- Steps per platform: checkout → setup Node 22 + Rust stable → install OS deps
  (`libwebkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`,
  `librsvg2-dev`, `libudev-dev` on Linux) → `yarn install` → `nuxt generate` →
  `tauri build` → upload artifacts.
- Final job: download artifacts, generate `latest.json` (Tauri updater manifest) signed
  with `TAURI_SIGNING_PRIVATE_KEY` secret, attach all assets to the GitHub release.

### Signing keys

- Tauri updater key pair generated once with `tauri signer generate`. Public key checked
  into `tauri.conf.json`. Private key + password as GitHub Actions secrets
  `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Windows Authenticode signing is deferred. SmartScreen warning is acceptable for v1.

### Versioning

- `desktop/package.json` version is independent of root `package.json`. Tag scheme
  `desktop-vX.Y.Z`.
- Updater compares against `desktop/package.json` version at runtime.

### Updater UX

- On launch and every 6 h, check the manifest. On match, toast: "Update X.Y.Z available
  — restart to install?" using the existing `useToast()`. Download in background, apply
  on next restart.

## Risks and mitigations

- **Remote IPC injection on `am32.ca`**: `dangerousRemoteDomainIpcAccess` exposes commands
  to anyone who can land XSS on the site. Mitigations: allowlist limited to
  `serial_*` and `usb_*` only (no filesystem / shell / process); CSP locks
  `script-src` and `connect-src` to `self` + `am32.ca`; navigation scope is restricted.
- **`rusb` hotplug coverage**: works on Linux (libudev) and Windows (SetupDi); the attach
  callback can race port open. Mitigation: debounce attach events 200 ms before emitting.
- **serialport-rs vs OS driver quirks**: CH340 on Linux needs `/dev/ttyUSB*`; CH343 can
  bind to `cdc_acm`. Mitigation: surface `portPath` + descriptor hint in the UI so the
  user can pick if multiple bindings exist.
- **Bundled fallback drift**: bundled assets are frozen at the desktop release tag.
  Mitigation: bundled build shows a version banner; "Reload remote" menu item forces a
  hybrid-loader recheck.
- **Webview navigation away from `am32.ca`**: hard-locked via `navigation.scope`.

## Testing

- Rust unit tests for `serial.rs` command handlers using a mock `SerialPort` trait impl.
- Integration test: build a Tauri dev image, drive the webview with Playwright,
  loop-back a virtual port via `socat -d -d pty,raw,echo=0 pty,raw,echo=0`.
- Manual smoke matrix per release: CH340, CP2102, FTDI FT232, ST-Link VCP on Windows 11
  and Ubuntu 22.04. Procedure documented in `desktop/TESTING.md`.
- Web build regression: `yarn build && yarn preview` in CI catches transport-abstraction
  breakage on the web path.

## Open questions

None at design time. Surface as new specs if they appear during implementation.
