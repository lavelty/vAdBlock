// cosmetic_injector.js — kozmetik kurallari enjekte eder.
// Performans: parse edilmis "generic" seciciler chrome.storage.session'da tumevren (frame) paylasilir;
// host bazli kurallar LRU benzeri cap ile host basina cache'lenir.
const COSMETIC_CACHE_KEY = 'laveCosmeticCache';
const COSMETIC_CACHE_VERSION = chrome.runtime.getManifest().version;

function parseCosmeticList(list, host) {
    const generic = [];
    const hostSels = [];
    const seen = new Set();
    for (let line of list.split('\n')) {
        line = line.trim();
        if (!line.includes('##')) continue;
        const idx = line.indexOf('##');
        const prefix = line.slice(0, idx).trim();
        const sel = line.slice(idx + 2);
        if (!sel || seen.has(sel)) continue;
        if (prefix === '') {
            seen.add(sel);
            generic.push(sel);
            continue;
        }
        const domains = prefix.split(',');
        for (let d of domains) {
            d = d.trim().toLowerCase();
            if (d && (host === d || host.endsWith('.' + d))) {
                seen.add(sel);
                hostSels.push(sel);
                break;
            }
        }
    }
    return { generic, hostSels };
}

async function getCosmeticData(host) {
    let cache = null;
    try {
        const s = await chrome.storage.session.get(COSMETIC_CACHE_KEY);
        cache = s[COSMETIC_CACHE_KEY];
        if (cache && cache.v === COSMETIC_CACHE_VERSION && cache.hosts && cache.hosts[host]) {
            return cache.hosts[host];
        }
    } catch (e) {
        cache = null;
    }

    const list = await fetch(chrome.runtime.getURL('data/cosmetic_rules.txt')).then(r => r.text());
    const data = parseCosmeticList(list, host.toLowerCase());

    if (cache) {
        try {
            let hosts = {};
            if (cache.v === COSMETIC_CACHE_VERSION && cache.hosts) hosts = cache.hosts;
            hosts[host] = data;
            const keys = Object.keys(hosts);
            if (keys.length > 120) {
                for (const k of keys.slice(0, keys.length - 120)) delete hosts[k];
            }
            chrome.storage.session.set({ [COSMETIC_CACHE_KEY]: { v: COSMETIC_CACHE_VERSION, hosts } }).catch(() => {});
        } catch (e) {}
    }
    return data;
}

chrome.storage.local.get({ userRules: [], globalEnabled: true, allowlist: [] }, function (result) {
    if (!result.globalEnabled) return;
    const domain = window.location.hostname.replace(/^www\./, '');
    
    const DEFAULT_ALLOWLIST = [
        'riotgames.com', 'auth.riotgames.com', 'valorant.com', 'leagueoflegends.com', 
        'twitch.tv', 'discord.com', 'github.com', 'microsoft.com', 'live.com', 
        'office.com', 'apple.com', 'icloud.com', 'steampowered.com', 'epicgames.com',
        'mail.google.com', 'spaceship.com'
    ];
    
    if ((result.allowlist || []).includes(domain) || DEFAULT_ALLOWLIST.includes(domain)) return;

    function inject(cssString) {
        if (!cssString || cssString.trim().length === 0) return;
        const style = document.createElement('style');
        style.textContent = cssString;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
    }

    Promise.all([
        fetch(chrome.runtime.getURL('css/cosmetic.css')).then(r => r.text()).catch(() => ''),
        getCosmeticData(domain)
    ]).then(([baseCss, data]) => {
        let cssString = baseCss;
        if (data.generic.length) cssString += '\n' + data.generic.map(s => s + '{display:none!important}').join('\n') + '\n';
        if (data.hostSels.length) cssString += '\n' + data.hostSels.map(s => s + '{display:none!important}').join('\n') + '\n';
        (result.userRules || []).forEach(rule => {
            if (rule.includes('##')) {
                const parts = rule.split('##');
                const ruleDomain = parts[0];
                const selector = parts[1];
                if (ruleDomain === '' || domain.includes(ruleDomain)) {
                    cssString += `${selector} { display: none !important; }\n`;
                }
            }
        });
        inject(cssString);
    }).catch(e => console.log('vAdBlock Cosmetic Error:', e));
});
