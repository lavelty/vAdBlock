/* Lave AdBlock - Advanced Element Picker (v2) */
let isPickerActive = false;
let elementChain = [];
let currentChainIndex = 0;
let hoveredElement = null;
let applyAllSites = false;
let blockSimilar = false;
let currentRule = "";
let originalDisplayForPreview = "";
let pickerStyleTag = null;
let cancelBadge = null;

let vadLangData = null;
let vadLangReady = new Promise(resolve => {
    chrome.storage.local.get({vadblockLang: 'auto'}, (r) => {
        if (r.vadblockLang && r.vadblockLang !== 'auto') {
            fetch(chrome.runtime.getURL('_locales/' + r.vadblockLang + '/messages.json'))
                .then(res => res.json())
                .then(json => { vadLangData = json; resolve(); })
                .catch(() => resolve());
        } else {
            resolve();
        }
    });
});

// 🌍 Çeviri yardımcısı 🌍
function T(key, fallback) {
    if (vadLangData && vadLangData[key]) return vadLangData[key].message;
    if (window.vAdBlockT) { const m = vAdBlockT(key); if (m != null) return m; }
    try { const m = chrome.i18n.getMessage(key); if (m) return m; } catch (e) { /* noop */ }
    return fallback;
}

// 🎨 Highlight Overlay 🎨
const highlightOverlay = document.createElement('div');
Object.assign(highlightOverlay.style, {
    position: 'absolute', pointerEvents: 'none', zIndex: '2147483646',
    background: 'rgba(139, 92, 246, 0.15)', border: '2px solid #8B5CF6',
    borderRadius: '12px', transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)', display: 'none'
});

// ── Modals Wrapper ──
const modalsWrapper = document.createElement('div');
Object.assign(modalsWrapper.style, {
    position: 'fixed', zIndex: '2147483647', display: 'none'
});

// ── Main Picker Panel ──
const pickerContainer = document.createElement('div');
Object.assign(pickerContainer.style, {
    background: 'rgba(15, 15, 15, 0.95)',
    backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '24px', width: '380px', boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255,255,255,0.02)',
    color: '#F8FAFC', fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif", overflow: 'hidden'
});

const previewContainer = document.createElement('div');
Object.assign(previewContainer.style, {
    background: 'rgba(15, 15, 15, 0.95)',
    backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '24px', width: '380px', boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255,255,255,0.02)',
    color: '#F8FAFC', fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
    padding: '32px 24px', display: 'none', position: 'relative'
});

