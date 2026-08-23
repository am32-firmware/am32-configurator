#!/usr/bin/env python3
'''
Protocol test matrix: run cli/am32cli.mjs against the pure-python
bootloader emulator (ci/bootloader_sim.py) over every combination of
transport (direct / 4way), bootloader generation (old = V17-era
protocol v2, new = V19-era protocol v3) and flash size (32/64/128k).

Not every cell is expected to pass - the app refuses some combinations
by design, and those refusals are part of what is being tested:

  direct + 128k (both generations)  the app refuses direct-connect on
                                    parts whose flash exceeds the 16-bit
                                    wire-address space
  4way + 128k + old                 128k parts need v3 devinfo; the app
                                    must fail with its "requires v3" error

Everything else must pass end to end (connect, settings write/readback,
full flash, post-flash reconnect). Exit 0 only if every cell behaves as
expected.
'''

import os
import subprocess
import sys
import tempfile
import time

CI_DIR = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(CI_DIR)
sys.path.insert(0, CI_DIR)

from bootloader_sim import FLASH_VARIANTS, MCU_FLASH_START  # noqa: E402


def ihex_line(addr16, rectype, data):
    rec = bytes([len(data), (addr16 >> 8) & 0xFF, addr16 & 0xFF, rectype]) \
        + data
    ck = (-sum(rec)) & 0xFF
    return ':' + (rec + bytes([ck])).hex().upper()


def make_hex(flash_kb):
    '''a small synthetic firmware image: a few KB of app data at the
    firmware start plus the 32-byte file-name block below the EEPROM,
    which both flash flows in the app require'''
    v = FLASH_VARIANTS[flash_kb]
    lines = []
    ela = None

    def emit(address, data):
        nonlocal ela
        for off in range(0, len(data), 16):
            a = address + off
            seg = a >> 16
            if seg != ela:
                ela = seg
                lines.append(ihex_line(0, 0x04, bytes([seg >> 8, seg & 0xFF])))
            lines.append(ihex_line(a & 0xFFFF, 0x00, data[off:off + 16]))

    fw = bytes((13 + i * 7) & 0xFF for i in range(4096))
    emit(MCU_FLASH_START + v['fw_start'], fw)
    name = v['file_name'].encode().ljust(32, b'\0')
    emit(MCU_FLASH_START + v['eeprom_offset'] - 32, name)
    lines.append(ihex_line(0, 0x01, b''))
    return '\n'.join(lines) + '\n'


def run_cell(mode, generation, flash_kb, hex_path, timeout):
    sim = subprocess.Popen(
        [sys.executable, os.path.join(CI_DIR, 'bootloader_sim.py'),
         '--mode', mode, '--generation', generation,
         '--flash-size', str(flash_kb)],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        tty_path = sim.stdout.readline().strip()
        if not tty_path.startswith('/'):
            return 3, 'emulator did not report a pty path'
        suite = 'direct-suite' if mode == 'direct' else 'fourway-suite'
        try:
            proc = subprocess.run(
                ['node', os.path.join(REPO, 'cli', 'am32cli.mjs'),
                 suite, tty_path, hex_path],
                cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, timeout=timeout)
            return proc.returncode, proc.stdout
        except subprocess.TimeoutExpired as ex:
            out = ex.stdout or ''
            if isinstance(out, bytes):
                out = out.decode(errors='replace')
            return 2, out + '\n[matrix] suite timed out after %us' % timeout
    finally:
        sim.terminate()
        sim.wait()


def main():
    cells = []
    for mode in ('direct', '4way'):
        for generation in ('old', 'new'):
            for flash_kb in (32, 64, 128):
                cells.append((mode, generation, flash_kb))

    hexes = {}
    tmpdir = tempfile.mkdtemp(prefix='am32-matrix-')
    for kb in (32, 64, 128):
        path = os.path.join(tmpdir, 'fw_%uk.hex' % kb)
        with open(path, 'w') as f:
            f.write(make_hex(kb))
        hexes[kb] = path

    results = []
    failed = False
    for mode, generation, flash_kb in cells:
        # expected outcome per cell (see module docstring)
        if mode == 'direct' and flash_kb == 128:
            expect = ('refused', 'not supported in direct-connect mode')
        elif mode == '4way' and flash_kb == 128 and generation == 'old':
            expect = ('refused', 'requires v3')
        else:
            expect = ('pass', None)

        name = '%-6s %-3s %4uk' % (mode, generation, flash_kb)
        print('=== %s (expect %s) ===' % (name, expect[0]), flush=True)
        t0 = time.time()
        rc, out = run_cell(mode, generation, flash_kb, hexes[flash_kb],
                           timeout=420)
        took = time.time() - t0

        if expect[0] == 'pass':
            ok = rc == 0
            detail = 'suite passed' if ok else 'exit %u' % rc
        else:
            ok = rc not in (0, 2, 3) and expect[1] in out
            if rc == 0:
                detail = 'unexpectedly passed'
            elif expect[1] in out:
                detail = 'refused with expected error'
            else:
                detail = 'failed without the expected message (exit %u)' % rc
        if not ok:
            failed = True
            print(out)
        results.append((name, expect[0], ok, detail, took))
        print('--- %s: %s (%.1fs)' % (name, 'OK' if ok else 'FAIL', took),
              flush=True)

    print('\n%-18s %-8s %-6s %s' % ('cell', 'expect', 'result', 'detail'))
    for name, expect, ok, detail, took in results:
        print('%-18s %-8s %-6s %s (%.1fs)'
              % (name, expect, 'OK' if ok else 'FAIL', detail, took))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
