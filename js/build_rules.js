// build_rules.js
// AdGuard/EasyList/uBO listelerini indirip uretir:
//   - rules.json        : BASE statik kurallar (id < 2000000; chunk kurallari artik burada DEGIL)
//   - filter_lists.json : per-list domain dizileri (easylist/easyprivacy/adguard/ubo)
//                         -> background.js bunlari DINAMIK chunk kurali olarak kurar
//   - cosmetic_rules.txt: kozmetik kurallar
//
// ID aralik plani:
//   STATIK (rules.json)           : 1..999999 (mevcut) + 1000000..1000041 (el ile)
//   DINAMIK allowlist             : hashDomain() -> 1000000+
//   DINAMIK koruma seviyesi allow : 500000..599999
//   DINAMIK filtre chunk'lar      : 3000000..3099999 (liste bazli)
//   DINAMIK kullanici network     : 4000000..4099999 (blok), 4100000..4199999 (allow)

const fs = require('fs');
const path = require('path');
const fp = require('./filter_parser.js');

const EXT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(EXT_DIR, 'data');
const LISTS_DIR = path.join(require('os').tmpdir(), 'vadblock-lists');

async function fetchRawLists() {
    const rawTexts = {};
    for (const [listId, urls] of Object.entries(fp.SOURCES)) {
        rawTexts[listId] = '';
        for (const url of urls) {
            const name = url.split('/').pop().replace(/[^a-z0-9_.-]/gi, '_');
            const target = path.join(LISTS_DIR, name);
            if (!fs.existsSync(target)) {
                fs.mkdirSync(LISTS_DIR, { recursive: true });
                const res = await fetch(url);
                if (!res.ok) throw new Error(name + ' -> HTTP ' + res.status);
                fs.writeFileSync(target, await res.text());
                console.log('downloaded: ' + name);
            } else {
                console.log('cache: ' + name);
            }
            rawTexts[listId] += fs.readFileSync(target, 'utf8') + '\n';
        }
    }
    return rawTexts;
}

(async () => {
    let rawTexts;
    try {
        rawTexts = await fetchRawLists();
    } catch (e) {
        console.log('DOWNLOAD WARN: ' + e.message + ' — mevcut cache kullanilamazsa cikis dosyalari korunur.');
        throw e;
    }

    const { lists, cosmetic } = fp.buildLists(rawTexts);
    const totalDomains = Object.values(lists).reduce((a, l) => a + l.length, 0);
    if (totalDomains === 0) {
        console.error('FATAL: hicbir listeden domain elde edilemedi. Mevcut dosyalar korunuyor.');
        process.exit(1);
    }

    // ---- rules.json: base kurallar (chunk kurallarini kaldir) ----
    const rulesPath = path.join(DATA_DIR, 'rules.json');
    let rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const baseRules = rules.filter(r => r.id < 2000000);
    fs.writeFileSync(rulesPath, JSON.stringify(baseRules));

    // ---- filter_lists.json ----
    fs.writeFileSync(path.join(DATA_DIR, 'filter_lists.json'), JSON.stringify(lists));

    // ---- cosmetic_rules.txt ----
    const uniqueCosmetic = [...new Set(cosmetic)];
    fs.writeFileSync(path.join(DATA_DIR, 'cosmetic_rules.txt'), uniqueCosmetic.join('\n'));

    console.log('==============================');
    for (const [k, v] of Object.entries(lists)) console.log('  ' + k + ': ' + v.length + ' domain');
    console.log('Total unique (sum):', totalDomains);
    console.log('Base rules in rules.json:', baseRules.length);
    console.log('rules.json size:', (fs.statSync(rulesPath).size / 1024 / 1024).toFixed(2), 'MB');
    console.log('filter_lists.json size:', (fs.statSync(path.join(DATA_DIR, 'filter_lists.json')).size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Cosmetic rules:', uniqueCosmetic.length);
    console.log('cosmetic_rules.txt size:', (fs.statSync(path.join(DATA_DIR, 'cosmetic_rules.txt')).size / 1024 / 1024).toFixed(2), 'MB');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
