const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.E2E_PORT || '3100';
const WS = process.env.E2E_WS || path.join(os.tmpdir(), 'notepadia-e2e-ws');
const URL = `http://127.0.0.1:${PORT}/`;
const ARTIFACT_DIR = process.env.E2E_ARTIFACTS || path.join(ROOT, 'e2e-artifacts');

const SUITES = [
    'p1-core',
    'encoding',
    'eol',
    'recent',
    'bookmarks',
    'language',
    'view-menu',
    'search',
    'menus-shortcuts',
    'session-restore'
];

function seedWorkspace() {
    fs.rmSync(WS, { recursive: true, force: true });
    fs.mkdirSync(WS, { recursive: true });
    const write = (name, buf) => fs.writeFileSync(path.join(WS, name), buf);
    const alpha = Buffer.from('alpha\nbeta\ngamma\n', 'utf8');
    write('sample.txt', alpha);
    write('app.js', Buffer.from('function greet(name) {\n  // a comment\n  return "hello " + name;\n}\n', 'utf8'));
    write('eol-lf.txt', alpha);
    write('eol-crlf.txt', Buffer.from('alpha\r\nbeta\r\ngamma\r\n', 'utf8'));
    write('enc-utf8.txt', alpha);
    write('enc-utf8bom.txt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), alpha]));
    write('enc-utf16le.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('alpha\nbeta\ngamma\n', 'utf16le')]));
    write('enc-utf16be.txt', Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('alpha\nbeta\ngamma\n', 'utf16le').swap16()]));
    for (const f of ['recent-a.txt', 'recent-b.txt', 'recent-c.txt']) write(f, alpha);
    write('bookmarks.txt', Buffer.from('one\ntwo\nthree\nfour\nfive\n', 'utf8'));
    write('search.txt', Buffer.from('foo one foo\ntwo foo\nfoo three\nbar baz\n', 'utf8'));
}

function httpOk(url, needle) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, res => {
            let body = '';
            res.on('data', c => { body += c; if (body.length > 200000) { req.destroy(); reject(new Error('body too large')); } });
            res.on('end', () => resolve(res.statusCode === 200 && body.includes(needle)));
        });
        req.on('error', () => resolve(false));
        setTimeout(() => { req.destroy(); resolve(false); }, 4000).unref();
    });
}

async function waitForServer(child) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`server process exited early (code ${child.exitCode}); is port ${PORT} already in use?`);
        }
        if (await httpOk(URL, 'Notepadia')) return;
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('server did not come up at ' + URL);
}

function startServer() {
    const theia = path.join(ROOT, 'node_modules', '.bin', 'theia');
    const child = spawn(theia,
        ['start', '--app-target=browser', '--hostname', '127.0.0.1', '--port', PORT, WS],
        { cwd: path.join(ROOT, 'applications', 'browser'), stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => process.stdout.write('[server] ' + d));
    child.stderr.on('data', d => process.stdout.write('[server] ' + d));
    child.on('exit', code => { console.log(`[server] exited (${code})`); });
    return child;
}

async function main() {
    seedWorkspace();
    if (await httpOk(URL, 'Notepadia')) {
        console.error(`FATAL ${URL} already serves a Theia instance; not testing against a stale server (E2E_PORT ${PORT} busy?)`);
        process.exit(1);
    }
    const server = startServer();
    let serverLoaded = false;
    try {
        await waitForServer(server);
        serverLoaded = true;
    } catch (e) {
        console.error('FATAL', e.message);
        if (server) server.kill('SIGTERM');
        process.exit(1);
    }

    let runFailures = 0;
    const results = [];
    for (const suite of SUITES) {
        const file = path.join(__dirname, suite + '.cjs');
        if (!fs.existsSync(file)) {
            console.error(`SKIP ${suite}: not implemented`);
            continue;
        }
        console.log(`\n===== ${suite} =====`);
        const res = spawnSync(process.execPath, [file], {
            cwd: ROOT,
            env: { ...process.env, E2E_URL: URL, E2E_WS: WS },
            encoding: 'utf8',
            timeout: 240000
        });
        const output = (res.stdout || '') + (res.stderr || '');
        process.stdout.write(output);
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
        fs.writeFileSync(path.join(ARTIFACT_DIR, suite + '.log'), output);
        const softFail = /SUMMARY checks=[0-9]+ failures=[1-9]/.test(output) || res.status !== 0;
        if (softFail) {
            runFailures += 1;
            results.push({ suite, status: 'failed' });
            console.log(`RESULT ${suite}: FAILED`);
        } else {
            results.push({ suite, status: 'passed' });
            console.log(`RESULT ${suite}: passed`);
        }
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    if (server) server.kill('SIGTERM');
    try { await new Promise(r => server.on('exit', r)); } catch { }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'status.txt'), runFailures ? 'failed\n' : 'passed\n');
    if (runFailures) {
        console.error(`\ne2e failed: ${runFailures} suite(s)`);
        process.exit(1);
    }
    console.log('\ne2e passed: all suites green');
    process.exit(0);
}

main();