function renderPickerUI() {
    pickerContainer.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:24px 24px 8px;">
    <div>
        <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:-0.5px;">${T('picker_title', 'Bir öğeyi engelle')}</div>
        <div style="font-size:14px;color:#94a3b8;margin-top:4px;font-weight:500;">${T('picker_subtitle', 'Lave kurallarına ekleyin')}</div>
    </div>
    <button id="lave-picker-close" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#cbd5e1;cursor:pointer;font-size:20px;width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#cbd5e1';">&times;</button>
</div>
<div style="padding:16px 24px 24px;">
    <div style="font-size:14px;color:#cbd5e1;margin-bottom:12px;font-weight:600;">${T('picker_expand', 'Seçim alanını genişlet:')}</div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;background:rgba(255,255,255,0.05);padding:14px 16px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:14px;color:#94a3b8;user-select:none;font-weight:700;">➖</span>
        <input type="range" id="lave-picker-slider" min="0" max="0" value="0" style="flex:1;accent-color:#ffffff;height:6px;outline:none;cursor:pointer;">
        <span style="font-size:14px;color:#94a3b8;user-select:none;font-weight:700;">➕</span>
    </div>
    <details id="lave-advanced-details" style="margin-bottom:24px;">
        <summary style="font-size:14px;color:#cbd5e1;cursor:pointer;user-select:none;outline:none;list-style:none;display:flex;align-items:center;gap:8px;font-weight:600;padding:8px;background:rgba(255,255,255,0.05);border-radius:12px;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            <span style="font-size:12px;transition:transform 0.2s;color:#ffffff;" id="lave-adv-arrow">▶</span> ${T('picker_advanced', 'Gelişmiş seçenekler')}
        </summary>
        <div style="padding:16px 8px 0;display:flex;flex-direction:column;gap:14px;">
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cbd5e1;cursor:pointer;user-select:none;font-weight:600;">
                <input type="checkbox" id="lave-apply-all-sites" class="lave-custom-checkbox">
                ${T('picker_apply_all', 'Kuralı tüm sitelerde uygula')}
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cbd5e1;cursor:pointer;user-select:none;font-weight:600;">
                <input type="checkbox" id="lave-block-similar" class="lave-custom-checkbox">
                ${T('picker_similar', 'Benzer öğeleri de engelle')}
            </label>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;font-weight:600;">${T('picker_css_label', 'CSS Seçici (İleri Düzey):')}</div>
            <textarea id="lave-target-code" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;font-size:13px;color:#ffffff;font-family:'Consolas',monospace;resize:vertical;min-height:70px;outline:none;transition:all 0.2s;" onfocus="this.style.borderColor='rgba(255,255,255,0.3)';this.style.background='rgba(255,255,255,0.05)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.03)'"></textarea>
        </div>
    </details>
    <div style="display:flex;gap:12px;margin-bottom:16px;">
        <button id="lave-picker-block" style="flex:2;padding:14px;background:#ffffff;border:none;color:#0F0F0F;border-radius:16px;cursor:pointer;font-size:16px;font-weight:700;transition:all 0.15s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.background='#e5e5e5';" onmouseout="this.style.background='#ffffff';" onmousedown="this.style.transform='scale(0.96)';" onmouseup="this.style.transform='scale(1)';">${T('picker_block', 'Engelle')}</button>
        <button id="lave-picker-preview" style="flex:1;padding:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:16px;cursor:pointer;font-size:15px;font-weight:700;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">${T('picker_preview', 'Önizleme')}</button>
    </div>
    <div style="text-align:center;">
        <button id="lave-picker-reselect" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:8px 16px;font-weight:600;border-radius:12px;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='#94a3b8'">${T('picker_reselect', 'Farklı bir öğe seç')}</button>
    </div>
</div>`;

    previewContainer.innerHTML = `
<button id="lave-preview-close" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#cbd5e1;cursor:pointer;font-size:20px;width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#cbd5e1';">&times;</button>
<div style="font-weight:800;font-size:22px;color:#fff;margin-bottom:12px;letter-spacing:-0.5px;">${T('picker_preview_title', 'Önizleme modu')}</div>
<div style="font-size:15px;color:#94a3b8;margin-bottom:32px;line-height:1.6;font-weight:500;">${T('picker_preview_desc', 'Seçtiğiniz öğe gizlendi. Görüntü istediğiniz gibiyse kalıcı olarak engelleyebilirsiniz.')}</div>
<div style="display:flex;gap:12px;margin-bottom:16px;">
    <button id="lave-preview-block" style="flex:2;padding:14px;background:#ffffff;border:none;color:#0F0F0F;border-radius:16px;cursor:pointer;font-size:16px;font-weight:700;transition:all 0.15s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.background='#e5e5e5';" onmouseout="this.style.background='#ffffff';" onmousedown="this.style.transform='scale(0.96)';" onmouseup="this.style.transform='scale(1)';">${T('picker_block', 'Engelle')}</button>
    <button id="lave-preview-exit" style="flex:1;padding:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:16px;cursor:pointer;font-size:15px;font-weight:700;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">${T('picker_exit', 'Çıkış')}</button>
</div>
<div style="text-align:center;">
    <button id="lave-preview-reselect" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:8px 16px;font-weight:600;border-radius:12px;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='#94a3b8'">${T('picker_reselect', 'Farklı bir öğe seç')}</button>
</div>`;

    modalsWrapper.appendChild(pickerContainer);
    modalsWrapper.appendChild(previewContainer);
}

// ── Helper: Inject picker-mode styles (crosshair cursor, disable text select) ──
function injectPickerStyles() {
    if (pickerStyleTag) return;
    pickerStyleTag = document.createElement('style');
    pickerStyleTag.id = 'lave-picker-mode-styles';
    pickerStyleTag.textContent = `
        html { cursor: crosshair !important; user-select: none !important; -webkit-user-select: none !important; }
        html body { cursor: crosshair !important; user-select: none !important; -webkit-user-select: none !important; }
        html body * { cursor: crosshair !important; user-select: none !important; -webkit-user-select: none !important; }
        .lave-custom-checkbox { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; cursor: pointer; position: relative; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); margin: 0; }
        .lave-custom-checkbox:checked { background: #ffffff; border-color: #ffffff; }
        .lave-custom-checkbox:checked::after { content: ''; position: absolute; left: 5px; top: 2px; width: 4px; height: 8px; border: solid #0F0F0F; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .lave-custom-checkbox:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.3); }
        .lave-custom-checkbox:checked:hover { background: #e5e5e5; }
    `;
    (document.head || document.documentElement).appendChild(pickerStyleTag);
}

function removePickerStyles() {
    if (pickerStyleTag) {
        pickerStyleTag.remove();
        pickerStyleTag = null;
    }
}

// ── Cancel Badge (bottom-right floating button) ──
function showCancelBadge() {
    if (cancelBadge) return;
    cancelBadge = document.createElement('div');
    Object.assign(cancelBadge.style, {
        position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
        background: 'rgba(255, 255, 255, 0.9)', color: '#0F172A', padding: '12px 20px',
        borderRadius: '100px', fontSize: '14px', fontFamily: "'Outfit','Inter',sans-serif", fontWeight: '600',
        cursor: 'pointer', border: '1px solid rgba(15,23,42,0.08)', backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)', userSelect: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    });
    cancelBadge.textContent = T('picker_cancel', 'İptal (ESC)');
    cancelBadge.addEventListener('mouseover', () => { cancelBadge.style.transform = 'translateY(-2px)'; cancelBadge.style.boxShadow = '0 12px 28px rgba(15,23,42,0.15)'; });
    cancelBadge.addEventListener('mouseout', () => { cancelBadge.style.transform = 'none'; cancelBadge.style.boxShadow = '0 8px 24px rgba(15,23,42,0.12)'; });
    cancelBadge.addEventListener('click', () => { closePanel(); });
    document.body.appendChild(cancelBadge);
}

function hideCancelBadge() {
    if (cancelBadge) { cancelBadge.remove(); cancelBadge = null; }
}

// ── DOM chain builder ──
function buildElementChain(el) {
    const chain = [];
    let curr = el;
    while (curr && curr.tagName && curr.tagName.toLowerCase() !== 'body' && curr.tagName.toLowerCase() !== 'html') {
        chain.push(curr);
        curr = curr.parentElement;
    }
    return chain;
}

// ── CSS selector generator ──
function generateAdvancedSelector(el, similar) {
    if (!similar && el.id) return `#${el.id}`;
    const chain = [];
    let curr = el;
    let depth = 0;
    while (curr && curr.tagName && curr.tagName.toLowerCase() !== 'body' && depth < 2) {
        let sel = curr.tagName.toLowerCase();
        if (curr.className && typeof curr.className === 'string') {
            const classes = curr.className.split(' ').filter(c => c.trim().length > 0 && !c.includes('lave-'));
            if (classes.length > 0) sel += '.' + classes.join('.');
        }
        if (!similar) {
            const parent = curr.parentNode;
            if (parent && parent.children.length > 1) {
                sel += `:nth-child(${Array.from(parent.children).indexOf(curr) + 1})`;
            }
        }
        chain.unshift(sel);
        curr = curr.parentElement;
        depth++;
    }
    return chain.join(' > ');
}

// ── Update highlight + rule text ──
function updateRuleAndHighlight() {
    const el = elementChain[currentChainIndex];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    Object.assign(highlightOverlay.style, {
        display: 'block', top: (rect.top + window.scrollY) + 'px', left: (rect.left + window.scrollX) + 'px',
        width: rect.width + 'px', height: rect.height + 'px'
    });
    const sel = generateAdvancedSelector(el, blockSimilar);
    currentRule = applyAllSites ? `##${sel}` : `${window.location.hostname}##${sel}`;
    const ta = document.getElementById('lave-target-code');
    if (ta) ta.value = currentRule;
}

// ── Event handlers ──
function handleMouseOver(e) {
    if (!isPickerActive) return;
    if (modalsWrapper.contains(e.target) || (cancelBadge && cancelBadge.contains(e.target))) return;
    hoveredElement = e.target;
    const rect = hoveredElement.getBoundingClientRect();
    Object.assign(highlightOverlay.style, {
        display: 'block', top: (rect.top + window.scrollY) + 'px', left: (rect.left + window.scrollX) + 'px',
        width: rect.width + 'px', height: rect.height + 'px'
    });
}

function handleClick(e) {
    if (!isPickerActive) return;
    if (modalsWrapper.contains(e.target) || (cancelBadge && cancelBadge.contains(e.target))) return;
    e.preventDefault();
    e.stopPropagation();

    try {
        isPickerActive = false;
        removePickerStyles();
        hideCancelBadge();
        // Remove listeners immediately so the page can work while modal is open
        document.removeEventListener('mouseover', handleMouseOver, true);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('mousedown', handleMouseDown, true);
        document.removeEventListener('dragstart', handleDragStart, true);

        if (!hoveredElement) { closePanel(); return; }

        elementChain = buildElementChain(hoveredElement);
        if (elementChain.length === 0) { closePanel(); return; }

        currentChainIndex = 0;
        const slider = document.getElementById('lave-picker-slider');
        if (slider) { slider.max = Math.max(0, elementChain.length - 1); slider.value = 0; }
        updateRuleAndHighlight();

        // Position modal near element
        const rect = hoveredElement.getBoundingClientRect();
        modalsWrapper.style.display = 'block';
        pickerContainer.style.display = 'block';
        previewContainer.style.display = 'none';
        let panelTop = rect.bottom + 12;
        if (panelTop + 550 > window.innerHeight) {
            panelTop = rect.top - 550;
            if (panelTop < 10) panelTop = window.innerHeight - 550;
        }
        let panelLeft = rect.left;
        if (panelLeft + 380 > window.innerWidth) panelLeft = window.innerWidth - 390;
        modalsWrapper.style.top = Math.max(10, panelTop) + 'px';
        modalsWrapper.style.left = Math.max(10, panelLeft) + 'px';
    } catch(err) {
        console.error('Lave picker error:', err);
        closePanel();
    }
}

function handleKeyDown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePanel();
    }
}

