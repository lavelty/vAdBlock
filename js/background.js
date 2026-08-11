// background.js — vAdBlock service worker
importScripts('filter_parser.js');

// Kozmetik enjektörü (content script) chrome.storage.session kullanabilmeli.
if (chrome.storage && chrome.storage.session && chrome.storage.session.setAccessLevel) {
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});
}

// Asla toptan bloklanmaması gereken işlevsel altyapı alanları (geniş liste kurallarını etkisiz kılar).
const PROTECTED_DOMAINS_LIST = [
    'google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com',
    'youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'googlevideo.com',
    'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'cloudflare.com', 'cloudfront.net',
    'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'wikipedia.org',
    'github.com', 'microsoft.com', 'apple.com', 'amazon.com',
    'riotgames.com', 'valorant.com', 'twitch.tv', 'auth.riotgames.com'
];
function isProtectedDomain(d) {
    return PROTECTED_DOMAINS_LIST.some(pd => d === pd || d.endsWith('.' + pd));
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.tabs.create({ url: "html/welcome.html" });
    }
    
    // Create Context Menu for Zapper
    chrome.contextMenus.create({
        id: "lave-zapper-context",
        title: "vAdBlock ile Öğeyi Engelle",
        contexts: ["all"]
    });

    syncAllowlistRules();
    syncProtectionState();
    syncFilterRules();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lave-zapper-context" && tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'START_PICKER' }).catch(() => {});
    }
});

// Protect WebRTC leaks
function syncWebRTC(enabled) {
    chrome.storage.local.get({ settings: {} }, (r) => {
        const webrtcBlock = (r.settings || {}).webrtcBlock;
        if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
            chrome.privacy.network.webRTCIPHandlingPolicy.set({
                value: (enabled && webrtcBlock) ? "disable_non_proxied_udp" : "default"
            }).catch(() => {});
        }
    });
}

// HTTP isteklerini HTTPS'e yukselt (settings.httpsUpgrade acikken).
function syncHttpsUpgrade() {
    if (!chrome.declarativeNetRequest) return;
    chrome.storage.local.get({ settings: {}, globalEnabled: true }, (r) => {
        const enabled = r.globalEnabled && (r.settings || {}).httpsUpgrade;
        chrome.declarativeNetRequest.getDynamicRules((existing) => {
            const toRemove = existing.filter(r => r.id >= 7000000 && r.id < 8000000).map(r => r.id);
            const addRules = enabled ? [{
                id: 7000000,
                priority: 1,
                action: { type: 'upgradeScheme' },
                condition: {
                    urlFilter: 'http://',
                    excludedRequestDomains: ['localhost', '127.0.0.1', '::1', '0.0.0.0', '*.local'],
                    resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'xmlhttprequest', 'media', 'font', 'other']
                }
            }] : [];
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules }).catch(() => {});
        });
    });
}

let pageBlocked = {};

const COLOR_ICON = {
    16: chrome.runtime.getURL('icons/icon16.png'),
    32: chrome.runtime.getURL('icons/icon32.png'),
    48: chrome.runtime.getURL('icons/icon48.png'),
    128: chrome.runtime.getURL('icons/icon128.png')
};

chrome.tabs.onRemoved.addListener((tabId) => {
    delete pageBlocked[tabId];
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        pageBlocked[tabId] = 0;
    }
});
chrome.tabs.onActivated.addListener(() => updateBadge());

// --- ID aralik plani ---
// STATIK (rules.json):
//   1..999999        : mevcut statik kurallar
//   1000000..1000041 : el ile eklenen kurallar
// DINAMIK:
//   500000..599999   : koruma seviyesi allow kurallari (updateProtectionRules)
//   1000000..1999999 : allowlist allowAllRequests (hashDomain)
//   3000000..3039999 : filtre listesi chunk blok kurallari (liste bazli)
//   4000000..4099999 : kullanici network blok kurallari
//   4100000..4199999 : kullanici network allow kurallari
function hashDomain(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        let char = domain.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return (Math.abs(hash) % 1000000) + 1000000;
}

// Siteye ozel gecici kapatma kurallari icin ayri ID araligi (2000000..2999999).
function hashTempDomain(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        hash = ((hash << 5) - hash + domain.charCodeAt(i)) & hash;
    }
    return (Math.abs(hash) % 1000000) + 2000000;
}

