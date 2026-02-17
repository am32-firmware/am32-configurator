# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-17
**Commit:** ff33c91
**Branch:** master

## OVERVIEW

AM32 Configurator — Nuxt 3 SPA/PWA for configuring AM32 ESC firmware via Web Serial API. Stack: Vue 3 + TypeScript + Pinia + Tailwind CSS + Nuxt UI. Deployed on Netlify.

## STRUCTURE

```
am32-configurator/
├── app.vue                # Root — WebSerial gate + PWA init
├── pages/                 # 3 pages: index, configurator, downloads
├── components/            # Vue components (SerialDevice is 1100+ LOC)
│   └── modals/            # Modal dialogs (FlashHex)
├── layouts/               # default.vue — header, nav, footer
├── src/                   # Core domain logic (→ see src/AGENTS.md)
│   └── communication/     # Serial protocols (MSP, FourWay, Direct)
├── stores/                # Pinia stores (serial, esc, log)
├── utils/                 # Buffer/array/string helpers (11 files)
├── composables/           # useMinio
├── plugins/               # Matomo analytics, AnimXYZ
├── server/                # Nuxt server API (→ see server/AGENTS.md)
├── content/               # Nuxt Content markdown
├── assets/                # Icons (SVG) + logos
├── public/                # Static images (PWA icons, screenshots)
└── docker/                # Docker + Traefik deployment
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| ESC settings UI | `pages/configurator.vue` | Main page, 633 LOC |
| Serial connection flow | `components/SerialDevice.vue` | Largest component (1127 LOC) |
| Settings field rendering | `components/SettingField.vue`, `SettingFieldGroup.vue` | EEPROM field UI |
| Flash dialog | `components/modals/FlashHex.vue` | Hex flashing UI |
| Protocol layer | `src/communication/` | MSP → FourWay/Direct → Serial |
| MCU definitions | `src/mcu.ts` | Signature → variant mapping |
| EEPROM layout | `src/eeprom.ts` | Byte-level field map |
| Hex parsing | `src/flash.ts` | Intel HEX format |
| Buffer ↔ settings | `utils/buffer-to-settings.ts`, `utils/object-to-settings-array.ts` | Core serialization |
| Firmware files API | `server/api/files.ts` | MinIO-backed list |
| Serial state | `stores/serial.ts` | Connection, device handles |
| ESC state | `stores/esc.ts` | ESC data, flash progress |
| Logging | `stores/log.ts` | Centralized log |

## CONVENTIONS

- **Indent**: 4 spaces (ESLint enforced)
- **Semicolons**: always required
- **Package manager**: Yarn 4.12 — do NOT use npm
- **SSR disabled**: pure SPA (`ssr: false`), no server-side rendering for pages
- **Auto-imports**: Nuxt auto-imports Vue APIs, composables, utils, stores
- **Singletons**: `Serial`, `Msp`, `FourWay`, `Direct` — `export default new X()`
- **Store pattern**: Composition API Pinia stores with HMR via `acceptHMRUpdate`
- **Icons**: Tailwind Icons plugin — `mdi`, `heroicons`, `material-symbols`, `svg-spinners`
- **Font**: Nunito Sans (primary)
- **Color mode**: dark preference
- **UI library**: Nuxt UI v2 (`UButton`, `UCard`, `UNotifications`, etc.)

## ANTI-PATTERNS (THIS PROJECT)

- No test framework — no jest, vitest, or cypress configured
- No CI/CD — no GitHub Actions workflows
- Extended HEX records (0x02, 0x03) throw `NOT IMPLEMENTED` in `src/flash.ts`
- `server/api/download.ts` is commented out — returns 400
- `src/communication/serial.ts` has verbose `console.log` debug artifacts

## COMMANDS

```bash
yarn dev          # Start dev server
yarn build        # Production build
yarn generate     # Static site generation
yarn preview      # Preview production build
yarn lint         # ESLint check
yarn upload:files # Upload firmware files to MinIO
```

## NOTES

- Web Serial API requires Chromium browser — `app.vue` gates entire app on `navigator.serial`
- Communication flow: App → MSP → FourWay/Direct → ESC. MSP negotiates passthrough first.
- EEPROM layout is version-gated: some fields require `minEepromVersion >= 3`
- MCU variants identified by 2-byte signature (e.g. `1F06` = STM32F051)
- `Mcu.LAYOUT_SIZE = 0xB8` (184 bytes) — total EEPROM read size
- `Mcu.RESET_DELAY_MS = 5000` — wait 5s for MCU reset after flash
- Production: Netlify + Netlify Blobs. Alt: Docker + Redis + Traefik
- PWA auto-update with 1h periodic sync
