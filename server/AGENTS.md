# server/ — Nuxt Server API

## OVERVIEW

Server-side API routes for firmware file management and EEPROM schema serving. Backed by MinIO, Netlify Blobs, and optional Redis cache.

## STRUCTURE

```
server/
├── api/
│   ├── files.ts           # List firmware from MinIO (releases, bootloaders, tools)
│   ├── download.ts        # Download proxy — DISABLED (returns 400)
│   ├── file/
│   │   └── [name].ts      # File proxy from Netlify Blobs
│   └── eeprom/
│       └── [name].ts      # EEPROM JSON schema by name
├── routes/
│   └── eeprom.ts          # EEPROM schema route
├── middleware/
│   └── json.ts            # JSON response middleware
└── plugins/
    └── storage.ts         # Nitro storage — mounts Netlify Blobs driver
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add API endpoint | `api/` | Use `defineEventHandler`, follow Nuxt convention |
| Firmware file listing | `api/files.ts` | Queries MinIO buckets, 229 LOC, groups by category |
| Serve file by name | `api/file/[name].ts` | Proxies from Netlify Blobs storage |
| EEPROM schema | `api/eeprom/[name].ts` | Returns JSON schema for ESC settings validation |
| Storage config | `plugins/storage.ts` | Mounts `netlifyBlobs` driver at `assets:server` |

## CONVENTIONS

- Routes use `defineEventHandler` (Nitro/H3 pattern)
- MinIO client via `useMinio()` composable from `composables/useMinio.ts`
- Redis caching configured via `REDIS_HOST` env var (see `nuxt.config.ts` runtimeConfig)
- Netlify Blobs as primary file storage in production

## NOTES

- `download.ts` is entirely commented out — returns 400 "url not allowed"
- `files.ts` groups firmware into categories: releases, bootloaders, tools
- Storage plugin mounts at `assets:server` namespace
- Redis + MinIO only available in Docker/self-hosted deployment, not Netlify
