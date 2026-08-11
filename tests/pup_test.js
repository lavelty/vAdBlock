// pup_test.js — mobileproxy.space adblock testini otomatik kocastirir.
// Kullanim: node tests/pup_test.js  (uzanti yolu: bu scriptin bir ust dizini)
// Chrome 137+ branded build'ler --load-extension desteklemedigi icin
// puppeteer'in enableExtensions secenegi kullanilir.
const puppeteer = require('../node_modules/puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EXT = path.resolve(__dirname, '..');
const TEST_URL = process.env.TEST_URL || 'https://mobileproxy.space/tr/adblock-test.html';
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lave-test-'));

(async () => {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: false,
        userDataDir,
        enableExtensions: [EXT],
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--ignore-certificate-errors',
            '--window-size=1280,900'
        ]
    });

    await new Promise(r => setTimeout(r, 4000));

    const targets = browser.targets().map(t => t.type() + ' :: ' + t.url());
    console.log('TARGETS:');
    targets.forEach(t => console.log('  ' + t));

    let extId = null;
    for (const t of browser.targets()) {
        const m = t.url().match(/chrome-extension:\/\/([a-p]{32})/);
        if (m) { extId = m[1]; break; }
    }
    console.log('Extension ID:', extId);

    const swTarget = browser.targets().find(t => t.type() === 'service_worker' && t.url().includes(extId || 'chrome-extension'));
    if (swTarget) {
        const sw = await swTarget.worker();
        sw.on('console', msg => console.log('[SW ' + msg.type() + ']', msg.text()));
        sw.on('error', e => console.log('[SW ERROR]', e.message));
        console.log('SW attached.');
    } else {
        console.log('SW target not found');
    }

    const pages = await browser.pages();
    const page = pages[0];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') pageErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message));

    console.log('Navigating...');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto error:', e.message));
    await new Promise(r => setTimeout(r, 6000));

    const info = await page.evaluate(() => {
        const tests = typeof AdBlockTest !== 'undefined' ? AdBlockTest.tests : null;
        let total = 0;
        if (tests) for (const k in tests) total += tests[k].domains.length;
        return { hasAdBlockTest: typeof AdBlockTest !== 'undefined', total, pathname: location.pathname };
    });
    console.log('PAGE INFO:', JSON.stringify(info));

    const probe = await page.evaluate(async () => {
        const r = await fetch('https://googletagmanager.com/favicon.ico', { method: 'HEAD', mode: 'no-cors' }).then(() => 'OK (not blocked)').catch(() => 'BLOCKED');
        return r;
    });
    console.log('PROBE googletagmanager.com:', probe);

    const started = await page.evaluate(() => {
        try { AdBlockTest.startTest(); return 'started'; } catch (e) { return 'ERR: ' + e.message; }
    });
    console.log('Start via eval:', started);

    await page.waitForFunction(() => {
        const t = document.getElementById('statusText');
        return t && (t.textContent.includes('tamamland') || t.textContent.includes('complete'));
    }, { timeout: 240000 }).catch(e => console.log('Completion wait:', e.message));

    const result = await page.evaluate(() => ({
        score: document.getElementById('scoreValue')?.textContent,
        progress: document.getElementById('progressText')?.textContent,
        status: document.getElementById('statusText')?.textContent,
        total: typeof AdBlockTest !== 'undefined' ? AdBlockTest.totalTests : null,
        blocked: typeof AdBlockTest !== 'undefined' ? AdBlockTest.blockedTests : null
    }));
    console.log('RESULT:', JSON.stringify(result));

    try {
        const cats = await page.evaluate(() => {
            const out = [];
            for (const [key, res] of Object.entries(AdBlockTest.results || {})) {
                out.push({ key, blocked: res.blocked, total: res.total, failed: res.domains.filter(d => !d.blocked).map(d => d.domain) });
            }
            return out;
        });
        console.log('CATEGORIES:');
        for (const c of cats) {
            console.log('  ' + c.key + ' ' + c.blocked + '/' + c.total + ' -> fail: ' + c.failed.join(', '));
        }
    } catch (e) { console.log('cat dump err', e.message); }

    console.log('PAGE ERRORS (unique, ' + pageErrors.length + ' total):');
    [...new Set(pageErrors)].slice(0, 40).forEach(e => console.log('  ' + e));

    await browser.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
})().catch(e => { console.error('FATAL', e); process.exit(1); });
