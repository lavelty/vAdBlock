// filter_parser.js — liste indirme/parse mantigi (build_rules.js ve background.js tarafindan paylasilir).
// Node icin: require('./filter_parser.js')
// MV3 SW icin: importScripts('filter_parser.js') -> globalThis.vadblockFilterParser
(function (root) {
    'use strict';

    const SOURCES = {
        easylist: ['https://easylist.to/easylist/easylist.txt'],
        easyprivacy: ['https://easylist.to/easylist/easyprivacy.txt'],
        adguard: [
            'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt',
            'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/SpywareFilter/sections/tracking_servers.txt'
        ],
        ubo: [
            'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
            'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt'
        ]
    };

    const BLOCK_RE = /^\|\|([a-z0-9.*-]+)\^/i;
    const EXCEPT_RE = /^@@\|\|([a-z0-9.*-]+)\^/i;

    // Asla toptan bloklanmaması gereken işlevsel altyapı alanları.
    const PROTECTED_DOMAINS = new Set([
        'google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com',
        'youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'googlevideo.com',
        'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'cloudflare.com', 'cloudfront.net',
        'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'wikipedia.org',
        'github.com', 'microsoft.com', 'apple.com', 'amazon.com'
    ]);

    function cleanDomain(d) {
        d = d.toLowerCase().trim();
        if (d.startsWith('*.')) d = d.slice(2);
        if (d.includes('*') || d.includes('/') || d.includes(' ') || !d.includes('.')) return null;
        if (/[^a-z0-9.-]/.test(d)) return null;
        return d;
    }

    function parseList(text, blockSet, exceptSet, cosmeticArr) {
        for (let line of text.split(/\r?\n/)) {
            line = line.trim();
            if (!line || line.startsWith('!') || line.startsWith('[')) continue;
            if (line.startsWith('@@')) {
                const m = line.match(EXCEPT_RE);
                if (m) { const d = cleanDomain(m[1]); if (d) exceptSet.add(d); }
                continue;
            }
            if (line.startsWith('||')) {
                const m = line.match(BLOCK_RE);
                if (m) { const d = cleanDomain(m[1]); if (d) blockSet.add(d); }
                continue;
            }
            if (line.includes('##')) {
                if (line.includes('#?#') || line.includes('#@#') || line.includes('#$#') || line.includes('#%#')) continue;
                const idx = line.indexOf('##');
                const sel = line.slice(idx + 2);
                if (!sel || sel.startsWith('+js(')) continue;
                if (/:(has-text|matches-path|xpath|upward|watch-attr|contains|matches-css|matches-attr|matches-prop)/i.test(sel)) continue;
                if (/:-abp-/.test(sel)) continue;
                const prefix = line.slice(0, idx).trim();
                if (prefix.includes('[') || prefix.includes('#')) continue;
                if (cosmeticArr) cosmeticArr.push(prefix + '##' + sel);
            }
        }
    }

    // Raw liste metinlerinden per-list domain setleri cikarir.
    // returns: { lists: { easylist: [...], easyprivacy: [...], adguard: [...], ubo: [...] }, cosmetic: [...] }
    function buildLists(rawTexts) {
        const perList = {};
        const globalExcept = new Set();
        const cosmetic = [];
        for (const listId of Object.keys(SOURCES)) {
            const blockSet = new Set();
            const exceptSet = new Set();
            parseList(rawTexts[listId] || '', blockSet, exceptSet, cosmetic);
            perList[listId] = blockSet;
            for (const d of exceptSet) globalExcept.add(d);
        }
        const lists = {};
        for (const listId of Object.keys(perList)) {
            lists[listId] = [...perList[listId]].filter(d => !globalExcept.has(d) && !PROTECTED_DOMAINS.has(d)).sort();
        }
        return { lists, cosmetic };
    }

    const api = { SOURCES, cleanDomain, parseList, buildLists };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.vadblockFilterParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
