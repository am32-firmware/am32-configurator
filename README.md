# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## File distribution

Firmware releases, bootloaders, tools, the unlocker, the eeprom default
binaries and the eeprom schema are served straight from a directory on the
server — no object store involved. `FILES_ROOT` points at it (default
`./storage/files`, `/data/files` inside the container), and the server only
ever reads from it:

```
$FILES_ROOT/
  releases/<tag>/<asset>                  # /api/files?filter=releases
  kiss-ultra-releases/<tag>/<asset>       # /api/files?filter=kiss-ultra-releases
  bootloaders/<tag>/<asset>               # /api/files?filter=bootloader
  am32-tools/<asset>                      # /api/files?filter=tools
  unlocker/<tag>/<asset>                  # /api/files?filter=unlocker
  binaries/<esc-name>/v<layout>.bin       # /api/eeprom/<esc-name>?version=<layout>
  schemas/eeprom.json                     # /eeprom
```

A tag directory ending in `-rc` is treated as a prerelease and hidden unless
the request carries `?prereleases`. Files are downloaded through
`/api/file/<section>/<path>`; paths are stable, so browsers and the client
side cache keep what they already fetched. Anything resolving outside
`FILES_ROOT` (`..` segments, symlinks leaving the mount) is refused.

Mount the host directory into the container by setting `FILES_HOST_PATH`
before `docker compose up`; `docker-compose.yml` binds it read-only at
`/data/files`.

To mirror the GitHub release assets into that directory, run the sync script
on the host that owns the mount:

```bash
FILES_ROOT=/srv/am32/files tsx run.ts
```

### Where the folder comes from

The files were previously served through an S3 API in front of the same data:
a Versity Gateway (`versitygw`) running with a POSIX backend, so each "bucket"
was already a directory on the server. Migrating was a folder-to-folder copy,
not an object-store export — bucket names and directory names match one for
one, which is why the layout above needs no translation.

If a deployment still has an S3-compatible endpoint holding these files, any
mirroring tool will do; nothing in the app talks to S3 any more.