// ── Prevent text drag during picker mode ──
function handleMouseDown(e) {
    if (!isPickerActive) return;
    if (modalsWrapper.contains(e.target) || (cancelBadge && cancelBadge.contains(e.target))) return;
    e.preventDefault();
    e.stopPropagation();
}

function handleDragStart(e) {
    if (!isPickerActive) return;
    e.preventDefault();
}

// ── Start / Close / Save ──
function startPicker() {
    isPickerActive = true;
    modalsWrapper.style.display = 'none';
    highlightOverlay.style.display = 'none';
    injectPickerStyles();
    showCancelBadge();
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('dragstart', handleDragStart, true);
}

function closePanel() {
    isPickerActive = false;
    modalsWrapper.style.display = 'none';
    highlightOverlay.style.display = 'none';
    removePickerStyles();
    hideCancelBadge();
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('dragstart', handleDragStart, true);
    // Undo preview if still active
    if (originalDisplayForPreview !== "" && elementChain[currentChainIndex]) {
        elementChain[currentChainIndex].style.setProperty('display', originalDisplayForPreview);
        originalDisplayForPreview = "";
    }
}

function saveRule() {
    const ta = document.getElementById('lave-target-code');
    const ruleToSave = ta ? ta.value.trim() : '';
    if (ruleToSave) {
        chrome.storage.local.get({userRules: []}, (result) => {
            const rules = result.userRules;
            if (!rules.includes(ruleToSave)) {
                rules.push(ruleToSave);
                chrome.storage.local.set({userRules: rules}, () => {
                    chrome.storage.sync.set({ userRules: rules }).catch(() => {});
                });
            }
        });
        if (elementChain[currentChainIndex]) {
            elementChain[currentChainIndex].style.setProperty('display', 'none', 'important');
        }
        showSaveToast(ruleToSave);
    }
    closePanel();
}

