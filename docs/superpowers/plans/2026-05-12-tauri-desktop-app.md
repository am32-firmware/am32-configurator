# Tauri Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Tauri 2 desktop wrapper around the existing AM32 configurator that loads `https://am32.ca` (with bundled offline fallback) and replaces WebSerial with a native USB-serial transport exposing full device descriptors and hot-plug events.

**Architecture:** Single repo. A new `packages/native-serial/` ships a WebSerial-shaped transport (`NativeSerialTransport`, `listDevices`, `watchDevices`) backed by Tauri IPC. A new `desktop/` directory holds a Tauri 2 app whose Rust side exposes `serial_*` and `usb_*` commands using `serialport-rs` + `rusb`. `src/communication/serial.ts` picks `NativeSerialTransport` when `window.__TAURI__` is present; everything above the transport layer (MSP, 4way, Direct, pinia stores, components) is untouched.

**Tech Stack:** Tauri 2, Rust (`serialport`, `rusb`, `thiserror`, `tokio`, `reqwest`), TypeScript, Nuxt 3, Yarn 4 berry workspaces, GitHub Actions, Vitest.

---

## Spec Reference

`docs/superpowers/specs/2026-05-12-tauri-desktop-app-design.md`

## File Structure

**Created**

- `packages/native-serial/package.json` — workspace package metadata.
- `packages/native-serial/tsconfig.json` — TS compiler config.
- `packages/native-serial/vitest.config.ts` — test runner config.
- `packages/native-serial/src/types.ts` — `NativeDeviceInfo`, `SerialOpenOptions`, `SerialError`.
- `packages/native-serial/src/tauri-bridge.ts` — thin wrapper over `@tauri-apps/api` `invoke()` and `listen()`.
- `packages/native-serial/src/transport.ts` — `NativeSerialTransport` class.
- `packages/native-serial/src/devices.ts` — `listDevices`, `watchDevices`.
- `packages/native-serial/src/index.ts` — public exports.
- `packages/native-serial/test/tauri-bridge.spec.ts` — bridge unit tests.
- `packages/native-serial/test/transport.spec.ts` — transport unit tests with mocked bridge.
- `packages/native-serial/test/devices.spec.ts` — unit tests for list/watch.
- `desktop/package.json` — workspace package for Tauri scripts.
- `desktop/tauri.conf.json` — Tauri 2 app config.
- `desktop/icons/icon.png` — app icon placeholder copied from existing assets.
- `desktop/src-tauri/Cargo.toml` — Rust crate manifest.
- `desktop/src-tauri/build.rs` — Tauri build script.
- `desktop/src-tauri/src/main.rs` — app entry, hybrid loader, command registration.
- `desktop/src-tauri/src/serial.rs` — serial commands + handle map.
- `desktop/src-tauri/src/usb.rs` — descriptor enumeration + hotplug.
- `desktop/src-tauri/src/error.rs` — `SerialError` enum + conversions.
- `desktop/TESTING.md` — manual smoke matrix + updater key bootstrap.
- `.github/workflows/desktop-release.yml` — release CI.

**Modified**

- `package.json` — add `workspaces`, `dev:desktop`, `build:desktop` scripts, `concurrently` devDep, `@am32/native-serial` dep.
- `src/communication/serial.ts` — runtime branch on `window.__TAURI__`.
- `stores/serial.ts` — `pairedDevices` union type + native-aware `pairedDevicesOptions` labels + `isNative` flag + `nativeDevice` handle field.
- `components/SerialDevice.vue` — native branch for `requestSerialDevices`, replace `useIntervalFn(fetchPairedDevices, 500)` with `watchDevices()` subscription on native.
- `nuxt.d.ts` — declare `window.__TAURI__`.
- `.gitignore` — add `desktop/src-tauri/target/`, `desktop/dist/`.

---

## Conventions

- Yarn 4 berry workspaces. All commands run from repo root unless stated.
- Rust builds use `cargo build --manifest-path desktop/src-tauri/Cargo.toml`.
- TS tests use `yarn workspace @am32/native-serial test`.
- Commits are conventional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Each commit message ends with the project `Co-Authored-By` footer when produced by Claude.

---

## Phase 0 — Workspace scaffolding

### Task 0.1: Enable yarn workspaces at the repo root

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Read current `package.json`**

Run: `cat package.json`
Note the existing `scripts`, `devDependencies`, and that `type: "module"` and `packageManager: "yarn@4.13.0"` are already set.

- [ ] **Step 2: Add workspaces, desktop scripts, and `concurrently` devDep**

Edit `package.json`. Insert between `"type": "module"` and `"scripts"`:

```json
"workspaces": [
    "packages/*",
    "desktop"
],
```

Append to `"scripts"`:

```json
"dev:desktop": "concurrently -k -n nuxt,tauri -c blue,green \"nuxt dev\" \"yarn workspace am32-desktop tauri dev\"",
"build:desktop": "nuxt generate && yarn workspace am32-desktop tauri build",
"test:native-serial": "yarn workspace @am32/native-serial test"
```

Add to `devDependencies`:

```json
"concurrently": "^9.0.1"
```

- [ ] **Step 3: Update `.gitignore`**

Append:

```
# Tauri
desktop/src-tauri/target/
desktop/dist/
```

- [ ] **Step 4: Install**

Run: `yarn install`
Expected: workspaces resolved, no errors.

- [ ] **Step 5: Verify workspace discovery**

Run: `yarn workspaces list --json`
Expected: lists root only (no `packages/*` or `desktop` yet — those follow in later tasks).

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore yarn.lock
git commit -m "chore: enable yarn workspaces for desktop app

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 — `@am32/native-serial` package

### Task 1.1: Scaffold `@am32/native-serial`

**Files:**
- Create: `packages/native-serial/package.json`
- Create: `packages/native-serial/tsconfig.json`
- Create: `packages/native-serial/vitest.config.ts`
- Create: `packages/native-serial/src/index.ts`

- [ ] **Step 1: Create directories**

Run: `mkdir -p packages/native-serial/src packages/native-serial/test`

- [ ] **Step 2: Write `packages/native-serial/package.json`**

```json
{
    "name": "@am32/native-serial",
    "version": "0.1.0",
    "type": "module",
    "private": true,
    "main": "src/index.ts",
    "types": "src/index.ts",
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest"
    },
    "dependencies": {
        "@tauri-apps/api": "^2.1.1"
    },
    "devDependencies": {
        "typescript": "^5.5.4",
        "vitest": "^2.1.8"
    }
}
```

- [ ] **Step 3: Write `packages/native-serial/tsconfig.json`**

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ES2022",
        "moduleResolution": "Bundler",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "declaration": true,
        "outDir": "dist"
    },
    "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4: Write `packages/native-serial/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.spec.ts']
    }
});
```

- [ ] **Step 5: Write placeholder `src/index.ts`**

```ts
export {};
```

- [ ] **Step 6: Install**

Run: `yarn install`
Expected: `@am32/native-serial` resolved; `@tauri-apps/api` and `vitest` downloaded.

- [ ] **Step 7: Sanity check vitest**

Run: `yarn workspace @am32/native-serial test`
Expected: "No test files found" — 0 failures.

- [ ] **Step 8: Commit**

```bash
git add packages/native-serial yarn.lock
git commit -m "feat(native-serial): scaffold package with vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: Define types

