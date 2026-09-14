import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.SMOKE_PORT || '3100';
const WS = path.join(os.tmpdir(), 'notepadia-smoke-ws');
const URL = `http://127.0.0.1:${PORT}/`;

fs.rmSync(WS, { recursive: true, force: true });
fs.mkdirSync(WS, { recursive: true });
fs.writeFileSync(path.join(WS, 'sample.txt'), 'alpha\nbeta\ngamma\n');

function httpOk() {
    return new Promise(resolve => {
        const req = http.get(URL, res => {
            let body = '';
            res.on('data', c => { body += c; if (body.length > 200000) { req.destroy(); resolve(false); } });
            res.on('end', () => resolve(res.statusCode === 200 && body.includes('Notepadia')));
        });
        req.on('error', () => resolve(false));
        setTimeout(() => { req.destroy(); resolve(false); }, 4000).unref();
    });
}

async function waitForServer(child) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
        if (await httpOk()) return;
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('browser app did not boot at ' + URL);
}

const theia = path.join(ROOT, 'node_modules', '.bin', 'theia');
const child = spawn(theia,
    ['start', '--app-target=browser', '--hostname', '127.0.0.1', '--port', PORT, WS],
    { cwd: path.join(ROOT, 'applications', 'browser'), stdio: ['ignore', 'pipe', 'pipe'] });
const log = [];
child.stdout.on('data', d => log.push(d.toString()));
child.stderr.on('data', d => log.push(d.toString()));

try {
    await waitForServer(child);
    console.log(`PASS browser app boots: GET ${URL} -> 200 with Notepadia page`);
    process.exit(0);
} catch (e) {
    console.error('FAIL ' + e.message);
    process.stderr.write(log.join('').slice(-2000));
    process.exit(1);
}

process.on('exit', () => { try { child.kill('SIGTERM'); } catch { } });