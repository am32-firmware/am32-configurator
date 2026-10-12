// Run with: node --test cli/hex-file-name.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { default: Flash } = await jiti.import('../src/flash.ts');
const { default: Mcu } = await jiti.import('../src/mcu.ts');

function record (address, type, bytes) {
    const data = [bytes.length, address >> 8, address & 255, type, ...bytes];
    data.push((-data.reduce((sum, byte) => sum + byte, 0)) & 255);
    return ':' + data.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function parseSegments (segments) {
    const lines = [];
    for (const [address, bytes] of segments) {
        for (let i = 0; i < bytes.length; i += 16) {
            const current = address + i;
            lines.push(record(0, 4, [current >>> 24, (current >>> 16) & 255]));
            lines.push(record(current & 0xFFFF, 0, bytes.slice(i, i + 16)));
        }
    }
    lines.push(record(0, 1, []));
    const hex = Flash.parseHex(lines.join('\n'));
    assert.ok(hex);
    return hex;
}

const name = 'EPROPELLED_G431_12S_CAN';
const nameBytes = Array.from(new TextEncoder().encode(name + '\0'));

test('CAN name after a contiguous 1 KiB vector region', () => {
    // G431 CAN's linker fills FLASH1 up to the name at 0x08004400.
    // parseHex merges both regions, so the name is not at the block start.
    const hex = parseSegments([
        [0x08004000, Array(1024).fill(0)],
        [0x08004400, nameBytes.concat(Array(32 - nameBytes.length).fill(0), [1, 2, 3])]
    ]);
    assert.equal(hex.data.length, 1);
    assert.equal(hex.data[0].address, 0x08004000);
    const actual = Flash.getFileName(hex, 0x08004400);
    assert.equal(actual, name);
    assert.equal(Mcu.mcuTypeFromFileName(actual), 'G431');
    // Exact target matching must still distinguish variants of the same MCU.
    assert.notEqual(actual, 'EPROPELLED_G431_CAN');
});

test('legacy name immediately before EEPROM in a separate block', () => {
    const hex = parseSegments([[0x08007BE0, nameBytes]]);
    assert.equal(Flash.getFileName(hex, 0x08007C00 - 32), name);
});

test('name split across parsed blocks at a 64 KiB address boundary', () => {
    const hex = parseSegments([[0x0800FFF0, nameBytes]]);
    assert.equal(hex.data.length, 2);
    assert.equal(Flash.getFileName(hex, 0x0800FFF0), name);
});

test('missing name address or a hole in the name is rejected', () => {
    const hex = parseSegments([
        [0x08004400, nameBytes.slice(0, 16)],
        [0x08004411, nameBytes.slice(17)]
    ]);
    assert.equal(Flash.getFileName(hex, 0x080043FF), null);
    assert.equal(Flash.getFileName(hex, 0x08004400), null);
});

test('name must terminate inside its 32-byte region', () => {
    const hex = parseSegments([[0x08004400, Array(32).fill(65).concat(0)]]);
    assert.equal(Flash.getFileName(hex, 0x08004400), null);
});