// ── Kayit sonrasi geri-alma tostu ──
let saveToastEl = null;
function showSaveToast(rule) {
    if (saveToastEl) saveToastEl.remove();
    saveToastEl = document.createElement('div');
    Object.assign(saveToastEl.style, {
        position: 'fixed', bottom: '24px', left: '24px', zIndex: '2147483647',
        background: 'rgba(15,23,42,0.92)', color: '#fff', padding: '14px 18px',
        borderRadius: '16px',         fontSize: '14px', fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
        fontWeight: '500', boxShadow: '0 12px 32px rgba(0,0,0,0.25)', maxWidth: '360px',
        display: 'flex', alignItems: 'center', gap: '12px', userSelect: 'none'
    });
    const text = document.createElement('span');
    text.style.flex = '1';
    text.textContent = T('picker_saved', 'Kural kaydedildi');
    const sub = document.createElement('div');
    sub.style.fontSize = '12px';
    sub.style.opacity = '0.75';
    sub.style.marginTop = '2px';
    sub.textContent = rule.length > 60 ? rule.slice(0, 60) + '…' : rule;
    text.appendChild(sub);
    const undoBtn = document.createElement('button');
    undoBtn.textContent = T('picker_undo', 'Geri al');
    undoBtn.style.cssText = 'background:#8B5CF6;border:none;color:#fff;border-radius:100px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;flex:none;';
    undoBtn.addEventListener('mouseover', () => { undoBtn.style.background = '#9F6FF7'; });
    undoBtn.addEventListener('mouseout', () => { undoBtn.style.background = '#8B5CF6'; });
    undoBtn.addEventListener('click', () => {
        chrome.storage.local.get({userRules: []}, (r) => {
            const rules = (r.userRules || []).filter(x => x !== rule);
            chrome.storage.local.set({userRules: rules}, () => {
                chrome.storage.sync.set({ userRules: rules }).catch(() => {});
            });
        });
        if (saveToastEl) { saveToastEl.remove(); saveToastEl = null; }
    });
    saveToastEl.appendChild(text);
    saveToastEl.appendChild(undoBtn);
    document.body.appendChild(saveToastEl);
    setTimeout(() => {
        if (saveToastEl) { saveToastEl.remove(); saveToastEl = null; }
    }, 6000);
}