let tempSiteUntil = {};

function persistTempSites() {
    chrome.storage.local.set({ tempSiteUntil });
}

function scheduleTempSiteTimers() {
    const now = Date.now();
    let earliest = Infinity;
    for (const d of Object.keys(tempSiteUntil)) {
        if (tempSiteUntil[d] < earliest) earliest = tempSiteUntil[d];
    }
    if (earliest === Infinity) return;
    setTimeout(() => syncTempSiteRules(), Math.min(earliest - now, 2147483647));
}

function syncTempSiteRules() {
    if (!chrome.declarativeNetRequest) return;
    const now = Date.now();
    let changed = false;
    for (const d of Object.keys(tempSiteUntil)) {
        if (tempSiteUntil[d] <= now) {
            delete tempSiteUntil[d];
            changed = true;
        }
    }
    if (changed) persistTempSites();
    const active = Object.keys(tempSiteUntil);
    const addRules = active.map(d => ({
        id: hashTempDomain(d),
        priority: 99999,
        action: { type: 'allowAllRequests' },
        condition: { initiatorDomains: [d], resourceTypes: ['main_frame', 'sub_frame'] }
    }));
    chrome.declarativeNetRequest.getDynamicRules((existing) => {
        const toRemove = existing.filter(r => r.id >= 2000000 && r.id < 3000000).map(r => r.id);
        chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules }).catch(() => {});
    });
    scheduleTempSiteTimers();
}

function loadTempSites() {
    chrome.storage.local.get({ tempSiteUntil: {} }, (r) => {
        tempSiteUntil = r.tempSiteUntil || {};
        syncTempSiteRules();
    });
}

const FILTER_RANGES = {
    easylist: 3000000,
    easyprivacy: 3010000,
    adguard: 3020000,
    ubo: 3030000
};

function chunkArray(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
}

// Kullanici network kuralindan domain cikarir. Kabul edilen formatlar:
//   ||ornek.com^   |   @@||ornek.com^   |   ornek.com
function userRuleDomain(line) {
    line = line.trim().toLowerCase();
    if (line.startsWith('@@')) line = line.slice(2);
    let m = line.match(/^\|\|([a-z0-9.*-]+)\^?$/i);
    if (m) {
        let d = m[1];
        if (d.startsWith('*.')) d = d.slice(2);
        if (/^[a-z0-9.-]+$/.test(d) && d.includes('.')) return d;
        return null;
    }
    m = line.match(/^([a-z0-9.-]+\.[a-z]{2,})$/i);
    if (m) return m[1];
    return null;
}

async function getFilterListData() {
    const r = await chrome.storage.local.get({ laveFilterLists: null });
    if (r.laveFilterLists) return r.laveFilterLists;
    try {
        const res = await fetch(chrome.runtime.getURL('data/filter_lists.json'));
        if (res.ok) return await res.json();
    } catch (e) {
        console.log('filter_lists.json load error:', e);
    }
    return null;
}

// Filtre listelerini + kullanici network kurallarini DINAMIK kural olarak senkronlar.
// Cagrilar sirali yurutulur (concurrent updateDynamicRules yarisini onlemek icin).
let filterSyncChain = Promise.resolve();

function syncFilterRules() {
    filterSyncChain = filterSyncChain.then(() => doSyncFilterRules()).catch(e => console.log('syncFilterRules error:', e));
    return filterSyncChain;
}

