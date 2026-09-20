/*
 * Copies the browser style assets (css) and theme json beside lib/browser so
 * the runtime require() of the theme JSON files and any tooling that resolves
 * css from the extension's lib directory can find them. The webpack-based
 * application build also resolves the css through its own loader, but the
 * sources need to exist in lib for Node-side consumers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src', 'browser');
const libDir = path.join(root, 'lib', 'browser');

function copyTree(from, to) {
    if (!fs.existsSync(from)) {
        return;
    }
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
        const src = path.join(from, entry);
        const dst = path.join(to, entry);
        if (fs.statSync(src).isDirectory()) {
            copyTree(src, dst);
        } else {
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(src, dst);
        }
    }
}

copyTree(path.join(srcDir, 'style'), path.join(libDir, 'style'));
copyTree(path.join(srcDir, 'theme'), path.join(libDir, 'theme'));

console.log('[copy-static] style + theme assets copied into lib/browser');