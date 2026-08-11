document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const navItems = document.querySelectorAll('.nav-item');
    const panes = document.querySelectorAll('.pane');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            navItems.forEach(nav => nav.classList.remove('active'));
            panes.forEach(pane => pane.classList.remove('active'));

            item.classList.add('active');

            const targetId = item.getAttribute('data-target');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            window.scrollTo({ top: 0, behavior: 'instant' });
        });
    });

    function flashText(btn, text) {
        const orig = btn.textContent;
        btn.textContent = text;
        setTimeout(() => { btn.textContent = orig; }, 2000);
    }

    // --- Dil secici ---
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        chrome.storage.local.get({ vadblockLang: 'auto' }, (r) => {
            languageSelect.value = r.vadblockLang || 'auto';
        });
        languageSelect.addEventListener('change', () => {
            chrome.storage.local.set({ vadblockLang: languageSelect.value }, () => {
                window.vAdBlockRefresh && window.vAdBlockRefresh();
            });
        });
    }

    // --- Arama kutusu ---
    const searchInput = document.getElementById('optionsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            panes.forEach(pane => pane.classList.remove('search-hidden'));
            if (!q) return;
            let matchId = null;
            panes.forEach(pane => {
                const hay = (pane.dataset.search || '').toLowerCase() + ' ' + pane.textContent.toLowerCase();
                if (hay.includes(q)) {
                    if (!matchId) matchId = pane.id;
                } else {
                    pane.classList.add('search-hidden');
                }
            });
            if (matchId) {
                const item = document.querySelector('.nav-item[data-target="' + matchId + '"]');
                if (item) item.click();
            }
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                panes.forEach(pane => pane.classList.remove('search-hidden'));
            }
        });
    }

    // --- Boş durum illüstrasyonları ---
    const EMPTY_ICONS = {
        shield: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8l20 7v14c0 13-8.5 22-20 27C20.5 51 12 42 12 29V15l20-7z"/><line x1="24" y1="32" x2="40" y2="32"/><line x1="24" y1="40" x2="36" y2="40"/></svg>',
        list: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="14" y1="16" x2="50" y2="16"/><line x1="14" y1="28" x2="50" y2="28"/><line x1="14" y1="40" x2="50" y2="40"/><line x1="14" y1="52" x2="34" y2="52"/></svg>',
        chart: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="54" x2="54" y2="54"/><rect x="16" y="30" width="8" height="16" rx="2"/><rect x="28" y="20" width="8" height="26" rx="2"/><rect x="40" y="34" width="8" height="12" rx="2"/></svg>',
        globe: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="22"/><ellipse cx="32" cy="32" rx="10" ry="22"/><line x1="10" y1="32" x2="54" y2="32"/></svg>'
    };
    function emptyStateHTML(icon, text) {
        return '<div class="empty-state empty-illustrated"><div class="empty-illustration">' + (EMPTY_ICONS[icon] || EMPTY_ICONS.shield) + '</div><div>' + text + '</div></div>';
    }
    const T = (key, subs) => (window.vAdBlockT ? vAdBlockT(key, subs) : null);

    // --- Filtre guncelleme (gercek) ---
    const updateFiltersBtn = document.getElementById('updateFiltersBtn');
    function refreshFilterStatus() {
        chrome.runtime.sendMessage({ type: 'GET_FILTER_STATUS' }, (r) => {
            const autoStatus = document.getElementById('filterAutoStatus');
            const t = (key, subs) => window.vAdBlockT ? vAdBlockT(key, subs) : null;
            if (!r) {
                if (autoStatus) {
                    autoStatus.textContent = t('opt_update_err_conn') || 'Bağlantı kurulamadı';
                    autoStatus.classList.add('stale');
                }
                return;
            }
            const at = document.getElementById('filterUpdatedAt');
            if (at) at.textContent = r.updatedAt ? new Date(r.updatedAt).toLocaleString('tr-TR') : (window.vAdBlockT ? vAdBlockT('opt_update_unknown') : 'bilinmiyor');
            if (autoStatus) {
                if (r.updatedAt) {
                    const days = Math.floor((Date.now() - r.updatedAt) / 86400000);
                    if (days >= 7) {
                        autoStatus.textContent = t('opt_update_stale', [days]) || ('⚠ Otomatik güncelleme bekliyor (' + days + ' gün önce)');
                        autoStatus.classList.add('stale');
                    } else {
                        autoStatus.textContent = t('opt_update_fresh', [days]) || ('✓ Güncel · ' + days + ' gün önce güncellendi');
                        autoStatus.classList.remove('stale');
                    }
                } else {
                    autoStatus.textContent = t('opt_update_first') || 'İlk güncelleme bekleniyor';
                    autoStatus.classList.add('stale');
                }
            }
            const counts = document.getElementById('filterCounts');
            if (counts) {
                const parts = [];
                const off = window.vAdBlockT ? vAdBlockT('opt_update_off') : ' (kapalı)';
                for (const [k, v] of Object.entries(r.counts || {})) {
                    const enabled = r.enabledMap ? r.enabledMap[k] !== false : true;
                    parts.push(k + ': ' + v.toLocaleString('tr-TR') + (enabled ? '' : off));
                }
                counts.textContent = parts.join(' · ');
            }
        });
    }

    if (updateFiltersBtn) {
        const setUpdateBtnText = (text) => {
            const span = updateFiltersBtn.querySelector('span');
            if (span) span.textContent = text;
            else updateFiltersBtn.textContent = text;
        };
        updateFiltersBtn.addEventListener('click', () => {
            updateFiltersBtn.disabled = true;
            setUpdateBtnText(window.vAdBlockT ? vAdBlockT('opt_update_running') : 'Güncelleniyor...');
            chrome.runtime.sendMessage({ type: 'UPDATE_FILTERS' }, (res) => {
                updateFiltersBtn.disabled = false;
                if (res && res.success) {
                    setUpdateBtnText(window.vAdBlockT ? vAdBlockT('opt_update_done') : 'Güncel!');
                    refreshFilterStatus();
                    document.addEventListener('vAdBlockLangLoaded', refreshFilterStatus);
                } else {
                    setUpdateBtnText(window.vAdBlockT ? vAdBlockT('opt_update_error', { ERROR: (res && res.error) || '' }) : 'Hata!');
                    console.log('update filters error:', res && res.error);
                }
                setTimeout(() => { setUpdateBtnText(window.vAdBlockT ? vAdBlockT('opt_update_btn') : 'Filtreleri Güncelle'); }, 2500);
            });
        });
        refreshFilterStatus();
    }

    // --- Ozellestir: CSS kurallari (gercek kaydetme) ---
    const saveCustomCssBtn = document.getElementById('saveCustomCssBtn');
    if (saveCustomCssBtn) {
        saveCustomCssBtn.addEventListener('click', () => {
            const rules = (document.getElementById('customCss').value || '').split('\n').map(l => l.trim()).filter(Boolean);
            chrome.storage.local.set({ userRules: rules }, () => {
                chrome.storage.sync.set({ userRules: rules });
                flashText(saveCustomCssBtn, window.vAdBlockT('opt_saved') || 'Kaydedildi!');
            });
        });
    }

    // --- Ozellestir: Network kurallari ---
    const saveNetworkRulesBtn = document.getElementById('saveNetworkRulesBtn');
    if (saveNetworkRulesBtn) {
        saveNetworkRulesBtn.addEventListener('click', () => {
            const lines = (document.getElementById('networkRules').value || '').split('\n').map(l => l.trim()).filter(Boolean);
            chrome.storage.local.get({ settings: {} }, (r) => {
                const settings = r.settings || {};
                settings.userNetworkRules = lines;
                chrome.storage.local.set({ settings }, () => {
                    flashText(saveNetworkRulesBtn, window.vAdBlockT('opt_saved') || 'Kaydedildi!');
                });
            });
        });
    }

    // --- Yedekle & Geri Yukle ---
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            chrome.storage.local.get(null, (all) => {
                const data = {
                    app: 'vAdBlock',
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    allowlist: all.allowlist || [],
                    userRules: all.userRules || [],
                    settings: all.settings || {},
                    protectionLevel: all.protectionLevel || 'balanced',
                    theme: all.theme || 'default',
                    globalEnabled: all.globalEnabled !== false
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'vadblock-backup.json';
                a.click();
                URL.revokeObjectURL(url);
            });
        });
    }

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', () => {
            const file = importFile.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    const toSet = {};
                    if (Array.isArray(data.allowlist)) toSet.allowlist = data.allowlist;
                    if (Array.isArray(data.userRules)) toSet.userRules = data.userRules;
                    if (data.settings && typeof data.settings === 'object') toSet.settings = data.settings;
                    if (data.protectionLevel) toSet.protectionLevel = data.protectionLevel;
                    if (data.theme) toSet.theme = data.theme;
                    if (typeof data.globalEnabled === 'boolean') toSet.globalEnabled = data.globalEnabled;
                    chrome.storage.local.set(toSet, () => {
                        chrome.storage.sync.set({ settings: toSet.settings, protectionLevel: toSet.protectionLevel, theme: toSet.theme });
                        loadSettings();
                        loadWhitelist();
                        loadCustomTextareas();
                        loadFilterStatus();
                        flashText(importBtn, window.vAdBlockT('opt_restored') || 'Geri Yüklendi!');
                    });
                } catch (e) {
                    console.log('import error', e);
                }
                importFile.value = '';
            };
            reader.readAsText(file);
        });
    }

    // --- Engelleme gunlugu ---
    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    let currentLog = [];
    let logFilter = '';

    function loadBlockLog() {
        chrome.runtime.sendMessage({ type: 'GET_LOG' }, (log) => {
            currentLog = log || [];
            renderLog();
        });
    }

    function renderLog() {
        const list = document.getElementById('blockLogList');
        if (!list) return;
        const needle = logFilter.trim().toLowerCase();
        const filtered = needle ? currentLog.filter(e => (e.host || '').toLowerCase().includes(needle) || (e.url || '').toLowerCase().includes(needle)) : currentLog;
        list.innerHTML = '';
        if (filtered.length === 0) {
            list.innerHTML = emptyStateHTML('list', T('opt_empty_log') || 'Henüz engellenen istek yok.');
            return;
        }
        [...filtered].reverse().forEach(entry => {
            const item = document.createElement('div');
            item.className = 'block-log-item';
            const time = new Date(entry.t);
            item.innerHTML = `<span class="bl-time">${time.toLocaleTimeString('tr-TR')}</span> <span class="bl-host">${escapeHtml(entry.host)}</span> <span class="bl-url">${escapeHtml(entry.url)}</span>`;
            list.appendChild(item);
        });
    }

    const logSearch = document.getElementById('logSearch');
    if (logSearch) {
        logSearch.addEventListener('input', (e) => {
            logFilter = e.target.value || '';
            renderLog();
        });
    }

    const exportLogBtn = document.getElementById('exportLogBtn');
    if (exportLogBtn) {
        exportLogBtn.addEventListener('click', () => {
            const rows = [['time', 'host', 'url']].concat(currentLog.map(e => [new Date(e.t).toISOString(), e.host, e.url]));
            const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vadblock-log.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // --- Haftalik rapor + en cok engellenen siteler ---
    let currentReportRange = '7d';

    function sumArray(arr) { return (arr || []).reduce((a, b) => a + (b || 0), 0); }

    function getRangeData(stats, range) {
        if (range === '30d') return { total: sumArray(stats.monthly.total), ads: sumArray(stats.monthly.ads), trackers: sumArray(stats.monthly.trackers), days: 30 };
        if (range === '1y') return { total: sumArray(stats.yearly.total), ads: sumArray(stats.yearly.ads), trackers: sumArray(stats.yearly.trackers), days: 365 };
        return { total: sumArray(stats.history.total), ads: sumArray(stats.history.ads), trackers: sumArray(stats.history.trackers), days: 7 };
    }

    function renderReport(stats) {
        const data = getRangeData(stats, currentReportRange);
        const setVal = (id, val, cls) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = val.toLocaleString('tr-TR');
                if (cls) el.className = 'report-stat-value ' + cls;
            }
        };
        setVal('reportTotal', data.total);
        setVal('reportAds', data.ads, 'blue');
        setVal('reportTrackers', data.trackers, 'green');
        setVal('reportDaily', Math.round(data.total / data.days), 'amber');

        const list = document.getElementById('topDomainsList');
        if (!list) return;
        const top = (stats.topDomains || []).slice().sort((a, b) => b.count - a.count).slice(0, 5);
        list.innerHTML = '';
        if (top.length === 0) {
            list.innerHTML = emptyStateHTML('chart', T('opt_empty_data') || 'Henüz veri yok.');
            return;
        }
        const maxCount = top[0].count || 1;
        top.forEach((t, i) => {
            const row = document.createElement('div');
            row.className = 'top-domain-row';
            row.innerHTML = `
                <div class="top-domain-rank">${i + 1}</div>
                <div>
                    <div class="top-domain-name">${escapeHtml(t.host)}</div>
                    <div class="top-domain-bar-track"><div class="top-domain-bar" style="width:${Math.max(6, Math.round(t.count / maxCount * 100))}%;"></div></div>
                </div>
                <div class="top-domain-count">${t.count.toLocaleString('tr-TR')}</div>`;
            list.appendChild(row);
        });
    }

    function loadReport() {
        chrome.runtime.sendMessage({ type: 'GET_STATS' }, (s) => {
            if (s) renderReport(s);
        });
    }

    const reportRange = document.getElementById('reportRange');
    if (reportRange) {
        reportRange.querySelectorAll('.range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                reportRange.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentReportRange = btn.dataset.range;
                loadReport();
            });
        });
        loadReport();
    }

    const clearLogBtn = document.getElementById('clearLogBtn');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'CLEAR_LOG' }, () => loadBlockLog());
        });
    }
    loadBlockLog();
    setInterval(loadBlockLog, 2500);

    // Allowlist Logic
    const whitelistContainer = document.getElementById('whitelistContainer');
    const whitelistInput = document.getElementById('whitelistInput');
    const addWhitelistBtn = document.getElementById('addWhitelistBtn');

    let whitelistPage = 0;
    const WHITELIST_PER_PAGE = 3;

    function renderWhitelist(list) {
        if (!whitelistContainer) return;
        whitelistContainer.innerHTML = '';
        if (list.length === 0) {
            whitelistContainer.innerHTML = emptyStateHTML('globe', '<span data-i18n="opt_allowlist_empty">' + (T('opt_allowlist_empty') || 'Henüz site eklenmemiş. Yukarıdan bir alan adı ekleyin.') + '</span>');
            return;
        }

        const totalPages = Math.ceil(list.length / WHITELIST_PER_PAGE);
        if (whitelistPage >= totalPages) whitelistPage = Math.max(0, totalPages - 1);
        
        const startIdx = whitelistPage * WHITELIST_PER_PAGE;
        const paginatedList = list.slice(startIdx, startIdx + WHITELIST_PER_PAGE);

        paginatedList.forEach(domain => {
            const item = document.createElement('div');
            item.className = 'whitelist-item';
            item.innerHTML = `
                <div class="domain-name">${domain}</div>
                <button class="icon-button remove-btn" data-domain="${domain}" title="${window.vAdBlockT('opt_remove') || 'Kaldır'}">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;
            whitelistContainer.appendChild(item);
        });

        if (totalPages > 1) {
            const pagControls = document.createElement('div');
            pagControls.className = 'wl-pagination';
            pagControls.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 16px; padding: 12px 0;';
            
            const prevBtn = document.createElement('button');
            prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            prevBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; width: 40px; height: 40px; padding: 0; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: var(--text-main); border-radius: 12px; cursor: pointer; transition: all 0.2s ease;';
            if (whitelistPage === 0) { prevBtn.style.opacity = '0.25'; prevBtn.style.cursor = 'default'; prevBtn.disabled = true; }
            else { prevBtn.onmouseover = () => { prevBtn.style.background = 'rgba(255,255,255,0.15)'; prevBtn.style.transform = 'scale(1.08)'; }; prevBtn.onmouseout = () => { prevBtn.style.background = 'rgba(255,255,255,0.08)'; prevBtn.style.transform = 'none'; }; prevBtn.onclick = () => { whitelistPage--; renderWhitelist(list); }; }
            
            const nextBtn = document.createElement('button');
            nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            nextBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; width: 40px; height: 40px; padding: 0; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: var(--text-main); border-radius: 12px; cursor: pointer; transition: all 0.2s ease;';
            if (whitelistPage === totalPages - 1) { nextBtn.style.opacity = '0.25'; nextBtn.style.cursor = 'default'; nextBtn.disabled = true; }
            else { nextBtn.onmouseover = () => { nextBtn.style.background = 'rgba(255,255,255,0.15)'; nextBtn.style.transform = 'scale(1.08)'; }; nextBtn.onmouseout = () => { nextBtn.style.background = 'rgba(255,255,255,0.08)'; nextBtn.style.transform = 'none'; }; nextBtn.onclick = () => { whitelistPage++; renderWhitelist(list); }; }
            
            const infoSpan = document.createElement('span');
            infoSpan.textContent = (whitelistPage + 1) + ' / ' + totalPages;
            infoSpan.style.cssText = 'font-weight: 600; font-size: 15px; letter-spacing: 2px; color: var(--text-main); min-width: 50px; text-align: center;';
            
            pagControls.appendChild(prevBtn);
            pagControls.appendChild(infoSpan);
            pagControls.appendChild(nextBtn);
            whitelistContainer.appendChild(pagControls);
        }

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const domain = e.currentTarget.getAttribute('data-domain');
                removeFromWhitelist(domain);
            });
        });
    }

    function loadWhitelist() {
        chrome.storage.local.get({ allowlist: [] }, (r) => {
            renderWhitelist(r.allowlist || []);
        });
    }

    function removeFromWhitelist(domain) {
        chrome.storage.local.get({ allowlist: [] }, (r) => {
            const newList = (r.allowlist || []).filter(d => d !== domain);
            chrome.storage.local.set({ allowlist: newList }, () => {
                chrome.storage.sync.set({ allowlist: newList });
                renderWhitelist(newList);
                chrome.runtime.sendMessage({ type: 'TOGGLE_SITE', domain, enabled: true });
            });
        });
    }

    function addToWhitelist(domain) {
        domain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        if (!domain) return;
        // Domain doğrulama: en az bir nokta içermeli (örn: ornek.com)
        if (!domain.includes('.') || !/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}$/i.test(domain)) {
            if (whitelistInput) {
                whitelistInput.style.borderColor = '#EF4444';
                whitelistInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
                whitelistInput.setAttribute('placeholder', 'ornek.com gibi bir alan adı girin!');
                whitelistInput.value = '';
                setTimeout(() => {
                    whitelistInput.style.borderColor = '';
                    whitelistInput.style.boxShadow = '';
                    whitelistInput.setAttribute('placeholder', T('opt_allowlist_placeholder') || 'ornek.com');
                }, 2500);
            }
            return;
        }
        chrome.storage.local.get({ allowlist: [] }, (r) => {
            const list = r.allowlist || [];
            if (!list.includes(domain)) {
                const newList = [...list, domain];
                chrome.storage.local.set({ allowlist: newList }, () => {
                    chrome.storage.sync.set({ allowlist: newList });
                    renderWhitelist(newList);
                    whitelistInput.value = '';
                    chrome.runtime.sendMessage({ type: 'TOGGLE_SITE', domain, enabled: false });
                });
            }
        });
    }

    if (addWhitelistBtn && whitelistInput) {
        addWhitelistBtn.addEventListener('click', () => {
            addToWhitelist(whitelistInput.value);
        });
        whitelistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addToWhitelist(whitelistInput.value);
        });
        loadWhitelist();
    }

    // --- Dynamic Settings Sync ---
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:not(.filter-list-cb)');
    const filterListCbs = document.querySelectorAll('.filter-list-cb');
    const radios = document.querySelectorAll('input[type="radio"][name="protectionLevel"]');
    const themeCards = document.querySelectorAll('.theme-card');

    function loadCustomTextareas() {
        chrome.storage.local.get({ userRules: [], settings: {} }, (r) => {
            const customCss = document.getElementById('customCss');
            if (customCss) customCss.value = (r.userRules || []).join('\n');
            const networkRules = document.getElementById('networkRules');
            if (networkRules) networkRules.value = (((r.settings || {}).userNetworkRules) || []).join('\n');
        });
    }

    function loadFilterStatus() {
        chrome.storage.local.get({ settings: {} }, (r) => {
            const fl = (r.settings || {}).filterLists || {};
            filterListCbs.forEach(cb => {
                cb.checked = fl[cb.dataset.list] !== false;
            });
        });
        refreshFilterStatus();
    }

    function loadSettings() {
        chrome.storage.local.get({ settings: {}, protectionLevel: 'balanced', theme: 'default' }, (r) => {
            const settings = r.settings || {};
            checkboxes.forEach(cb => {
                if (cb.id && settings[cb.id] !== undefined) cb.checked = settings[cb.id];
            });
            const fl = settings.filterLists || {};
            filterListCbs.forEach(cb => {
                cb.checked = fl[cb.dataset.list] !== false;
            });
            radios.forEach(radio => {
                if (radio.value === r.protectionLevel) radio.checked = true;
            });
            const apiInput = document.getElementById('sponsorApiUrl');
            if (apiInput) apiInput.value = settings.sponsorApiUrl || 'https://vade.pro/api';
            updateProtectionUI();
            updateThemeUI(r.theme);
            loadCustomTextareas();
            refreshFilterStatus();
            document.addEventListener('vAdBlockLangLoaded', refreshFilterStatus);
            if (typeof renderCategories === 'function') {
                document.addEventListener('vAdBlockLangLoaded', () => renderCategories(settings.sbCategories || {}));
                document.addEventListener('vadblock_i18n_ready', () => renderCategories(settings.sbCategories || {}));
                renderCategories(settings.sbCategories || {});
            }
        });
    }

    function saveSettings() {
        chrome.storage.local.get({ settings: {} }, (r) => {
            const settings = r.settings || {};
            checkboxes.forEach(cb => {
                if (cb.id) settings[cb.id] = cb.checked;
            });
            const apiInput = document.getElementById('sponsorApiUrl');
            if (apiInput) settings.sponsorApiUrl = apiInput.value.trim() || 'https://vade.pro/api';
            const fl = {};
            filterListCbs.forEach(cb => { fl[cb.dataset.list] = cb.checked; });
            settings.filterLists = fl;
            let protectionLevel = 'balanced';
            radios.forEach(radio => {
                if (radio.checked) protectionLevel = radio.value;
            });
            chrome.storage.local.set({ settings, protectionLevel }, () => {
                updateProtectionUI();
            });
            chrome.storage.sync.set({ settings, protectionLevel });
        });
    }

    let activeTheme = 'default';
    function setTheme(theme) {
        chrome.storage.local.set({ theme }, () => {
            updateThemeUI(theme);
        });
        chrome.storage.sync.set({ theme });
    }

    function updateThemeUI(active) {
        activeTheme = active;
        themeCards.forEach(card => {
            card.classList.toggle('selected', card.dataset.theme === active);
        });
        document.body.setAttribute('data-theme', active);
    }

    // Tema karti hover onizlemesi (hover'da temayi gecici uygula)
    themeCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            document.body.setAttribute('data-theme', card.dataset.theme);
        });
        card.addEventListener('mouseleave', () => {
            document.body.setAttribute('data-theme', activeTheme);
        });
    });

    function updateProtectionUI() {
        radios.forEach(radio => {
            const card = radio.closest('.mode-card');
            if (card) card.classList.toggle('selected', radio.checked);
        });
    }

    checkboxes.forEach(cb => { if (cb.id) cb.addEventListener('change', saveSettings); });
    filterListCbs.forEach(cb => { cb.addEventListener('change', saveSettings); });
    radios.forEach(radio => { radio.addEventListener('change', saveSettings); });
    themeCards.forEach(card => {
        card.addEventListener('click', () => {
            setTheme(card.dataset.theme);
        });
    });

    // --- SponsorBlock Kategorileri ---
    const categorySettingsGrid = document.getElementById('categorySettingsGrid');
    function renderCategories(savedCats) {
        if (!categorySettingsGrid) return;
        const categories = [
            { id: 'sponsor', label: window.vAdBlockT('sb_cat_sponsor') || 'Sponsor', default: 'auto' },
            { id: 'intro', label: window.vAdBlockT('sb_cat_intro') || 'İntro', default: 'auto' },
            { id: 'outro', label: window.vAdBlockT('sb_cat_outro') || 'Outro', default: 'auto' },
            { id: 'selfpromo', label: window.vAdBlockT('sb_cat_selfpromo') || 'Öz Tanıtım', default: 'auto' },
            { id: 'interaction', label: window.vAdBlockT('sb_cat_interaction') || 'Etkileşim', default: 'auto' },
            { id: 'preview', label: window.vAdBlockT('sb_cat_preview') || 'Önizleme', default: 'auto' },
            { id: 'music_offtopic', label: window.vAdBlockT('sb_cat_music') || 'Müzik Dışı', default: 'auto' }
        ];

        categorySettingsGrid.innerHTML = '';
        categories.forEach(cat => {
            const val = savedCats[cat.id] || cat.default;
            const row = document.createElement('div');
            row.className = 'setting-row';
            row.innerHTML = `
                <div class="setting-info">
                    <div class="setting-title">${cat.label}</div>
                </div>
                <select class="language-select" style="width: 150px; margin-left: auto; cursor: pointer;" data-cat="${cat.id}">
                    <option value="auto" ${val === 'auto' ? 'selected' : ''}>${window.vAdBlockT('opt_sb_auto_skip') || 'Otomatik Atla'}</option>
                    <option value="button" ${val === 'button' ? 'selected' : ''}>${window.vAdBlockT('opt_sb_btn_show') || 'Buton Göster'}</option>
                    <option value="disabled" ${val === 'disabled' ? 'selected' : ''}>${window.vAdBlockT('opt_sb_disabled') || 'Devre Dışı'}</option>
                </select>
            `;
            categorySettingsGrid.appendChild(row);
        });

        categorySettingsGrid.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                chrome.storage.local.get({ settings: {} }, (r) => {
                    const settings = r.settings || {};
                    settings.sbCategories = settings.sbCategories || {};
                    settings.sbCategories[e.target.dataset.cat] = e.target.value;
                    chrome.storage.local.set({ settings }, () => {
                        chrome.storage.sync.set({ settings });
                    });
                });
            });
        });
    }

    loadSettings();
});