async function doSyncFilterRules() {
    if (!chrome.declarativeNetRequest) return;
    const r = await chrome.storage.local.get({ globalEnabled: true, settings: {} });
    const enabled = r.globalEnabled;
    const settings = r.settings || {};
    const filterLists = settings.filterLists || {};
    const userNetworkRules = Array.isArray(settings.userNetworkRules) ? settings.userNetworkRules : [];

    const addRules = [];
    const counts = {};

    if (enabled) {
        const data = await getFilterListData();
        if (data) {
            for (const [listId, base] of Object.entries(FILTER_RANGES)) {
                const domains = (data[listId] || []).filter(d => !isProtectedDomain(d));
                counts[listId] = domains.length;
                if (!domains.length) continue;
                if (filterLists[listId] === false) continue;
                let rid = base;
                for (const chunk of chunkArray(domains, 1000)) {
                    addRules.push({
                        id: rid++,
                        priority: 1,
                        action: { type: 'block' },
                        condition: { requestDomains: chunk, excludedResourceTypes: ['main_frame'], domainType: 'thirdParty' }
                    });
                }
            }
        }

        let bid = 4000000;
        for (const line of userNetworkRules) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const isAllow = trimmed.startsWith('@@');
            const domain = userRuleDomain(trimmed);
            if (!domain) continue;
            if (isAllow) {
                addRules.push({
                    id: 4100000 + (bid - 4000000),
                    priority: 99999,
                    action: { type: 'allowAllRequests' },
                    condition: { initiatorDomains: [domain], resourceTypes: ['main_frame', 'sub_frame'] }
                });
            } else {
                addRules.push({
                    id: bid,
                    priority: 1,
                    action: { type: 'block' },
                    condition: { requestDomains: [domain], excludedResourceTypes: ['main_frame'] }
                });
            }
            bid++;
        }
    }

    try {
        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        const toRemove = existing.filter(rule => rule.id >= 3000000 && rule.id < 4200000).map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules: [] });
        for (let i = 0; i < addRules.length; i += 500) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [],
                addRules: addRules.slice(i, i + 500)
            });
        }

        if (Object.keys(counts).length > 0) {
            chrome.storage.local.set({ laveFilterCounts: counts });
        }
    } catch (e) {
        console.log('syncFilterRules error:', e);
    }
}

// Filtre listelerini internetten guncelleyip dinamik kurallari yeniden kurar.
async function updateFilters() {
    if (!chrome.runtime.getManifest) return { lists: [] };
    const raw = {};
    for (const [listId, urls] of Object.entries(vadblockFilterParser.SOURCES)) {
        raw[listId] = '';
        for (const url of urls) {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(listId + ' -> HTTP ' + res.status);
            raw[listId] += await res.text() + '\n';
        }
    }
    const { lists } = vadblockFilterParser.buildLists(raw);
    await chrome.storage.local.set({ laveFilterLists: lists, laveFiltersUpdatedAt: Date.now() });
    await syncFilterRules();
    const summary = {};
    for (const [k, v] of Object.entries(lists)) summary[k] = v.length;
    return { lists: summary };
}

const FILTER_AUTO_UPDATE_MS = 7 * 24 * 60 * 60 * 1000;

function checkAutoFilterUpdate() {
    chrome.storage.local.get({ laveFiltersUpdatedAt: 0, globalEnabled: true }, (r) => {
        if (!r.globalEnabled) return;
        if (!r.laveFiltersUpdatedAt || Date.now() - r.laveFiltersUpdatedAt > FILTER_AUTO_UPDATE_MS) {
            updateFilters().catch(() => {});
        }
    });
}

if (chrome.alarms) {
    chrome.alarms.create('autoUpdateFilters', { periodInMinutes: 7 * 24 * 60 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'autoUpdateFilters') {
            chrome.storage.local.get({ globalEnabled: true }, (r) => {
                if (r.globalEnabled) updateFilters().catch(() => {});
            });
        }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_PROTECTION') {
        applyProtectionState(message.enabled);
        if (message.enabled) chrome.storage.local.remove('pauseUntil');
        sendResponse({ success: true });
    } else if (message.type === 'TOGGLE_SITE') {
        if (!chrome.declarativeNetRequest) return;
        const ruleId = hashDomain(message.domain);
        if (message.enabled) {
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [ruleId]
            }).catch(e => console.log(e));
        } else {
            chrome.declarativeNetRequest.updateDynamicRules({
                addRules: [{
                    id: ruleId,
                    priority: 99999,
                    action: { type: "allowAllRequests" },
                    condition: {
                        initiatorDomains: [message.domain],
                        resourceTypes: ["main_frame", "sub_frame"]
                    }
                }],
                removeRuleIds: [ruleId]
            }).catch(e => console.log(e));
        }
    } else if (message.type === 'TOGGLE_SITE_TEMP') {
        const domain = message.domain;
        const minutes = parseInt(message.minutes, 10);
        if (minutes > 0) {
            tempSiteUntil[domain] = Date.now() + minutes * 60000;
        } else {
            delete tempSiteUntil[domain];
        }
        persistTempSites();
        syncTempSiteRules();
        sendResponse({ success: true, until: tempSiteUntil[domain] || 0 });
    } else if (message.type === 'GET_TEMP_SITE_STATUS') {
        sendResponse(tempSiteUntil[message.domain] || 0);
    } else if (message.type === 'UPDATE_FILTERS') {
        updateFilters()
            .then((res) => sendResponse({ success: true, lists: res.lists }))
            .catch((e) => sendResponse({ success: false, error: e.message }));
        return true;
    } else if (message.type === 'GET_FILTER_STATUS') {
        chrome.storage.local.get({ laveFilterCounts: {}, laveFiltersUpdatedAt: 0, settings: {} }, (r) => {
            const enabledMap = (r.settings || {}).filterLists || {};
            sendResponse({ counts: r.laveFilterCounts, updatedAt: r.laveFiltersUpdatedAt, enabledMap });
        });
        return true;
    } else if (message.type === 'GET_LOG') {
        sendResponse(blockLog);
    } else if (message.type === 'CLEAR_LOG') {
        blockLog = [];
        sendResponse({ success: true });
    } else if (message.type === 'GET_STATS') {
        sendResponse(stats);
        return true;
    } else if (message.type === 'GET_PAGE_STATS') {
        sendResponse(pageBlocked[message.tabId] || 0);
        return true;
    } else if (message.type === 'GET_MESSAGES') {
        const lang = message.lang;
        if (!lang || !/^[a-z]{2}(_[A-Z]{2})?$/.test(lang)) { sendResponse(null); return; }
        fetch(chrome.runtime.getURL('_locales/' + lang + '/messages.json'))
            .then((r) => r.json())
            .then((json) => sendResponse(json))
            .catch(() => sendResponse(null));
        return true;
    }
});

