/* i18n.js — Dil destegi.
   - vadblockLang: 'auto' | 'tr' | 'en' (storage.local)
   - vAdBlockT(key, subs): ceviriyi dondurur
   - vAdBlockApply(root): [data-i18n] ve [data-i18n-placeholder] oyelerini uygular
   - vAdBlockRefresh(): secili dile gore hepsini yeniden uygular
   Duyurulan API'ler window uzerinde sunulur.
*/
(function () {
    let overrideMessages = null;

    function substitute(msg, subs) {
        if (!subs) return msg;
        let out = msg;
        if (Array.isArray(subs)) {
            subs.forEach((v, i) => { out = out.replace(new RegExp('\\$' + (i + 1) + '\\b', 'g'), String(v)); });
        } else if (typeof subs === 'object') {
            for (const [k, v] of Object.entries(subs)) {
                out = out.replace(new RegExp('\\$' + k + '\\$', 'g'), String(v));
            }
        }
        return out;
    }

    function getMessage(key, subs) {
        let msg = null;
        if (overrideMessages && overrideMessages[key]) msg = overrideMessages[key].message;
        if (msg == null) {
            try { msg = chrome.i18n.getMessage(key, subs); } catch (e) { msg = null; }
        }
        if (msg == null || msg === '') return null;
        return substitute(msg, subs);
    }

    function apply(root) {
        root = root || document;
        if (!root) return;
        const scope = root.nodeType === 1 ? root : root.documentElement || document;
        scope.querySelectorAll('[data-i18n]').forEach((el) => {
            const msg = getMessage(el.dataset.i18n);
            if (msg == null) return;
            if (el.children.length === 0) {
                el.textContent = msg;
                return;
            }
            let replaced = false;
            el.childNodes.forEach((node) => {
                if (replaced) return;
                if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                    node.textContent = msg;
                    replaced = true;
                }
            });
            if (!replaced) el.textContent = msg;
        });
        scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const msg = getMessage(el.dataset.i18nPlaceholder);
            if (msg != null) el.setAttribute('placeholder', msg);
        });
        scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const msg = getMessage(el.dataset.i18nTitle);
            if (msg != null) el.setAttribute('title', msg);
        });
    }

    function detectLang() {
        const ui = (chrome.i18n && chrome.i18n.getUILanguage) ? chrome.i18n.getUILanguage() : '';
        return (ui || navigator.language || 'tr').slice(0, 2);
    }

    function loadOverride(lang, callback) {
        if (!lang || lang === 'auto') {
            overrideMessages = null;
            if (callback) callback();
            return;
        }
        const url = chrome.runtime.getURL('_locales/' + lang + '/messages.json');
        fetch(url)
            .then((r) => r.json())
            .then((json) => {
                overrideMessages = json;
                if (callback) callback();
            })
            .catch(() => {
                overrideMessages = null;
                if (callback) callback();
            });
    }

    function refresh(callback) {
        chrome.storage.local.get({ vadblockLang: 'auto' }, (r) => {
            let lang = r.vadblockLang;
            if (lang === 'auto') lang = detectLang();
            loadOverride(lang, () => {
                document.documentElement.lang = lang;
                apply(document);
                if (callback) callback();
                document.dispatchEvent(new Event('vadblock_i18n_ready'));
            });
        });
    }

    window.vAdBlockT = getMessage;
    window.vAdBlockApply = apply;
    window.vAdBlockRefresh = refresh;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => refresh());
    } else {
        refresh();
    }

    if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.vadblockLang) refresh();
        });
    }
})();