**Files:**
- Create: `packages/native-serial/src/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
export interface NativeDeviceInfo {
    portPath: string;
    usbVendorId: number;
    usbProductId: number;
    manufacturer: string | null;
    product: string | null;
    serialNumber: string | null;
    bcdDevice: number;
    bcdUSB: number;
    interfaceClass: number;
    interfaceSubclass: number;
    maxPacketSize: number;
}

export type Parity = 'none' | 'even' | 'odd';
export type FlowControl = 'none' | 'hardware';

export interface SerialOpenOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: Parity;
    flowControl?: FlowControl;
}

export type SerialErrorKind =
    | 'NotFound'
    | 'InUse'
    | 'PermissionDenied'
    | 'DeviceDisconnected'
    | 'IoError'
    | 'Timeout';

export class SerialError extends Error {
    constructor(public kind: SerialErrorKind, message?: string) {
        super(`${kind}${message ? `: ${message}` : ''}`);
        this.name = 'SerialError';
    }
}

export type HotplugEvent =
    | { type: 'attach'; device: NativeDeviceInfo }
    | { type: 'detach'; device: NativeDeviceInfo };

export type Unsubscribe = () => void;
```

- [ ] **Step 2: Commit**

```bash
git add packages/native-serial/src/types.ts
git commit -m "feat(native-serial): NativeDeviceInfo and SerialError types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: Tauri bridge wrapper with mock seam

**Files:**
- Create: `packages/native-serial/src/tauri-bridge.ts`
- Create: `packages/native-serial/test/tauri-bridge.spec.ts`

- [ ] **Step 1: Write the failing test**

`packages/native-serial/test/tauri-bridge.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createBridge } from '../src/tauri-bridge';