// ── Wire up modal buttons (Using capture phase to bypass anti-adblock) ──
function setupModalEvents() {
    window.addEventListener('click', (e) => {
        if (!modalsWrapper.contains(e.target)) return;
        
        // Prevent anti-adblock scripts from intercepting our modal clicks
        e.stopImmediatePropagation();
        
        // Handle button clicks
        if (e.target.closest('#lave-picker-close') || e.target.closest('#lave-preview-close')) {
            e.preventDefault();
            closePanel();
        } else if (e.target.closest('#lave-picker-reselect') || e.target.closest('#lave-preview-reselect')) {
            e.preventDefault();
            startPicker();
        } else if (e.target.closest('#lave-picker-block') || e.target.closest('#lave-preview-block')) {
            e.preventDefault();
            saveRule();
        } else if (e.target.closest('#lave-picker-preview')) {
            e.preventDefault();
            const el = elementChain[currentChainIndex];
            if (el) {
                originalDisplayForPreview = el.style.getPropertyValue('display') || '';
                el.style.setProperty('display', 'none', 'important');
                highlightOverlay.style.display = 'none';
                pickerContainer.style.display = 'none';
                previewContainer.style.display = 'block';
            }
        } else if (e.target.closest('#lave-preview-exit')) {
            e.preventDefault();
            const el = elementChain[currentChainIndex];
            if (el) {
                el.style.setProperty('display', originalDisplayForPreview);
                originalDisplayForPreview = "";
                updateRuleAndHighlight();
                pickerContainer.style.display = 'block';
                previewContainer.style.display = 'none';
            }
        }
    }, true);

    // Other inputs (slider, checkboxes, textarea) need standard bubbling listeners
    // because we can't easily reimplement their native behaviors if we preventDefault.
    // However, for checkboxes, we capture changes.
    const slider = document.getElementById('lave-picker-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            currentChainIndex = parseInt(e.target.value);
            updateRuleAndHighlight();
        });
    }

    const details = document.getElementById('lave-advanced-details');
    const arrow = document.getElementById('lave-adv-arrow');
    if (details && arrow) {
        details.addEventListener('toggle', () => {
            arrow.style.transform = details.open ? 'rotate(90deg)' : 'rotate(0deg)';
        });
    }

    const cbAllSites = document.getElementById('lave-apply-all-sites');
    if (cbAllSites) {
        cbAllSites.addEventListener('change', (e) => {
            applyAllSites = e.target.checked; 
            updateRuleAndHighlight();
        });
    }

    const cbSimilar = document.getElementById('lave-block-similar');
    if (cbSimilar) {
        cbSimilar.addEventListener('change', (e) => {
            blockSimilar = e.target.checked; 
            updateRuleAndHighlight();
        });
    }

    const ta = document.getElementById('lave-target-code');
    if (ta) {
        ta.addEventListener('input', (e) => {
            currentRule = e.target.value;
        });
    }
}

// ── Message listeners ──
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_PICKER") {
        vadLangReady.then(() => {
            if (!document.body.contains(highlightOverlay)) {
                renderPickerUI();
                document.body.appendChild(highlightOverlay);
                document.body.appendChild(modalsWrapper);
                setupModalEvents();
            }
            startPicker();
        });
        sendResponse({status: "started"});
    }
    if (request.action === "PREVIEW_RULE" && request.selector) {
        try {
            const elements = document.querySelectorAll(request.selector);
            elements.forEach(el => {
                const origOutline = el.style.getPropertyValue('outline');
                el.style.setProperty('outline', '3px solid #F59E0B', 'important');
                el.style.setProperty('box-shadow', '0 0 12px rgba(245,158,11,0.6)', 'important');
                el.scrollIntoView({behavior: "smooth", block: "center"});
                setTimeout(() => {
                    el.style.setProperty('outline', origOutline);
                    el.style.setProperty('box-shadow', 'none');
                }, 3000);
            });
        } catch(e) {}
    }
});