function syncAllowlistRules() {
    chrome.storage.local.get({ allowlist: [], settings: {} }, (r) => {
        if (!chrome.declarativeNetRequest) return;

        updateContextMenu(r.settings.showContextMenu !== false);

        chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
            const rulesToRemove = existingRules.filter(rule => rule.id >= 1000000 && rule.id < 2000000).map(r => r.id);
            
            // Kullanıcıların sıkça sorun yaşadığı kritik siteleri otomatik olarak beyaz listeye ekle
            const DEFAULT_ALLOWLIST = [
                'riotgames.com', 'auth.riotgames.com', 'valorant.com', 'leagueoflegends.com', 
                'twitch.tv', 'discord.com', 'github.com', 'microsoft.com', 'live.com', 
                'office.com', 'apple.com', 'icloud.com', 'steampowered.com', 'epicgames.com',
                'mail.google.com', 'spaceship.com', 'natro.com'
            ];
            
            const combinedAllowlist = [...new Set([...(r.allowlist || []), ...DEFAULT_ALLOWLIST])];

            const rulesToAdd = combinedAllowlist.map(domain => ({
                id: hashDomain(domain),
                priority: 99999,
                action: { type: "allowAllRequests" },
                condition: {
                    initiatorDomains: [domain],
                    resourceTypes: ["main_frame", "sub_frame"]
                }
            }));

            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: rulesToRemove,
                addRules: rulesToAdd
            }).catch(e => console.log(e));
        });
    });
}

// --- Rozet ---
function compactNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function updateBadge() {
    chrome.storage.local.get({ globalEnabled: true, settings: {} }, (r) => {
        const showCount = (r.settings || {}).showBadgeCount !== false;
        if (!r.globalEnabled) {
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setBadgeBackgroundColor({ color: '#94A3B8' });
            return;
        }
        chrome.action.setIcon({ path: COLOR_ICON });
        if (showCount) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0] && tabs[0].id;
                const count = (tabId && pageBlocked[tabId]) ? pageBlocked[tabId] : 0;
                if (count > 0) {
                    chrome.action.setBadgeText({ text: compactNumber(count) });
                    chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
                } else {
                    chrome.action.setBadgeText({ text: '' });
                }
            });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    });
}

function applyProtectionState(enabled) {
    if (chrome.declarativeNetRequest) {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: enabled ? ["ruleset_1"] : [],
            disableRulesetIds: enabled ? [] : ["ruleset_1"]
        }).catch(e => console.log(e));
    }

    updateBadge();
    updateDynamicScripts();
    syncFilterRules();
    syncWebRTC(enabled);
}