describe('createBridge', () => {
    it('routes invoke calls through the injected fn', async () => {
        const invoke = vi.fn().mockResolvedValue('ok');
        const bridge = createBridge({ invoke, listen: vi.fn() });
        const result = await bridge.invoke('serial_list', { foo: 1 });
        expect(invoke).toHaveBeenCalledWith('serial_list', { foo: 1 });
        expect(result).toBe('ok');
    });

    it('forwards listen subscriptions and returns unsubscribe', async () => {
        const unlisten = vi.fn();
        const listen = vi.fn().mockResolvedValue(unlisten);
        const bridge = createBridge({ invoke: vi.fn(), listen });
        const handler = vi.fn();
        const off = await bridge.listen('usb://attach', handler);
        expect(listen).toHaveBeenCalled();
        off();
        expect(unlisten).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @am32/native-serial test`
Expected: FAIL — cannot resolve `../src/tauri-bridge`.

- [ ] **Step 3: Write implementation**

`packages/native-serial/src/tauri-bridge.ts`:

```ts
export interface BridgeDeps {
    invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    listen: (event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>;
}

export interface Bridge {
    invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
    listen(event: string, cb: (payload: unknown) => void): Promise<() => void>;
}

export function createBridge(deps: BridgeDeps): Bridge {
    return {
        async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
            return (await deps.invoke(cmd, args)) as T;
        },
        async listen(event, handler) {
            const wrapped = (e: { payload: unknown }) => handler(e.payload);
            const unlisten = await deps.listen(event, wrapped);
            return () => unlisten();
        }
    };
}

export async function defaultBridge(): Promise<Bridge> {
    const core = await import('@tauri-apps/api/core');
    const event = await import('@tauri-apps/api/event');
    return createBridge({
        invoke: core.invoke as BridgeDeps['invoke'],
        listen: event.listen as unknown as BridgeDeps['listen']
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @am32/native-serial test`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/native-serial/src/tauri-bridge.ts packages/native-serial/test/tauri-bridge.spec.ts
git commit -m "feat(native-serial): tauri bridge with mockable seam

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: `listDevices` and `watchDevices`

**Files:**
- Create: `packages/native-serial/src/devices.ts`
- Create: `packages/native-serial/test/devices.spec.ts`

- [ ] **Step 1: Write the failing tests**

`packages/native-serial/test/devices.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { listDevices, watchDevices } from '../src/devices';

const sample = {
    portPath: 'COM7',
    usbVendorId: 0x1A86,
    usbProductId: 0x7523,
    manufacturer: 'Wch.cn',
    product: 'USB-SERIAL CH340',
    serialNumber: null,
    bcdDevice: 0x0264,
    bcdUSB: 0x0110,
    interfaceClass: 0xFF,
    interfaceSubclass: 0x00,
    maxPacketSize: 8
};

describe('listDevices', () => {
    it('invokes serial_list and returns the array', async () => {
        const bridge = {
            invoke: vi.fn().mockResolvedValue([sample]),
            listen: vi.fn()
        };
        const devices = await listDevices(bridge);
        expect(bridge.invoke).toHaveBeenCalledWith('serial_list');
        expect(devices).toEqual([sample]);
    });
});

describe('watchDevices', () => {
    it('subscribes to both events and tears down on unsub', async () => {
        const unlistenA = vi.fn();
        const unlistenB = vi.fn();
        const handlers: Record<string, (p: unknown) => void> = {};
        const bridge = {
            invoke: vi.fn(),
            listen: vi.fn().mockImplementation(async (event: string, cb: (p: unknown) => void) => {
                handlers[event] = cb;
                return event === 'usb://attach' ? unlistenA : unlistenB;
            })
        };
        const events: any[] = [];
        const off = await watchDevices(bridge, e => events.push(e));
        handlers['usb://attach'](sample);
        handlers['usb://detach'](sample);
        expect(events).toEqual([
            { type: 'attach', device: sample },
            { type: 'detach', device: sample }
        ]);
        off();
        expect(unlistenA).toHaveBeenCalled();
        expect(unlistenB).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @am32/native-serial test`
Expected: FAIL — `../src/devices` not found.

- [ ] **Step 3: Write implementation**

`packages/native-serial/src/devices.ts`:

```ts
import type { Bridge } from './tauri-bridge';
import type { HotplugEvent, NativeDeviceInfo, Unsubscribe } from './types';

export async function listDevices(bridge: Bridge): Promise<NativeDeviceInfo[]> {
    return bridge.invoke<NativeDeviceInfo[]>('serial_list');
}

export async function watchDevices(
    bridge: Bridge,
    cb: (e: HotplugEvent) => void
): Promise<Unsubscribe> {
    const offAttach = await bridge.listen('usb://attach', (payload) => {
        cb({ type: 'attach', device: payload as NativeDeviceInfo });
    });
    const offDetach = await bridge.listen('usb://detach', (payload) => {
        cb({ type: 'detach', device: payload as NativeDeviceInfo });
    });
    return () => {
        offAttach();
        offDetach();
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @am32/native-serial test`
Expected: 4 passing total.

- [ ] **Step 5: Commit**

```bash
git add packages/native-serial/src/devices.ts packages/native-serial/test/devices.spec.ts
git commit -m "feat(native-serial): listDevices and watchDevices

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.5: `NativeSerialTransport`

**Files:**
- Create: `packages/native-serial/src/transport.ts`
- Create: `packages/native-serial/test/transport.spec.ts`
- Modify: `packages/native-serial/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/native-serial/test/transport.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { NativeSerialTransport } from '../src/transport';

function makeBridge() {
    return {
        invoke: vi.fn(),
        listen: vi.fn()
    };
}

describe('NativeSerialTransport', () => {
    it('opens a port and stores the handle id', async () => {
        const bridge = makeBridge();
        bridge.invoke.mockResolvedValueOnce(42);
        const t = new NativeSerialTransport({
            bridge, log: () => {}, logError: () => {}, logWarning: () => {}, portPath: 'COM7'
        });
        await t.open({ baudRate: 115200 });
        expect(bridge.invoke).toHaveBeenCalledWith('serial_open', {
            portPath: 'COM7',
            baud: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
        expect(t.handleId).toBe(42);
    });

    it('throws if exchange runs before open', async () => {
        const t = new NativeSerialTransport({
            bridge: makeBridge(), log: () => {}, logError: () => {}, logWarning: () => {}, portPath: 'COM7'
        });
        await expect(
            t.exchange(new Uint8Array([1, 2, 3]).buffer, { timeout: 100 })
        ).rejects.toThrow();
    });

    it('exchange sends bytes and returns the response', async () => {
        const bridge = makeBridge();
        bridge.invoke
            .mockResolvedValueOnce(7)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([10, 20, 30]);
        const t = new NativeSerialTransport({
            bridge, log: () => {}, logError: () => {}, logWarning: () => {}, portPath: 'COM7'
        });
        await t.open({ baudRate: 115200 });
        const out = await t.exchange(new Uint8Array([1, 2, 3]).buffer, { timeout: 100 });
        expect(Array.from(out!)).toEqual([10, 20, 30]);
        expect(bridge.invoke).toHaveBeenNthCalledWith(2, 'serial_write', {
            handleId: 7,
            bytes: [1, 2, 3]
        });
        expect(bridge.invoke).toHaveBeenNthCalledWith(3, 'serial_read', {
            handleId: 7,
            maxBytes: 256,
            timeoutMs: 100
        });
    });

    it('close releases the handle on the rust side', async () => {
        const bridge = makeBridge();
        bridge.invoke.mockResolvedValueOnce(9).mockResolvedValueOnce(undefined);
        const t = new NativeSerialTransport({
            bridge, log: () => {}, logError: () => {}, logWarning: () => {}, portPath: 'COM7'
        });
        await t.open({ baudRate: 115200 });
        await t.close();
        expect(bridge.invoke).toHaveBeenLastCalledWith('serial_close', { handleId: 9 });
        expect(t.handleId).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @am32/native-serial test`
Expected: 4 new failures — `../src/transport` not found.

- [ ] **Step 3: Implement transport**

`packages/native-serial/src/transport.ts`:

```ts
import type { Bridge } from './tauri-bridge';
import type { SerialOpenOptions } from './types';
import { SerialError } from './types';

export interface NativeSerialTransportOpts {
    bridge: Bridge;
    log: (s: string) => void;
    logError: (s: string) => void;
    logWarning: (s: string) => void;
    portPath: string;
}

export interface ExchangeOpts {
    timeout: number;
    maxBytes?: number;
}

const DEFAULT_OPEN: Required<Omit<SerialOpenOptions, 'baudRate'>> = {
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
};

export class NativeSerialTransport {
    public handleId: number | null = null;

    constructor(private readonly opts: NativeSerialTransportOpts) {}

    async open(options: SerialOpenOptions): Promise<void> {
        if (this.handleId !== null) {
            return;
        }
        const merged = { ...DEFAULT_OPEN, ...options };
        this.handleId = await this.opts.bridge.invoke<number>('serial_open', {
            portPath: this.opts.portPath,
            baud: merged.baudRate,
            dataBits: merged.dataBits,
            stopBits: merged.stopBits,
            parity: merged.parity,
            flowControl: merged.flowControl
        });
    }

    async close(): Promise<void> {
        if (this.handleId === null) {
            return;
        }
        const id = this.handleId;
        this.handleId = null;
        await this.opts.bridge.invoke('serial_close', { handleId: id });
    }

    async exchange(data: ArrayBuffer, opts: ExchangeOpts): Promise<Uint8Array | null> {
        if (this.handleId === null) {
            throw new SerialError('NotFound', 'port is not open');
        }
        const bytes = Array.from(new Uint8Array(data));
        await this.opts.bridge.invoke('serial_write', {
            handleId: this.handleId,
            bytes
        });
        const response = await this.opts.bridge.invoke<number[]>('serial_read', {
            handleId: this.handleId,
            maxBytes: opts.maxBytes ?? 256,
            timeoutMs: opts.timeout
        });
        return response ? new Uint8Array(response) : null;
    }

    async setDTR(level: boolean): Promise<void> {
        if (this.handleId === null) return;
        await this.opts.bridge.invoke('serial_set_dtr', { handleId: this.handleId, level });
    }

    async setRTS(level: boolean): Promise<void> {
        if (this.handleId === null) return;
        await this.opts.bridge.invoke('serial_set_rts', { handleId: this.handleId, level });
    }
}
```

- [ ] **Step 4: Run tests**

Run: `yarn workspace @am32/native-serial test`
Expected: 8 passing total.

- [ ] **Step 5: Export from package index**

`packages/native-serial/src/index.ts`:

```ts
export * from './types';
export * from './tauri-bridge';
export * from './devices';
export * from './transport';
```

- [ ] **Step 6: Commit**

```bash
git add packages/native-serial/src/transport.ts packages/native-serial/src/index.ts packages/native-serial/test/transport.spec.ts
git commit -m "feat(native-serial): NativeSerialTransport

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Rust Tauri shell

### Task 2.1: Scaffold `desktop/` workspace and minimal Tauri project

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tauri.conf.json`
- Create: `desktop/icons/icon.png` (copy of `public/assets/images/am32-logo.png`)
- Create: `desktop/src-tauri/Cargo.toml`
- Create: `desktop/src-tauri/build.rs`
- Create: `desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Create directories and copy placeholder icon**

```bash
mkdir -p desktop/src-tauri/src desktop/icons
cp public/assets/images/am32-logo.png desktop/icons/icon.png
```

- [ ] **Step 2: Write `desktop/package.json`**

```json
{
    "name": "am32-desktop",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
        "tauri": "tauri"
    },
    "dependencies": {
        "@am32/native-serial": "workspace:*",
        "@tauri-apps/api": "^2.1.1"
    },
    "devDependencies": {
        "@tauri-apps/cli": "^2.1.0"
    }
}
```

- [ ] **Step 3: Write `desktop/tauri.conf.json`**

```json
{
    "$schema": "https://schema.tauri.app/config/2",
    "productName": "AM32 Configurator",
    "version": "0.1.0",
    "identifier": "ca.am32.configurator",
    "build": {
        "frontendDist": "../dist",
        "devUrl": "http://localhost:3000",
        "beforeDevCommand": "",
        "beforeBuildCommand": ""
    },
    "app": {
        "windows": [],
        "security": {
            "csp": "default-src 'self' https://am32.ca; connect-src 'self' https://am32.ca ipc: http://ipc.localhost; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://am32.ca https://fonts.googleapis.com; script-src 'self' https://am32.ca",
            "dangerousRemoteDomainIpcAccess": [
                {
                    "domain": "am32.ca",
                    "windows": ["main"],
                    "plugins": ["serial", "usb"]
                }
            ]
        }
    },
    "bundle": {
        "active": true,
        "targets": ["nsis", "deb", "appimage"],
        "icon": ["icons/icon.png"],
        "category": "DeveloperTool"
    },
    "plugins": {
        "updater": {
            "endpoints": [
                "https://github.com/am32-firmware/am32-configurator/releases/latest/download/latest.json"
            ],
            "pubkey": "REPLACE_AFTER_GENERATING_KEY"
        }
    }
}
```

- [ ] **Step 4: Write `desktop/src-tauri/Cargo.toml`**

```toml
[package]
name = "am32-desktop"
version = "0.1.0"
edition = "2021"

[lib]
name = "am32_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-updater = "2"
serialport = "4.5"
rusb = "0.9"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
once_cell = "1"
log = "0.4"
env_logger = "0.11"
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls"] }
```

- [ ] **Step 5: Write `desktop/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build();
}
```

- [ ] **Step 6: Write minimal `desktop/src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: Install JS deps**

Run: `yarn install`
Expected: `am32-desktop` resolves; `@tauri-apps/cli` downloaded.

- [ ] **Step 8: Verify cargo fetch works**

Run: `cargo fetch --manifest-path desktop/src-tauri/Cargo.toml`
Expected: deps fetched without compile errors. (Full build deferred until commands are added.)

- [ ] **Step 9: Commit**

```bash
git add desktop yarn.lock
git commit -m "feat(desktop): scaffold tauri 2 project

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: `SerialError` enum

**Files:**
- Create: `desktop/src-tauri/src/error.rs`

- [ ] **Step 1: Write `error.rs`**

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "PascalCase")]
pub enum SerialError {
    #[error("device or port not found")]
    NotFound,
    #[error("port is already in use")]
    InUse,
    #[error("permission denied opening port")]
    PermissionDenied,
    #[error("device disconnected")]
    DeviceDisconnected,
    #[error("io error: {0}")]
    IoError(String),
    #[error("operation timed out")]
    Timeout,
}

impl From<serialport::Error> for SerialError {
    fn from(e: serialport::Error) -> Self {
        use serialport::ErrorKind;
        match e.kind {
            ErrorKind::NoDevice => SerialError::NotFound,
            ErrorKind::InvalidInput => SerialError::IoError(e.description),
            ErrorKind::Unknown => SerialError::IoError(e.description),
            ErrorKind::Io(io_kind) => match io_kind {
                std::io::ErrorKind::NotFound => SerialError::NotFound,
                std::io::ErrorKind::PermissionDenied => SerialError::PermissionDenied,
                std::io::ErrorKind::AlreadyExists => SerialError::InUse,
                std::io::ErrorKind::BrokenPipe => SerialError::DeviceDisconnected,
                std::io::ErrorKind::TimedOut => SerialError::Timeout,
                other => SerialError::IoError(format!("{other:?}: {}", e.description)),
            },
        }
    }
}

impl From<rusb::Error> for SerialError {
    fn from(e: rusb::Error) -> Self {
        match e {
            rusb::Error::NoDevice => SerialError::NotFound,
            rusb::Error::Access => SerialError::PermissionDenied,
            rusb::Error::Busy => SerialError::InUse,
            rusb::Error::Timeout => SerialError::Timeout,
            other => SerialError::IoError(format!("{other:?}")),
        }
    }
}
```

- [ ] **Step 2: Register the module in `main.rs`**

Edit `desktop/src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Build**

Run: `cargo build --manifest-path desktop/src-tauri/Cargo.toml`
Expected: compiles cleanly (unused-import warnings are fine).

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/error.rs desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): SerialError enum with serialport/rusb conversions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: USB descriptor enumeration

**Files:**
- Create: `desktop/src-tauri/src/usb.rs`
- Modify: `desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Write `usb.rs`**

```rust
use crate::error::SerialError;
use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDeviceInfo {
    pub port_path: String,
    pub usb_vendor_id: u16,
    pub usb_product_id: u16,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub bcd_device: u16,
    pub bcd_usb: u16,
    pub interface_class: u8,
    pub interface_subclass: u8,
    pub max_packet_size: u8,
}

pub fn enumerate_ports() -> Result<Vec<NativeDeviceInfo>, SerialError> {
    let ports = serialport::available_ports()?;
    let mut out = Vec::new();
    for p in ports {
        if let serialport::SerialPortType::UsbPort(usb) = &p.port_type {
            out.push(enrich_with_rusb(&p.port_name, usb));
        }
    }
    Ok(out)
}

fn fallback_info(port_path: &str, usb: &serialport::UsbPortInfo) -> NativeDeviceInfo {
    NativeDeviceInfo {
        port_path: port_path.to_string(),
        usb_vendor_id: usb.vid,
        usb_product_id: usb.pid,
        manufacturer: usb.manufacturer.clone(),
        product: usb.product.clone(),
        serial_number: usb.serial_number.clone(),
        bcd_device: 0,
        bcd_usb: 0,
        interface_class: 0,
        interface_subclass: 0,
        max_packet_size: 0,
    }
}

fn enrich_with_rusb(port_path: &str, usb: &serialport::UsbPortInfo) -> NativeDeviceInfo {
    let Ok(ctx) = rusb::Context::new() else { return fallback_info(port_path, usb) };
    let Ok(devices) = ctx.devices() else { return fallback_info(port_path, usb) };

    for device in devices.iter() {
        let Ok(desc) = device.device_descriptor() else { continue };
        if desc.vendor_id() != usb.vid || desc.product_id() != usb.pid {
            continue;
        }
        let handle = match device.open() {
            Ok(h) => h,
            Err(_) => return fallback_info(port_path, usb),
        };
        let lang = handle
            .read_languages(Duration::from_millis(100))
            .ok()
            .and_then(|l| l.first().copied());
        let read_str = |idx: u8| -> Option<String> {
            if idx == 0 {
                return None;
            }
            let lang = lang?;
            handle
                .read_string_descriptor(lang, idx, Duration::from_millis(100))
                .ok()
        };

        let (iface_class, iface_subclass, max_packet) = device
            .active_config_descriptor()
            .ok()
            .and_then(|cfg| cfg.interfaces().next().and_then(|i| i.descriptors().next().map(|d| {
                let max_packet = d
                    .endpoint_descriptors()
                    .next()
                    .map(|e| e.max_packet_size() as u8)
                    .unwrap_or(0);
                (d.class_code(), d.sub_class_code(), max_packet)
            })))
            .unwrap_or((0u8, 0u8, 0u8));

        let dv = desc.device_version();
        let uv = desc.usb_version();
        let bcd_device = (dv.0 as u16) << 8 | (dv.1 as u16) << 4 | (dv.2 as u16);
        let bcd_usb = (uv.0 as u16) << 8 | (uv.1 as u16) << 4 | (uv.2 as u16);

        return NativeDeviceInfo {
            port_path: port_path.to_string(),
            usb_vendor_id: usb.vid,
            usb_product_id: usb.pid,
            manufacturer: read_str(desc.manufacturer_string_index().unwrap_or(0))
                .or_else(|| usb.manufacturer.clone()),
            product: read_str(desc.product_string_index().unwrap_or(0))
                .or_else(|| usb.product.clone()),
            serial_number: read_str(desc.serial_number_string_index().unwrap_or(0))
                .or_else(|| usb.serial_number.clone()),
            bcd_device,
            bcd_usb,
            interface_class: iface_class,
            interface_subclass: iface_subclass,
            max_packet_size: max_packet,
        };
    }

    fallback_info(port_path, usb)
}
```

- [ ] **Step 2: Register module in `main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;
mod usb;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Build**

Run: `cargo build --manifest-path desktop/src-tauri/Cargo.toml`
Expected: compiles. If rusb API does not match (different version pulled), look at the actual signatures via `cargo doc --manifest-path desktop/src-tauri/Cargo.toml --open` and adapt accessor names; the enumeration logic is otherwise stable.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/usb.rs desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): enumerate usb serial ports with rusb descriptors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.4: `serial_*` commands

**Files:**
- Create: `desktop/src-tauri/src/serial.rs`
- Modify: `desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Write `serial.rs`**

```rust
use crate::error::SerialError;
use crate::usb::{enumerate_ports, NativeDeviceInfo};
use serialport::SerialPort;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

pub type HandleId = u32;

pub struct SerialState {
    next_id: Mutex<HandleId>,
    handles: Mutex<HashMap<HandleId, Box<dyn SerialPort + Send>>>,
}

impl SerialState {
    pub fn new() -> Self {
        Self {
            next_id: Mutex::new(1),
            handles: Mutex::new(HashMap::new()),
        }
    }

    fn allocate(&self, port: Box<dyn SerialPort + Send>) -> HandleId {
        let mut id_guard = self.next_id.lock().unwrap();
        let id = *id_guard;
        *id_guard += 1;
        self.handles.lock().unwrap().insert(id, port);
        id
    }

    fn with_port<R>(
        &self,
        id: HandleId,
        f: impl FnOnce(&mut Box<dyn SerialPort + Send>) -> Result<R, SerialError>,
    ) -> Result<R, SerialError> {
        let mut handles = self.handles.lock().unwrap();
        let port = handles.get_mut(&id).ok_or(SerialError::NotFound)?;
        f(port)
    }

    fn remove(&self, id: HandleId) {
        self.handles.lock().unwrap().remove(&id);
    }
}

#[tauri::command]
pub async fn serial_list() -> Result<Vec<NativeDeviceInfo>, SerialError> {
    tokio::task::spawn_blocking(enumerate_ports)
        .await
        .map_err(|e| SerialError::IoError(format!("join error: {e}")))?
}

#[tauri::command]
pub async fn serial_open(
    state: tauri::State<'_, SerialState>,
    port_path: String,
    baud: u32,
    data_bits: u8,
    stop_bits: u8,
    parity: String,
    flow_control: String,
) -> Result<HandleId, SerialError> {
    let builder = serialport::new(port_path, baud)
        .data_bits(match data_bits {
            7 => serialport::DataBits::Seven,
            _ => serialport::DataBits::Eight,
        })
        .stop_bits(match stop_bits {
            2 => serialport::StopBits::Two,
            _ => serialport::StopBits::One,
        })
        .parity(match parity.as_str() {
            "even" => serialport::Parity::Even,
            "odd" => serialport::Parity::Odd,
            _ => serialport::Parity::None,
        })
        .flow_control(match flow_control.as_str() {
            "hardware" => serialport::FlowControl::Hardware,
            _ => serialport::FlowControl::None,
        })
        .timeout(Duration::from_millis(50));

    let port = tokio::task::spawn_blocking(move || builder.open())
        .await
        .map_err(|e| SerialError::IoError(format!("join error: {e}")))??;
    Ok(state.allocate(port))
}

#[tauri::command]
pub async fn serial_write(
    state: tauri::State<'_, SerialState>,
    handle_id: HandleId,
    bytes: Vec<u8>,
) -> Result<(), SerialError> {
    state.with_port(handle_id, |port| {
        port.write_all(&bytes).map_err(|e| SerialError::IoError(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub async fn serial_read(
    state: tauri::State<'_, SerialState>,
    handle_id: HandleId,
    max_bytes: usize,
    timeout_ms: u64,
) -> Result<Vec<u8>, SerialError> {
    state.with_port(handle_id, |port| {
        port.set_timeout(Duration::from_millis(timeout_ms))
            .map_err(|e| SerialError::IoError(e.to_string()))?;
        let mut buf = vec![0u8; max_bytes];
        match port.read(&mut buf) {
            Ok(n) => {
                buf.truncate(n);
                Ok(buf)
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => Ok(Vec::new()),
            Err(e) => Err(SerialError::IoError(e.to_string())),
        }
    })
}

#[tauri::command]
pub async fn serial_close(
    state: tauri::State<'_, SerialState>,
    handle_id: HandleId,
) -> Result<(), SerialError> {
    state.remove(handle_id);
    Ok(())
}

#[tauri::command]
pub async fn serial_set_dtr(
    state: tauri::State<'_, SerialState>,
    handle_id: HandleId,
    level: bool,
) -> Result<(), SerialError> {
    state.with_port(handle_id, |port| {
        port.write_data_terminal_ready(level)
            .map_err(|e| SerialError::IoError(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub async fn serial_set_rts(
    state: tauri::State<'_, SerialState>,
    handle_id: HandleId,
    level: bool,
) -> Result<(), SerialError> {
    state.with_port(handle_id, |port| {
        port.write_request_to_send(level)
            .map_err(|e| SerialError::IoError(e.to_string()))?;
        Ok(())
    })
}
```

- [ ] **Step 2: Update `main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;
mod serial;
mod usb;

use serial::SerialState;

fn main() {
    tauri::Builder::default()
        .manage(SerialState::new())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            serial::serial_list,
            serial::serial_open,
            serial::serial_write,
            serial::serial_read,
            serial::serial_close,
            serial::serial_set_dtr,
            serial::serial_set_rts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Build**

Run: `cargo build --manifest-path desktop/src-tauri/Cargo.toml`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/serial.rs desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): serial_* tauri commands

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.5: Hotplug events

**Files:**
- Modify: `desktop/src-tauri/src/usb.rs`
- Modify: `desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Append hotplug watcher to `usb.rs`**

```rust
use rusb::{Hotplug, UsbContext};
use tauri::{AppHandle, Emitter};

struct UsbHotplugHandler {
    app: AppHandle,
}

impl<C: UsbContext> Hotplug<C> for UsbHotplugHandler {
    fn device_arrived(&mut self, device: rusb::Device<C>) {
        if let Some(info) = device_to_info(&device) {
            let _ = self.app.emit("usb://attach", info);
        }
    }

    fn device_left(&mut self, device: rusb::Device<C>) {
        if let Some(info) = device_to_info(&device) {
            let _ = self.app.emit("usb://detach", info);
        }
    }
}

fn device_to_info<C: UsbContext>(device: &rusb::Device<C>) -> Option<NativeDeviceInfo> {
    let desc = device.device_descriptor().ok()?;
    let dv = desc.device_version();
    let uv = desc.usb_version();
    Some(NativeDeviceInfo {
        port_path: String::new(),
        usb_vendor_id: desc.vendor_id(),
        usb_product_id: desc.product_id(),
        manufacturer: None,
        product: None,
        serial_number: None,
        bcd_device: (dv.0 as u16) << 8 | (dv.1 as u16) << 4 | (dv.2 as u16),
        bcd_usb: (uv.0 as u16) << 8 | (uv.1 as u16) << 4 | (uv.2 as u16),
        interface_class: 0,
        interface_subclass: 0,
        max_packet_size: 0,
    })
}

pub fn spawn_hotplug(app: AppHandle) -> Result<(), SerialError> {
    if !rusb::has_hotplug() {
        log::warn!("rusb hotplug unsupported on this platform");
        return Ok(());
    }
    let ctx = rusb::Context::new()?;
    std::thread::Builder::new()
        .name("usb-hotplug".into())
        .spawn(move || {
            let _reg = rusb::HotplugBuilder::new()
                .enumerate(true)
                .register(
                    &ctx,
                    Box::new(UsbHotplugHandler { app }),
                )
                .ok();
            loop {
                ctx.handle_events(None).ok();
            }
        })
        .map_err(|e| SerialError::IoError(e.to_string()))?;
    Ok(())
}
```

- [ ] **Step 2: Wire `spawn_hotplug` into `setup` in `main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;
mod serial;
mod usb;

use serial::SerialState;

fn main() {
    tauri::Builder::default()
        .manage(SerialState::new())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            serial::serial_list,
            serial::serial_open,
            serial::serial_write,
            serial::serial_read,
            serial::serial_close,
            serial::serial_set_dtr,
            serial::serial_set_rts,
        ])
        .setup(|app| {
            usb::spawn_hotplug(app.handle().clone()).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Build**

Run: `cargo build --manifest-path desktop/src-tauri/Cargo.toml`
Expected: compiles. Hotplug attach payloads carry empty `port_path`; the frontend reconciles by refreshing `listDevices()` on either event.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/usb.rs desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): emit usb://attach and usb://detach events

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.6: Hybrid loader (am32.ca probe with bundled fallback)

**Files:**
- Modify: `desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Replace `main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;
mod serial;
mod usb;

use serial::SerialState;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

async fn probe_remote() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(1))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    matches!(
        client.get("https://am32.ca/api/sponsors").send().await,
        Ok(r) if r.status().is_success()
    )
}

fn main() {
    tauri::Builder::default()
        .manage(SerialState::new())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            serial::serial_list,
            serial::serial_open,
            serial::serial_write,
            serial::serial_read,
            serial::serial_close,
            serial::serial_set_dtr,
            serial::serial_set_rts,
        ])
        .setup(|app| {
            usb::spawn_hotplug(app.handle().clone()).ok();

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let url = if probe_remote().await {
                    WebviewUrl::External(
                        "https://am32.ca/configurator".parse().expect("valid url"),
                    )
                } else {
                    WebviewUrl::App("index.html".into())
                };

                let builder = WebviewWindowBuilder::new(&handle, "main", url)
                    .title("AM32 Configurator")
                    .inner_size(1400.0, 900.0)
                    .min_inner_size(1024.0, 720.0);
                match builder.build() {
                    Ok(_) => log::info!("main window built"),
                    Err(e) => log::error!("failed to build window: {e:?}"),
                }
                let _ = handle.emit("app://ready", ());
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Build**

Run: `cargo build --manifest-path desktop/src-tauri/Cargo.toml`
Expected: compiles. Cold build pulls reqwest + rustls (~minutes on first invocation).

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): hybrid loader probes am32.ca with bundled fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Frontend integration

### Task 3.1: Add `@am32/native-serial` to root deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit root `package.json` `dependencies`**

```json
"@am32/native-serial": "workspace:*"
```

- [ ] **Step 2: Install**

Run: `yarn install`
Expected: workspace dep linked.

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: depend on @am32/native-serial from nuxt app

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: Type-augment `window.__TAURI__`

**Files:**
- Modify: `nuxt.d.ts`

- [ ] **Step 1: Append at end of `nuxt.d.ts`**

```ts
declare global {
    interface Window {
        __TAURI__?: unknown;
    }
}
```

- [ ] **Step 2: Build**

Run: `yarn build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add nuxt.d.ts
git commit -m "feat(types): declare window.__TAURI__

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.3: Branch transport selection in `serial.ts`

**Files:**
- Modify: `src/communication/serial.ts`

- [ ] **Step 1: Replace contents**

```ts
import type { WebSerial } from 'webserial-wrapper';
import { SerialTransport, inferPacketProbe, type SerialPacketProbe } from '@am32/serial-msp';
import {
    NativeSerialTransport,
    defaultBridge,
    type Bridge,
    type NativeDeviceInfo
} from '@am32/native-serial';

type AnyDevice = SerialPort | NativeDeviceInfo;

function isNative(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).__TAURI__);
}

function isNativeDevice(d: AnyDevice): d is NativeDeviceInfo {
    return typeof (d as NativeDeviceInfo).portPath === 'string';
}

class Serial {
    private log: LogFn = (_s: string) => {};
    private logError: LogFn = (_s: string) => {};
    private logWarning: LogFn = (_s: string) => {};

    private serial: WebSerial | null = null;
    private port: SerialPort | null = null;
    private transport: SerialTransport | NativeSerialTransport | null = null;
    private bridge: Bridge | null = null;
    private native = false;

    public async init(
        log: LogFn,
        logError: LogFn,
        logWarning: LogFn,
        serial: WebSerial,
        port: AnyDevice
    ) {
        this.log = log;
        this.logError = logError;
        this.logWarning = logWarning;
        this.serial = serial;
        this.native = isNative();

        if (this.native && isNativeDevice(port)) {
            this.bridge ??= await defaultBridge();
            const transport = new NativeSerialTransport({
                bridge: this.bridge,
                log,
                logError,
                logWarning,
                portPath: port.portPath
            });
            await transport.open({ baudRate: 115200 });
            this.transport = transport;
            return;
        }

        if (!isNativeDevice(port)) {
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
    }

    public async deinit() {
        if (this.transport instanceof NativeSerialTransport) {
            await this.transport.close();
        }
        this.transport = null;
    }

    public writeWithResponse(
        data: ArrayBuffer,
        timeout = 250,
        probe?: SerialPacketProbe
    ): Promise<Uint8Array | null> {
        if (!this.transport) {
            throw new Error('Transport not initialised');
        }
        if (this.transport instanceof NativeSerialTransport) {
            return this.transport.exchange(data, { timeout });
        }
        return this.transport.exchange(data, {
            timeout,
            probe: probe ?? inferPacketProbe(new Uint8Array(data))
        });
    }

    public write(data: ArrayBuffer, ms = 50, probe?: SerialPacketProbe) {
        return this.writeWithResponse(data, ms, probe);
    }

    public canRead(): boolean {
        return this.transport !== null;
    }

    public read<T = any>(): Promise<ReadableStreamReadResult<T>> {
        if (!this.transport) {
            this.logError('Serial not initiated!');
            throw new Error('Serial not initiated!');
        }
        if (this.transport instanceof NativeSerialTransport) {
            // FourWay/MSP flows use exchange(), not read(). Reject explicitly so any
            // accidental caller is surfaced rather than hanging forever.
            return Promise.reject(new Error('read() is not supported on native transport'));
        }
        return this.transport.read<T>();
    }
}

export default new Serial();
```

- [ ] **Step 2: Update the single caller in `components/SerialDevice.vue`**

Find the existing `Serial.init(log, logError, logWarning, ...)` call and prefix it with `await`. The surrounding `connectToDevice` is already `async`, so no other change is required.

- [ ] **Step 3: Build**

Run: `yarn build`
Expected: compiles. Type-check passes (Nuxt has `typescript.typeCheck: true`).

- [ ] **Step 4: Commit**

```bash
git add src/communication/serial.ts components/SerialDevice.vue
git commit -m "feat(serial): pick native transport when running under tauri

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.4: Extend pinia serial store for union device type

**Files:**
- Modify: `stores/serial.ts`

- [ ] **Step 1: Replace contents**

```ts
import { defineStore, acceptHMRUpdate } from 'pinia';
import { WebSerial, type StreamInfo } from 'webserial-wrapper';
import type { NativeDeviceInfo } from '@am32/native-serial';
import type { Msp } from '~/src/communication/msp';
import type { FourWay } from '~/src/communication/four_way';

export type PairedDevice = SerialPort | NativeDeviceInfo;

function isNativeDevice(d: PairedDevice): d is NativeDeviceInfo {
    return typeof (d as NativeDeviceInfo).portPath === 'string';
}

export const useSerialStore = defineStore('serial', () => {
    const hasConnection = ref(false);
    const hasSerial = ref(true);
    const isFourWay = ref(false);
    const isDirectConnect = ref(false);
    const isNative = ref(typeof window !== 'undefined' && Boolean((window as any).__TAURI__));
    const pairedDevices = ref<PairedDevice[]>([]);

    const pairedDevicesOptions = computed(() => pairedDevices.value.map((d) => {
        if (isNativeDevice(d)) {
            const fwMajor = (d.bcdDevice >> 8) & 0xFF;
            const fwMinor = d.bcdDevice & 0xFF;
            const fw = `fw ${fwMajor}.${fwMinor.toString(16).padStart(2, '0')}`;
            const product = d.product ?? `0x${padStr(d.usbProductId.toString(16), 4, '0')}`;
            const manufacturer = d.manufacturer ?? 'Unknown';
            return {
                id: d.portPath,
                label: `${product} (${manufacturer}) — ${d.portPath} — ${fw}`
            };
        }
        return {
            id: `${d.getInfo().usbVendorId}:${d.getInfo().usbProductId}`,
            label: `0x${padStr(d.getInfo().usbVendorId?.toString(16) ?? '', 4, '0')}:0x${padStr(d.getInfo().usbProductId?.toString(16) ?? '', 4, '0')}`
        };
    }));

    const selectedDevice = ref<{ id: string, label: string }>({
        id: '-1',
        label: 'Select device'
    });

    const deviceHandles = ref<{
        port: SerialPort | null,
        nativeDevice: NativeDeviceInfo | null,
        serial: WebSerial,
        reader: ReadableStreamDefaultReader | null,
        writer: WritableStreamDefaultWriter | null,
        msp: Msp | null,
        fourWay: FourWay | null,
        stream: StreamInfo | null
    }>({
        port: null,
        nativeDevice: null,
        serial: new WebSerial(),
        reader: null,
        writer: null,
        msp: null,
        fourWay: null,
        stream: null
    });

    const mspData = ref<MspData>({} as MspData);

    function addPairedDevices(devices: PairedDevice[]) {
        pairedDevices.value = [...devices];
    }

    function selectLastDevice() {
        selectedDevice.value = pairedDevicesOptions.value[pairedDevicesOptions.value.length - 1];
    }

    const refreshReader = () => {
        if (deviceHandles.value.port?.readable) {
            deviceHandles.value.reader = deviceHandles.value.port.readable.getReader();
        } else {
            throw new Error('port or read stream not available');
        }
        return deviceHandles.value.reader;
    };

    function $reset() {
        hasConnection.value = false;
        isFourWay.value = false;
        deviceHandles.value = {
            port: null,
            nativeDevice: null,
            serial: deviceHandles.value.serial,
            reader: null,
            writer: null,
            msp: null,
            fourWay: null,
            stream: null
        };
        mspData.value = {} as MspData;
    }

    return {
        refreshReader, mspData, isFourWay, isDirectConnect, isNative,
        hasConnection, hasSerial,
        addPairedDevices,
        addSerialDevices: addPairedDevices, // alias for existing SerialDevice.vue callers
        selectLastDevice, pairedDevices, pairedDevicesOptions,
        selectedDevice, deviceHandles, $reset
    };
});

export type SerialStore = ReturnType<typeof useSerialStore>;

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useSerialStore, import.meta.hot));
}
```

- [ ] **Step 2: Build**

Run: `yarn build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add stores/serial.ts
git commit -m "feat(stores): support NativeDeviceInfo in serial store

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.5: Native discovery and hot-plug in `SerialDevice.vue`

**Files:**
- Modify: `components/SerialDevice.vue`

- [ ] **Step 1: Add imports near the existing `<script setup lang="ts">` imports**

```ts
import { listDevices, watchDevices, defaultBridge, type NativeDeviceInfo } from '@am32/native-serial';
```

- [ ] **Step 2: Replace `requestSerialDevices`**

```ts
const requestSerialDevices = async () => {
    if (serialStore.isNative) {
        await fetchPairedDevices();
        return;
    }
    await navigator.serial.requestPort({
        filters: [
            ...usbFCVendorIds.map(id => ({ usbVendorId: id })),
            ...usbDirectVendorIds.map(id => ({ usbVendorId: id }))
        ]
    });
    await fetchPairedDevices();
};
```

- [ ] **Step 3: Replace `fetchPairedDevices`**

```ts
const fetchPairedDevices = async () => {
    if (serialStore.isNative) {
        const bridge = await defaultBridge();
        const devices: NativeDeviceInfo[] = await listDevices(bridge);
        serialStore.addPairedDevices(devices);
    } else {
        const ports: SerialPort[] = await navigator.serial.getPorts();
        serialStore.addPairedDevices(ports);
    }

    if (serialStore.pairedDevices.length > 0) {
        if (serialStore.selectedDevice.id === '-1') {
            serialStore.selectLastDevice();
            if (serialStore.selectedDevice && isDirectConnectDevice.value) {
                baudrate.value = '19200';
            }
        }
    } else if (serialStore.hasConnection) {
        serialStore.$reset();
        serialStore.selectedDevice = { id: '-1', label: 'Select device' };
    }
};
```

- [ ] **Step 4: Replace `fetchPairedDevices(); useIntervalFn(...)` with lifecycle hooks**

Remove the loose `fetchPairedDevices();` call and the `useIntervalFn(() => fetchPairedDevices(), 500);` line. Add:

```ts
let unsubscribeWatch: (() => void) | null = null;

onMounted(async () => {
    if (serialStore.isNative) {
        const bridge = await defaultBridge();
        unsubscribeWatch = await watchDevices(bridge, () => {
            fetchPairedDevices();
        });
    } else {
        const handle = useIntervalFn(() => fetchPairedDevices(), 500);
        unsubscribeWatch = () => handle.pause();
    }
    await fetchPairedDevices();
});

onBeforeUnmount(() => {
    unsubscribeWatch?.();
});
```

- [ ] **Step 5: Update `isDirectConnectDevice`**

```ts
const isDirectConnectDevice = computed(() => {
    if (serialStore.isNative) {
        const dev = serialStore.pairedDevices.find(
            d => 'portPath' in d && d.portPath === serialStore.selectedDevice.id
        ) as NativeDeviceInfo | undefined;
        if (!dev) return false;
        return usbDirectVendorIds.includes(dev.usbVendorId)
            && !usbDirectDeviceIdExceptions.includes(dev.usbProductId);
    }
    const [vid, pid] = serialStore.selectedDevice.id.split(':').map(s => Number.parseInt(s));
    return usbDirectVendorIds.includes(vid) && !usbDirectDeviceIdExceptions.includes(pid);
});
```

- [ ] **Step 6: Branch device lookup in `connectToDevice`**

Locate this block (`const portTmp: string[] | undefined = serialStore.selectedDevice?.id.split(':');` and the `for (const p of ports) { ... }` loop). Replace it with:

```ts
let nativeDevice: NativeDeviceInfo | null = null;

if (serialStore.isNative) {
    nativeDevice = (serialStore.pairedDevices.find(
        d => 'portPath' in d && d.portPath === serialStore.selectedDevice.id
    ) as NativeDeviceInfo | undefined) ?? null;

    if (!nativeDevice) {
        logError('Native device not found');
        return;
    }

    serialStore.deviceHandles.nativeDevice = nativeDevice;
    await Serial.init(log, logError, logWarning, serialStore.deviceHandles.serial, nativeDevice);
    serialStore.hasConnection = true;

    if (isDirectConnectDevice.value) {
        connectToEsc();
    } else {
        // existing MSP / 4way handshake block — keep the original code, this branch reuses it
        // by falling through into the same `try { ... } catch { ... }` flow.
    }
    return;
}

const portTmp: string[] | undefined = serialStore.selectedDevice?.id.split(':');
if (portTmp) {
    // ... existing web path remains unchanged below ...
}
```

(Adapt indentation to the surrounding code. The native branch reuses `connectToEsc()` and the MSP handshake the same way the web branch does — copy the relevant calls inside the native branch rather than rewriting them; do not duplicate the entire `connectToDevice` body.)

- [ ] **Step 7: Build and lint**

Run: `yarn build && yarn lint`
Expected: compiles. Lint indent errors are mechanical — fix in place.

- [ ] **Step 8: Commit**

```bash
git add components/SerialDevice.vue
git commit -m "feat(serial-device): discover and connect via native transport under tauri

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Packaging, CI, smoke

### Task 4.1: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Desktop Release

on:
    push:
        tags:
            - 'desktop-v*'

jobs:
    build:
        strategy:
            fail-fast: false
            matrix:
                include:
                    - os: ubuntu-22.04
                      target: linux
                    - os: windows-latest
                      target: windows
        runs-on: ${{ matrix.os }}
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 22
            - name: Enable corepack
              run: corepack enable
            - uses: dtolnay/rust-toolchain@stable
            - name: Install Linux deps
              if: matrix.target == 'linux'
              run: |
                  sudo apt update
                  sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libudev-dev libusb-1.0-0-dev
            - name: Install JS deps
              run: yarn install --immutable
            - name: Build Nuxt static
              run: yarn nuxt generate
            - name: Build desktop bundle
              env:
                  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
                  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
              run: yarn workspace am32-desktop tauri build
            - name: Upload artifacts
              uses: actions/upload-artifact@v4
              with:
                  name: bundle-${{ matrix.target }}
                  path: |
                      desktop/src-tauri/target/release/bundle/**/*

    release:
        needs: build
        runs-on: ubuntu-22.04
        steps:
            - uses: actions/checkout@v4
            - uses: actions/download-artifact@v4
              with:
                  path: artifacts
            - name: Create release
              uses: softprops/action-gh-release@v2
              with:
                  files: artifacts/**/*
                  generate_release_notes: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "ci: release workflow for tauri desktop bundles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.2: Manual smoke and updater bootstrap doc

**Files:**
- Create: `desktop/TESTING.md`

- [ ] **Step 1: Write the doc**

```markdown
# Desktop Smoke Test

## Linux (loopback)

1. Install `socat`: `sudo apt install socat`.
2. Create a virtual pair: `socat -d -d pty,raw,echo=0,link=/tmp/am32-a pty,raw,echo=0,link=/tmp/am32-b`.
3. In another terminal, run `cat /tmp/am32-b` to echo bytes.
4. Run desktop: `yarn dev:desktop`.
5. App opens. Verify `/tmp/am32-a` shows up in the port list. (Loopback has no USB descriptors, so its label is the path only — this is expected.)
6. With real hardware: plug a CH340-based ESC link. Verify the label looks like
   `USB-SERIAL CH340 (Wch.cn) — /dev/ttyUSB0 — fw 2.64`.

## Windows (real hardware)

1. Plug a CH340/CP2102/FTDI USB-serial adapter.
2. Build: `yarn build:desktop`.
3. Install the produced `.exe` from `desktop/src-tauri/target/release/bundle/nsis/`.
4. Launch. Confirm hot-plug events: unplug and replug the device while the app is running;
   the port list should refresh within ~500 ms.

## Release sign-off matrix

| Device       | Win 11 | Ubuntu 22.04 | Notes |
|--------------|--------|--------------|-------|
| CH340        |        |              |       |
| CP2102       |        |              |       |
| FT232        |        |              |       |
| ST-Link VCP  |        |              |       |

Fill in pass/fail per release tag.

## Updater key bootstrap (one-time)

1. `yarn workspace am32-desktop tauri signer generate -w ~/.tauri/am32-desktop.key`
2. Public key prints to stdout. Paste into `desktop/tauri.conf.json` →
   `plugins.updater.pubkey`.
3. Add the private key and its password as repo secrets
   `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
4. Commit the public key change with `chore(desktop): set updater pubkey`.
```

- [ ] **Step 2: Commit**

```bash
git add desktop/TESTING.md
git commit -m "docs(desktop): smoke test and updater key bootstrap procedure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.3: First end-to-end dev run

- [ ] **Step 1: Run dev build**

Run: `yarn dev:desktop`
Expected: Nuxt dev server starts on `3000`; Tauri opens a webview pointing there. Inside the webview, `window.__TAURI__` is present and `useSerialStore().isNative` is `true`.

- [ ] **Step 2: Verify port enumeration**

Plug a USB-serial adapter. Click "Port select". Verify the dropdown labels include descriptor strings (manufacturer, product, port path, firmware revision).

- [ ] **Step 3: Verify connection round-trip with a real ESC**

Connect to an ESC. Press "Read". Confirm the MSP handshake completes and ESC info populates. If it does not, capture logs from the in-app `<Log>` panel plus the `yarn dev:desktop` terminal and file a follow-up before tagging a release.

- [ ] **Step 4: Sign off**

If the dev build works end-to-end, mark the milestone:

```bash
git commit --allow-empty -m "chore: desktop dev smoke passed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

**Spec coverage:**
- Architecture overview → Phase 0–2 (workspace + Rust commands) + Phase 3 (frontend swap).
- Native transport contract (`NativeDeviceInfo`, `NativeSerialTransport`, `listDevices`, `watchDevices`) → Task 1.2–1.5, Task 2.3–2.5.
- Rust commands (`serial_list`, `serial_open`, `serial_write`, `serial_read`, `serial_close`, `serial_set_dtr`, `serial_set_rts`) → Task 2.4.
- Hotplug events (`usb://attach`, `usb://detach`) → Task 2.5.
- Frontend `serial.ts` runtime branch + store union type + `SerialDevice.vue` discovery + hot-plug subscription → Task 3.3–3.5.
- Tauri shell config (CSP, `dangerousRemoteDomainIpcAccess`, bundle targets, dynamic window) → Task 2.1 + Task 2.6.
- Hybrid loader → Task 2.6.
- Updater + release CI → Task 4.1–4.2.
- Manual smoke matrix → Task 4.2.

**Placeholder scan:** no `TBD`/`TODO`. Updater pubkey is the literal `REPLACE_AFTER_GENERATING_KEY` because that string is generated out-of-band; the bootstrap procedure is in Task 4.2.

**Type consistency:**
- `NativeDeviceInfo` matches across TS (`packages/native-serial/src/types.ts`) and Rust serde (`desktop/src-tauri/src/usb.rs` with `#[serde(rename_all = "camelCase")]`).
- `HandleId` is `u32` in Rust, `number` in TS; serde converts naturally.
- `SerialError` shape (`{ kind, message? }`) is mirrored between `error.rs` and `types.ts`.

## Open follow-ups (not blocking this plan)

- macOS bundle target.
- Windows Authenticode code signing.
- Splash screen + "Reload remote" menu item.
- Auto-driver hint when CH340 is missing on a fresh Windows install.
