import { realpath, readdir, stat } from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

/**
 * Files are distributed from a plain directory that is mounted into the
 * container (FILES_ROOT). It holds one sub-directory per section, named
 * after the buckets the object store used to expose, so an existing export
 * can be rsynced in as-is:
 *
 *   $FILES_ROOT/releases/<tag>/<asset>
 *   $FILES_ROOT/kiss-ultra-releases/<tag>/<asset>
 *   $FILES_ROOT/bootloaders/<tag>/<asset>
 *   $FILES_ROOT/am32-tools/<asset>
 *   $FILES_ROOT/unlocker/<tag>/<asset>
 *   $FILES_ROOT/binaries/<esc-name>/v<layout>.bin
 *   $FILES_ROOT/schemas/eeprom.json
 */
const DEFAULT_FILES_ROOT = './storage/files';

export type StorageEntry = {
    /** path relative to the section directory, always '/'-separated */
    path: string,
    /** file name without any directory part */
    name: string,
    size: number
};

export function getFilesRoot (): string {
    const configured = process.env.FILES_ROOT?.trim();

    return resolve(configured || DEFAULT_FILES_ROOT);
}

/**
 * A missing path is a normal outcome — a deployment need not carry every
 * section, and a 404 is the answer for a file that is not there. Anything
 * else (a broken mount, wrong ownership, an I/O error) would otherwise
 * render as a silently empty download page, so it gets logged.
 */
function reportStorageError (operation: string, target: string, error: unknown): void {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return;
    }

    // eslint-disable-next-line no-console
    console.error(`[fileStorage] ${operation} failed for ${target}:`, error);
}

async function safeRealpath (target: string): Promise<string | null> {
    try {
        return await realpath(target);
    } catch (error) {
        reportStorageError('realpath', target, error);

        return null;
    }
}

async function safeStat (target: string): Promise<Stats | null> {
    try {
        return await stat(target);
    } catch (error) {
        reportStorageError('stat', target, error);

        return null;
    }
}

async function safeReaddir (dir: string): Promise<Dirent[]> {
    try {
        return await readdir(dir, { withFileTypes: true });
    } catch (error) {
        reportStorageError('readdir', dir, error);

        return [];
    }
}

function isContained (root: string, target: string): boolean {
    const rel = relative(root, target);

    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * True when a single path segment is safe to append to a path built from
 * FILES_ROOT: no separators, no traversal, no NUL byte. Used by the ingest
 * side, which builds paths out of names it does not control.
 */
export function isSafePathSegment (segment: string): boolean {
    return segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('/') &&
        !segment.includes('\\') &&
        !segment.includes('\0');
}

/**
 * Resolves a caller supplied path against the storage root and refuses
 * anything that leaves it — '..' segments, absolute paths, NUL bytes and
 * symlinks pointing outside the mount. Returns the real path of an existing
 * regular file, or null.
 */
export async function resolveStorageFile (requestedPath: string): Promise<string | null> {
    if (!requestedPath || requestedPath.includes('\0') || isAbsolute(requestedPath)) {
        return null;
    }

    const root = await safeRealpath(getFilesRoot());

    if (!root) {
        return null;
    }

    const target = resolve(root, requestedPath);

    if (!isContained(root, target)) {
        return null;
    }

    const real = await safeRealpath(target);

    if (!real || !isContained(root, real)) {
        return null;
    }

    const stats = await safeStat(real);

    return stats?.isFile() ? real : null;
}

async function walk (root: string, dir: string, prefix: string, out: StorageEntry[]): Promise<void> {
    for (const dirent of await safeReaddir(dir)) {
        if (dirent.name.startsWith('.')) {
            continue;
        }

        const absolute = join(dir, dirent.name);
        const path = prefix ? `${prefix}/${dirent.name}` : dirent.name;

        let isDirectory = dirent.isDirectory();
        let isFile = dirent.isFile();
        let size = 0;

        if (dirent.isSymbolicLink()) {
            // follow it, but only while it stays inside the mount
            const real = await safeRealpath(absolute);

            if (!real || !isContained(root, real)) {
                continue;
            }

            const stats = await safeStat(real);
            isDirectory = stats?.isDirectory() ?? false;
            isFile = stats?.isFile() ?? false;
            size = stats?.size ?? 0;
        } else if (isFile) {
            size = (await safeStat(absolute))?.size ?? 0;
        }

        if (isDirectory) {
            await walk(root, absolute, path, out);
        } else if (isFile) {
            out.push({ path, name: dirent.name, size });
        }
    }
}

/**
 * Lists every regular file below a section directory, recursively.
 * A missing section directory yields an empty list rather than an error:
 * a deployment may simply not distribute that section.
 */
export async function listStorageFiles (section: string): Promise<StorageEntry[]> {
    const root = await safeRealpath(getFilesRoot());

    if (!root) {
        return [];
    }

    const sectionDir = resolve(root, section);

    if (!isContained(root, sectionDir)) {
        return [];
    }

    const entries: StorageEntry[] = [];
    await walk(root, sectionDir, '', entries);

    return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/** Public URL the browser uses to download a file from the mounted folder. */
export function buildFileUrl (section: string, path: string): string {
    return `/api/file/${[section, ...path.split('/')].map(encodeURIComponent).join('/')}`;
}