function syncProtectionState() {
    chrome.storage.local.get({ globalEnabled: true, pauseUntil: 0 }, (r) => {
        let enabled = r.globalEnabled;
        if (r.pauseUntil && Date.now() >= r.pauseUntil) {
            enabled = true;
            chrome.storage.local.set({ globalEnabled: true }, () => {
                chrome.storage.local.remove('pauseUntil');
            });
        }
        applyProtectionState(enabled);
    });
}

// --- Duraklatma (pause) ---
function schedulePauseResume(until) {
    const wait = until - Date.now();
    if (wait <= 0) return;
    setTimeout(() => {
        chrome.storage.local.get({ globalEnabled: false }, (r) => {
            if (!r.globalEnabled) checkPause();
        });
    }, Math.min(wait, 2147483647));
}

function checkPause() {
    chrome.storage.local.get({ pauseUntil: 0 }, (r) => {
        if (!r.pauseUntil) return;
        if (Date.now() >= r.pauseUntil) {
            chrome.storage.local.get({ globalEnabled: false }, (s) => {
                if (!s.globalEnabled) {
                    chrome.storage.local.set({ globalEnabled: true }, () => {
                        chrome.storage.local.remove('pauseUntil');
                        syncProtectionState();
                    });
                }
            });
        } else {
            schedulePauseResume(r.pauseUntil);
        }
    });
}

chrome.runtime.onStartup.addListener(() => {
    syncAllowlistRules();
    syncProtectionState();
    syncFilterRules();
    syncHttpsUpgrade();
    checkAutoFilterUpdate();
});
syncAllowlistRules();
syncProtectionState();
syncFilterRules();
syncHttpsUpgrade();
checkAutoFilterUpdate();
checkPause();

// --- chrome.storage.sync ile ayar senkronizasyonu ---
const SYNC_KEYS = ['settings', 'protectionLevel', 'theme', 'allowlist', 'userRules'];

function pullSyncSettings() {
    chrome.storage.sync.get(SYNC_KEYS, (r) => {
        const toLocal = {};
        for (const key of SYNC_KEYS) {
            if (r[key] !== undefined) toLocal[key] = r[key];
        }
        if (Object.keys(toLocal).length > 0) {
            chrome.storage.local.set(toLocal, () => {
                if (toLocal.allowlist) syncAllowlistRules();
                if (toLocal.settings) {
                    syncFilterRules();
                    syncHttpsUpgrade();
                    chrome.storage.local.get({ globalEnabled: true }, (s) => syncWebRTC(s.globalEnabled));
                }
            });
        }
    });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        const toLocal = {};
        for (const key of SYNC_KEYS) {
            if (changes[key] && changes[key].newValue !== undefined) toLocal[key] = changes[key].newValue;
        }
        if (Object.keys(toLocal).length > 0) {
            chrome.storage.local.set(toLocal, () => {
                if (toLocal.allowlist) syncAllowlistRules();
                if (toLocal.settings) {
                    syncFilterRules();
                    syncHttpsUpgrade();
                    chrome.storage.local.get({ globalEnabled: true }, (s) => syncWebRTC(s.globalEnabled));
                }
            });
        }
    }
});
pullSyncSettings();
loadTempSites();

// Context Menu Logic
function bgGetMessage(key, fallback) {
    return new Promise((resolve) => {
        chrome.storage.local.get({ vadblockLang: 'auto' }, (r) => {
            const sel = r.vadblockLang || 'auto';
            const target = sel === 'auto'
                ? ((chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : '') || 'tr').slice(0, 2)
                : sel;
            fetch(chrome.runtime.getURL('_locales/' + target + '/messages.json'))
                .then((res) => res.json())
                .then((json) => {
                    resolve((json[key] && json[key].message) || fallback);
                })
                .catch(() => resolve(fallback));
        });
    });
}

function updateContextMenu(show) {
    if (chrome.contextMenus) {
        chrome.contextMenus.removeAll(() => {
            if (show) {
                bgGetMessage('ctx_block_element', 'vAdBlock ile bu öğeyi engelle').then((title) => {
                    chrome.contextMenus.create({
                        id: "vadblock_block_element",
                        title: title,
                        contexts: ["all"]
                    }, () => { let err = chrome.runtime.lastError; });
                });
            }
        });
    }
}

