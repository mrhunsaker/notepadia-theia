#!/usr/bin/env node
/**
 * Generates the Notepadia product icons (PNG set, ICO, ICNS) from icon.svg.
 *
 * Requires `rsvg-convert` (librsvg) and ImageMagick's `magick` on the PATH.
 * Run from this directory: `node generate-icons.mjs`
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = path.join(dir, 'icon.svg');
const iconsDir = path.join(dir, 'icons');
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const tmp = mkdtempSync(path.join(os.tmpdir(), 'notepadia-icons-'));
const png = size => path.join(tmp, `${size}.png`);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

const master = path.join(tmp, 'master.png');
run('rsvg-convert', ['-w', '1024', '-h', '1024', svg, '-o', master]);

mkdirSync(iconsDir, { recursive: true });
for (const size of sizes) {
    run('magick', [master, '-resize', `${size}x${size}`, `PNG32:${png(size)}`]);
    writeFileSync(path.join(iconsDir, `${size}x${size}.png`), readFileSync(png(size)));
}
writeFileSync(path.join(dir, 'icon.png'), readFileSync(png(512)));

run('magick', [png(16), png(24), png(32), png(48), png(64), png(128), png(256), path.join(dir, 'icon.ico')]);

const icnsTypes = { icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024 };
const chunks = [];
for (const [type, size] of Object.entries(icnsTypes)) {
    const data = readFileSync(png(size));
    const header = Buffer.alloc(8);
    header.write(type, 0, 'ascii');
    header.writeUInt32BE(8 + data.length, 4);
    chunks.push(header, data);
}
const body = Buffer.concat(chunks);
const fileHeader = Buffer.alloc(8);
fileHeader.write('icns', 0, 'ascii');
fileHeader.writeUInt32BE(8 + body.length, 4);
writeFileSync(path.join(dir, 'icon.icns'), Buffer.concat([fileHeader, body]));

rmSync(tmp, { recursive: true, force: true });
console.log('Generated icon.png, icon.ico, icon.icns and icons/:', sizes.map(s => `${s}x${s}.png`).join(' '));