chrome.contextMenus && chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "vadblock_block_element" && tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "START_PICKER" }).catch(() => {});
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.settings) {
            const oldSettings = changes.settings.oldValue || {};
            const newSettings = changes.settings.newValue || {};
            if (oldSettings.showContextMenu !== newSettings.showContextMenu) {
                updateContextMenu(newSettings.showContextMenu !== false);
            }
            if (oldSettings.webrtcBlock !== newSettings.webrtcBlock) {
                chrome.storage.local.get({ globalEnabled: true }, (r) => syncWebRTC(r.globalEnabled));
            }
            syncHttpsUpgrade();
            updateBadge();
        }
        if (changes.protectionLevel || changes.settings || changes.globalEnabled) {
            updateDynamicScripts();
            if (changes.globalEnabled) syncProtectionState();
        }
        if (changes.settings) syncFilterRules();
        if (changes.pauseUntil) checkPause();
    }
    if (changes.vadblockLang) {
        chrome.storage.local.get({ settings: {} }, (r) => {
            updateContextMenu((r.settings || {}).showContextMenu !== false);
        });
    }
});

// Protection Rules Logic
function updateProtectionRules(level) {
    if (!chrome.declarativeNetRequest) return;

    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        const rulesToRemove = existingRules.filter(r => r.id >= 500000 && r.id < 600000).map(r => r.id);
        const rulesToAdd = [];

        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: rulesToRemove,
            addRules: rulesToAdd
        }).catch(e => console.log(e));
    });
}

// Dynamic Content Scripts Logic
async function updateDynamicScripts() {
    if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;

    try {
        const existing = await chrome.scripting.getRegisteredContentScripts();
        const ids = existing.map(s => s.id);
        if (ids.length > 0) {
            await chrome.scripting.unregisterContentScripts({ ids });
        }

        const r = await chrome.storage.local.get({ settings: {}, protectionLevel: 'balanced', globalEnabled: true });

        if (!r.globalEnabled) return;

        const scripts = [];

        updateProtectionRules(r.protectionLevel);

        if (r.protectionLevel === 'strict') {
            scripts.push({
                id: 'strict_protection_main',
                matches: ["<all_urls>"],
                excludeMatches: ["*://*.aternos.org/*", "*://aternos.org/*", "*://mail.google.com/*", "*://*.spaceship.com/*", "*://spaceship.com/*"],
                js: ["js/inject.js", "data/scriptlets.js", "js/scriptlet_injector.js"],
                runAt: "document_start",
                world: "MAIN",
                allFrames: true,
                matchOriginAsFallback: true
            });
        }

        if (r.settings.premiumCookieBlocker) {
            scripts.push({
                id: 'premium_cookie_blocker',
                matches: ["<all_urls>"],
                excludeMatches: ["*://mail.google.com/*", "*://*.spaceship.com/*", "*://spaceship.com/*"],
                css: ["css/premium_cookie.css"],
                runAt: "document_start",
                allFrames: true
            });
        }

        if (r.settings.cookieAutoClick) {
            scripts.push({
                id: 'cookie_auto_click',
                matches: ["<all_urls>"],
                excludeMatches: ["*://mail.google.com/*", "*://*.spaceship.com/*", "*://spaceship.com/*"],
                js: ["js/cookie_auto.js"],
                runAt: "document_idle",
                allFrames: false
            });
        }

        if (r.settings.premiumFocusMode) {
            scripts.push({
                id: 'premium_focus_mode',
                matches: ["<all_urls>"],
                excludeMatches: ["*://mail.google.com/*", "*://*.spaceship.com/*", "*://spaceship.com/*"],
                css: ["css/premium_focus.css"],
                runAt: "document_start",
                allFrames: true
            });
        }

        if (r.settings.fingerprintBlocking) {
            scripts.push({
                id: 'fingerprint_blocker',
                matches: ["<all_urls>"],
                excludeMatches: ["*://mail.google.com/*", "*://*.spaceship.com/*", "*://spaceship.com/*"],
                js: ["js/fingerprint.js"],
                runAt: "document_start",
                allFrames: true,
                world: "MAIN"
            });
        }

        if (r.settings.antiAdblockHide !== false) {
            scripts.push({
                id: 'anti_adblock_hide',
                matches: ["<all_urls>"],
                css: ["css/anti_adblock.css"],
                excludeMatches: ["*://mail.google.com/*", "*://*.spaceship.com/*", "*://spaceship.com/*"],
                js: ["js/anti_adblock.js"],
                runAt: "document_idle",
                allFrames: true
            });
        }

        if (scripts.length > 0) {
            await chrome.scripting.registerContentScripts(scripts);
        }
    } catch (e) {
        console.log("Error updating dynamic scripts:", e);
    }
}

function makeZeros(n) { return new Array(n).fill(0); }
function makeBucket(n) { return { total: makeZeros(n), ads: makeZeros(n), trackers: makeZeros(n), cdn: makeZeros(n), other: makeZeros(n) }; }

let stats = {
    ads: 0, trackers: 0, cdn: 0, other: 0, total: 0,
    history: {
        total: [0, 0, 0, 0, 0, 0, 0],
        ads: [0, 0, 0, 0, 0, 0, 0],
        trackers: [0, 0, 0, 0, 0, 0, 0],
        cdn: [0, 0, 0, 0, 0, 0, 0],
        other: [0, 0, 0, 0, 0, 0, 0]
    },
    hourly: makeBucket(24),
    monthly: makeBucket(30),
    yearly: makeBucket(12),
    topDomains: [],
    lastDate: new Date().toLocaleDateString(),
    lastHour: new Date().getHours(),
    lastMonth: new Date().getMonth()
};
let statsChanged = false;

chrome.storage.local.get(['laveStats'], (result) => {
    if (result.laveStats) {
        if (!result.laveStats.history.total) {
            let oldArr = result.laveStats.history || [0,0,0,0,0,0,0];
            result.laveStats.history = {
                total: oldArr,
                ads: [0,0,0,0,0,0,0],
                trackers: [0,0,0,0,0,0,0],
                cdn: [0,0,0,0,0,0,0],
                other: [0,0,0,0,0,0,0]
            };
        }
        if (!result.laveStats.hourly) result.laveStats.hourly = makeBucket(24);
        if (!result.laveStats.monthly) result.laveStats.monthly = makeBucket(30);
        if (!result.laveStats.yearly) result.laveStats.yearly = makeBucket(12);
        if (!result.laveStats.topDomains) result.laveStats.topDomains = [];
        if (result.laveStats.lastHour === undefined) result.laveStats.lastHour = new Date().getHours();
        if (result.laveStats.lastMonth === undefined) result.laveStats.lastMonth = new Date().getMonth();
        Object.assign(stats, result.laveStats);

        let now = new Date();
        let today = now.toLocaleDateString();
        let currentHour = now.getHours();
        let currentMonth = now.getMonth();

        if (stats.lastHour !== currentHour) {
            let hourDiff = (currentHour - stats.lastHour + 24) % 24;
            hourDiff = Math.min(hourDiff, 24);
            for (let h = 0; h < hourDiff; h++) {
                for (let k in stats.hourly) {
                    stats.hourly[k].shift();
                    stats.hourly[k].push(0);
                }
            }
            stats.lastHour = currentHour;
        }

        if (stats.lastDate !== today) {
            for (let k in stats.history) {
                stats.history[k].shift();
                stats.history[k].push(0);
            }
            for (let k in stats.monthly) {
                stats.monthly[k].shift();
                stats.monthly[k].push(0);
            }
            stats.lastDate = today;
        }

        if (stats.lastMonth !== currentMonth) {
            let monthDiff = (currentMonth - stats.lastMonth + 12) % 12;
            monthDiff = Math.min(monthDiff, 12);
            for (let m = 0; m < monthDiff; m++) {
                for (let k in stats.yearly) {
                    stats.yearly[k].shift();
                    stats.yearly[k].push(0);
                }
            }
            stats.lastMonth = currentMonth;
        }

        chrome.storage.local.set({ laveStats: stats });
    }
});

setInterval(() => {
    if (statsChanged) {
        chrome.storage.local.set({ laveStats: stats });
        updateBadge();
        statsChanged = false;
    }
}, 2000);

// --- Block log ---
let blockLog = [];
const BLOCK_LOG_MAX = 50;

function pushBlockLog(info) {
    let url = info.request.url || '';
    let host = url;
    try { host = new URL(url).hostname; } catch (e) { host = url.split('/')[2] || url; }
    blockLog.push({
        t: Date.now(),
        host,
        url: url.length > 160 ? url.slice(0, 160) : url,
        tabId: info.request.tabId
    });
    if (blockLog.length > BLOCK_LOG_MAX) blockLog.splice(0, blockLog.length - BLOCK_LOG_MAX);
    return host;
}

function bumpTopDomain(host) {
    const list = stats.topDomains || (stats.topDomains = []);
    const entry = list.find(e => e.host === host);
    if (entry) {
        entry.count++;
    } else {
        list.push({ host, count: 1 });
    }
    if (list.length > 50) {
        list.sort((a, b) => b.count - a.count);
        list.length = 50;
    }
}

if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
    let badgeThrottle = 0;
    function updateBadgeThrottled() {
        const now = Date.now();
        if (now - badgeThrottle < 200) return;
        badgeThrottle = now;
        updateBadge();
    }

    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        let url = info.request.url.toLowerCase();
        let tabId = info.request.tabId;

        stats.total++;
        const host = pushBlockLog(info);
        bumpTopDomain(host);
        if (tabId && tabId !== -1) {
            if (!pageBlocked[tabId]) pageBlocked[tabId] = 0;
            pageBlocked[tabId]++;
        }

        let now = new Date();
        let today = now.toLocaleDateString();
        let currentHour = now.getHours();
        let currentMonth = now.getMonth();

        if (stats.lastHour !== currentHour) {
            let hourDiff = (currentHour - stats.lastHour + 24) % 24;
            hourDiff = Math.min(hourDiff, 24);
            for (let h = 0; h < hourDiff; h++) {
                for (let k in stats.hourly) {
                    stats.hourly[k].shift();
                    stats.hourly[k].push(0);
                }
            }
            stats.lastHour = currentHour;
        }

        if (stats.lastDate !== today) {
            for (let k in stats.history) {
                stats.history[k].shift();
                stats.history[k].push(0);
            }
            for (let k in stats.monthly) {
                stats.monthly[k].shift();
                stats.monthly[k].push(0);
            }
            stats.lastDate = today;
        }

        if (stats.lastMonth !== currentMonth) {
            let monthDiff = (currentMonth - stats.lastMonth + 12) % 12;
            monthDiff = Math.min(monthDiff, 12);
            for (let m = 0; m < monthDiff; m++) {
                for (let k in stats.yearly) {
                    stats.yearly[k].shift();
                    stats.yearly[k].push(0);
                }
            }
            stats.lastMonth = currentMonth;
        }

        stats.history.total[6]++;
        stats.hourly.total[23]++;
        stats.monthly.total[29]++;
        stats.yearly.total[11]++;

        let category;
        if (url.includes('track') || url.includes('analytics') || url.includes('pixel') || url.includes('mixpanel') || url.includes('telemetry')) {
            category = 'trackers';
        } else if (url.includes('cdn.') || url.includes('cloudfront') || url.includes('akamai') || url.includes('fastly')) {
            category = 'cdn';
        } else if (url.includes('ad') || url.includes('banner') || url.includes('doubleclick') || url.includes('sponsor')) {
            category = 'ads';
        } else {
            category = 'other';
        }

        stats[category]++;
        stats.history[category][6]++;
        stats.hourly[category][23]++;
        stats.monthly[category][29]++;
        stats.yearly[category][11]++;

        statsChanged = true;
        chrome.runtime.sendMessage({ type: 'STATS_UPDATE', stats: stats }).catch(() => {});
        updateBadgeThrottled();
    });
}

// --- Klavye kisa yollari ---
chrome.commands && chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-protection') {
        const r = await chrome.storage.local.get({ globalEnabled: true });
        const next = !r.globalEnabled;
        await chrome.storage.local.set({ globalEnabled: next });
        if (next) chrome.storage.local.remove('pauseUntil');
    } else if (command === 'open-picker') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'START_PICKER' });
            } catch (e) {
                try {
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['js/picker.js'] });
                    chrome.tabs.sendMessage(tab.id, { action: 'START_PICKER' }).catch(() => {});
                } catch (e2) {
                    console.log('picker on command failed:', e2);
                }
            }
        }
    }
});


// Promo Notification Badge Logic
chrome.alarms.create('checkPromo', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkPromo') {
        chrome.storage.local.get({ settings: {}, promo_discount_shown: false, installTime: Date.now() }, (res) => {
            if (res.settings.promoMessages === false) return;
            
            // Generate badge randomly (30% chance every hour)
            if (Math.random() > 0.3) return;
            
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
        });
    }
});
