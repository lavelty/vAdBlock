const fs = require('fs');

// Ortak seçici listeleri (dark tabanlı temalar icin)
const BRIGHT = `h1, h2, h3, .logo-area span, .brand-name, .checkbox-label, .feature-info h3,
.feature-card h3, .filter-list-name, .domain-name, .overlay-header h3, .rule-card,
.rule-item .domain, .status-main, .brand-title, .top-domain-name`;
const MUTED = `.subtitle, .feature-info p, .feature-card p, .filter-list-desc,
.filter-counts, .premium-section-title, .domain-text, .rule-selector, .status-sub,
.stat-list-item .label, .bl-url, .select-trigger, .tab-btn, .empty-state,
.mode-card .mode-desc, .pause-menu-title, .top-domain-count, .top-domain-rank,
.report-stat-label, .range-btn`;

function darkTheme(name, bg, surface, surface2, border, bright, muted, accent, accent2, soft) {
    return `
/* ============ ${name.toUpperCase()} ============ */
body[data-theme="${name}"] {
    background-color: ${bg} !important;
    color: ${bright} !important;
}
body[data-theme="${name}"] .background-mesh { background: ${bg} !important; }
body[data-theme="${name}"] .blob-1 { background: ${soft} !important; opacity: 0.55 !important; }
body[data-theme="${name}"] .blob-2 { background: ${soft} !important; opacity: 0.55 !important; }
body[data-theme="${name}"] .blob-3 { background: ${soft} !important; opacity: 0.55 !important; }

/* Surfaces */
body[data-theme="${name}"] .glass-card {
    background: rgba(0, 0, 0, 0.28) !important;
    border-color: ${border} !important;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04) inset !important;
}
body[data-theme="${name}"] .sidebar { background: rgba(0, 0, 0, 0.4) !important; border-color: ${border} !important; }
body[data-theme="${name}"] .feature-card,
body[data-theme="${name}"] .stat-box,
body[data-theme="${name}"] .whitelist-item,
body[data-theme="${name}"] .mode-card,
body[data-theme="${name}"] .theme-card,
body[data-theme="${name}"] .report-stat {
    background: ${surface} !important;
    border-color: ${border} !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25) !important;
}
body[data-theme="${name}"] .feature-card:hover { background: ${surface2} !important; }

body[data-theme="${name}"] .popup { background: ${bg} !important; }
body[data-theme="${name}"] .header { background: ${surface} !important; border-color: ${border} !important; }
body[data-theme="${name}"] .shield-card,
body[data-theme="${name}"] .action-btn,
body[data-theme="${name}"] .stat-list-item,
body[data-theme="${name}"] .chart-section {
    background: ${surface} !important;
    border-color: ${border} !important;
    box-shadow: none !important;
    color: ${bright} !important;
}
body[data-theme="${name}"] .action-btn:hover,
body[data-theme="${name}"] .stat-list-item:hover { background: ${surface2} !important; }
body[data-theme="${name}"] .action-btn .arrow { background: rgba(255, 255, 255, 0.08) !important; color: ${muted} !important; }
body[data-theme="${name}"] .action-btn:hover .arrow { background: rgba(255, 255, 255, 0.12) !important; color: ${bright} !important; }

/* Text */
body[data-theme="${name}"] ${BRIGHT} { color: ${bright} !important; }
body[data-theme="${name}"] ${MUTED} { color: ${muted} !important; }
body[data-theme="${name}"] .footer { color: #5B6472 !important; }
body[data-theme="${name}"] .mode-card .mode-title { color: ${bright} !important; }
body[data-theme="${name}"] .theme-name { color: ${bright} !important; }

/* Nav */
body[data-theme="${name}"] .nav-item { color: ${muted} !important; }
body[data-theme="${name}"] .nav-item:hover { background: rgba(255, 255, 255, 0.06) !important; color: ${bright} !important; }
body[data-theme="${name}"] .nav-item.active {
    background: ${soft} !important;
    color: ${accent} !important;
    box-shadow: none !important;
}
body[data-theme="${name}"] .premium-link { color: ${accent} !important; }
body[data-theme="${name}"] .premium-link:hover,
body[data-theme="${name}"] .premium-link.active { background: ${soft} !important; color: ${bright} !important; }
body[data-theme="${name}"] .separator { background: ${border} !important; }

/* Inputs & buttons */
body[data-theme="${name}"] input[type="text"],
body[data-theme="${name}"] textarea,
body[data-theme="${name}"] .language-select {
    background: rgba(0, 0, 0, 0.3) !important;
    color: ${bright} !important;
    border-color: ${border} !important;
    box-shadow: none !important;
}
body[data-theme="${name}"] input[type="text"]:focus,
body[data-theme="${name}"] textarea:focus,
body[data-theme="${name}"] .language-select:focus { border-color: ${accent} !important; }
body[data-theme="${name}"] input[type="text"]::placeholder,
body[data-theme="${name}"] textarea::placeholder { color: ${muted} !important; }
body[data-theme="${name}"] .primary-button { background: ${accent} !important; color: #FFFFFF !important; }
body[data-theme="${name}"] .primary-button:hover { background: ${accent2} !important; box-shadow: 0 10px 25px -5px ${soft} !important; }
body[data-theme="${name}"] .primary-button.secondary { background: ${surface2} !important; color: ${bright} !important; }
body[data-theme="${name}"] .primary-button.secondary:hover { background: ${surface2} !important; }

/* Arama kutusu */
body[data-theme="${name}"] .search-box {
    background: rgba(0, 0, 0, 0.3) !important;
    border-color: ${border} !important;
    color: ${muted} !important;
}
body[data-theme="${name}"] .search-box input { color: ${bright} !important; }
body[data-theme="${name}"] .search-box input::placeholder { color: ${muted} !important; }

/* Filtre otomatik guncelleme statusu */
body[data-theme="${name}"] .filter-auto-status { background: rgba(16, 185, 129, 0.18) !important; color: #6EE7B7 !important; }
body[data-theme="${name}"] .filter-auto-status.stale { background: rgba(245, 158, 11, 0.18) !important; color: #FCD34D !important; }

/* Icon buttons: arka plan yok, sadece ikon animasyonu */
body[data-theme="${name}"] .icon-btn { color: ${muted} !important; background: transparent !important; }
body[data-theme="${name}"] .icon-btn:hover,
body[data-theme="${name}"] .icon-btn:focus-visible { color: ${bright} !important; background: transparent !important; }
body[data-theme="${name}"] #btnPause.active { color: ${accent} !important; background: transparent !important; }

/* Checkboxes & switches */
body[data-theme="${name}"] .checkmark { background: rgba(0, 0, 0, 0.3) !important; border-color: ${surface2} !important; }
body[data-theme="${name}"] .checkbox-label input:checked ~ .checkmark { background-color: ${accent} !important; border-color: ${accent} !important; }
body[data-theme="${name}"] .slider { background-color: ${surface2} !important; }
body[data-theme="${name}"] .slider:before { background-color: ${bright} !important; }

/* Toggle (popup) */
body[data-theme="${name}"] .toggle-track { background: ${surface2} !important; }
body[data-theme="${name}"] .toggle-thumb { background: ${bright} !important; }
body[data-theme="${name}"] .toggle-container.active .toggle-track {
    background: linear-gradient(135deg, ${accent}, ${accent2}) !important;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 12px ${soft} !important;
}

/* Tabs & dropdowns (popup) */
body[data-theme="${name}"] .tab-control { background: rgba(255, 255, 255, 0.06) !important; }
body[data-theme="${name}"] .tab-btn.active { background: ${surface2} !important; color: ${bright} !important; box-shadow: none !important; }
body[data-theme="${name}"] .select-trigger { background: rgba(255, 255, 255, 0.06) !important; }
body[data-theme="${name}"] .select-menu { background: ${surface2} !important; border-color: ${border} !important; }
body[data-theme="${name}"] .select-item { color: ${muted} !important; }
body[data-theme="${name}"] .select-item:hover { background: rgba(255, 255, 255, 0.05) !important; }
body[data-theme="${name}"] .select-item.active { color: ${accent} !important; }
body[data-theme="${name}"] .chart-labels { color: ${muted} !important; }
body[data-theme="${name}"] .stat-list-item .val { color: ${bright} !important; background: rgba(255, 255, 255, 0.08) !important; }

/* Level selector & pause menu */
body[data-theme="${name}"] .level-btn { background: rgba(255, 255, 255, 0.06) !important; color: ${muted} !important; border-color: ${border} !important; }
body[data-theme="${name}"] .level-btn:hover { background: rgba(255, 255, 255, 0.1) !important; color: ${bright} !important; }
body[data-theme="${name}"] .level-btn.active { background: ${accent} !important; color: #FFFFFF !important; border-color: transparent !important; box-shadow: none !important; }
body[data-theme="${name}"] .pause-menu { background: ${surface2} !important; border-color: ${border} !important; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5) !important; }
body[data-theme="${name}"] .pause-menu-item { color: ${bright} !important; }
body[data-theme="${name}"] .pause-menu-item:hover { background: ${soft} !important; }
body[data-theme="${name}"] .pause-menu-sep { background: ${border} !important; }
body[data-theme="${name}"] .pause-menu-item.resume { color: #34D399 !important; }
body[data-theme="${name}"] .pause-menu-item.resume:hover { background: rgba(5, 150, 105, 0.15) !important; }

/* Selected states (theme-aware) */
body[data-theme="${name}"] .mode-card.selected {
    border-color: ${accent} !important;
    box-shadow: 0 4px 14px ${soft} !important;
}
body[data-theme="${name}"] .mode-card.selected .mode-title { color: ${accent} !important; }
body[data-theme="${name}"] .theme-card.selected {
    border-color: ${accent} !important;
    box-shadow: 0 4px 16px ${soft} !important;
}
body[data-theme="${name}"] .theme-card.selected .theme-check { background: ${accent} !important; color: #FFFFFF !important; }
body[data-theme="${name}"] .range-btn.active { background: ${surface2} !important; color: ${bright} !important; box-shadow: none !important; }
body[data-theme="${name}"] .top-domain-bar-track { background: rgba(255, 255, 255, 0.08) !important; }
body[data-theme="${name}"] .theme-palette span { border-color: rgba(255, 255, 255, 0.22) !important; }
body[data-theme="${name}"] .report-stat-value { color: ${accent} !important; }
body[data-theme="${name}"] .empty-illustration svg { stroke: ${muted} !important; }
body[data-theme="${name}"] .theme-preview { background: rgba(0, 0, 0, 0.6) !important; }

/* Misc */
body[data-theme="${name}"] .stat-box div[style*="475569"] { color: ${muted} !important; }
body[data-theme="${name}"] .stat-box div[style*="64748B"] { color: ${muted} !important; }
body[data-theme="${name}"] .stat-box div[style*="334155"] { color: ${muted} !important; }
body[data-theme="${name}"] .stat-box div[style*="1E293B"] { color: ${muted} !important; }
body[data-theme="${name}"] .stat-box div[style*="0F172A"] { color: ${bright} !important; }
body[data-theme="${name}"] .status-sub #protectionState { color: #34D399 !important; }
body[data-theme="${name}"] .shield-card.off .status-sub #protectionState { color: #F87171 !important; }
body[data-theme="${name}"] .feature-icon { background: ${soft} !important; color: ${accent} !important; }
body[data-theme="${name}"] .premium-upsell { background: ${soft} !important; border-color: ${soft} !important; }
body[data-theme="${name}"] .premium-upsell p { color: ${accent} !important; }
body[data-theme="${name}"] .block-log { background: rgba(0, 0, 0, 0.3) !important; border-color: ${border} !important; }
body[data-theme="${name}"] .block-log-item:nth-child(odd) { background: rgba(255, 255, 255, 0.03) !important; }
body[data-theme="${name}"] .bl-time { color: ${muted} !important; }
body[data-theme="${name}"] .bl-host { color: ${accent} !important; }
body[data-theme="${name}"] .filter-list-row { border-bottom-color: ${border} !important; }
body[data-theme="${name}"] code { background: ${soft} !important; color: ${accent} !important; }

/* Welcome page extras */
body[data-theme="${name}"] .icon-wrapper { background: ${surface} !important; box-shadow: none !important; }
body[data-theme="${name}"] .f-icon { background: ${surface2} !important; color: ${accent} !important; }
body[data-theme="${name}"] .primary-btn { background: ${accent} !important; color: #FFFFFF !important; }
body[data-theme="${name}"] .primary-btn:hover { background: ${accent2} !important; box-shadow: 0 10px 25px -5px ${soft} !important; }

/* Overlay & toast */
body[data-theme="${name}"] .rules-overlay { background: ${bg} !important; }
body[data-theme="${name}"] .overlay-header { background: ${surface} !important; border-color: ${border} !important; }
body[data-theme="${name}"] .rule-item { background: ${surface} !important; border-color: ${border} !important; }
body[data-theme="${name}"] .rule-domain { color: ${accent} !important; }
body[data-theme="${name}"] .toast { background: ${surface2} !important; color: ${bright} !important; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important; }
`;
}

function lightAccentTheme(name, bg, color, surface, accent, accentSoft) {
    return `
/* ============ ${name.toUpperCase()} ============ */
body[data-theme="${name}"] {
    background-color: ${bg} !important;
    color: ${color} !important;
}
body[data-theme="${name}"] .glass-card,
body[data-theme="${name}"] .pane,
body[data-theme="${name}"] .sidebar,
body[data-theme="${name}"] .shield-card,
body[data-theme="${name}"] .action-btn,
body[data-theme="${name}"] .stat-list-item,
body[data-theme="${name}"] .chart-section {
    background: ${surface} !important;
    border-color: ${accentSoft} !important;
}
body[data-theme="${name}"] .background-mesh { background: ${bg} !important; }
body[data-theme="${name}"] .blob-1 { background: ${accentSoft} !important; }
body[data-theme="${name}"] .blob-2 { background: ${accentSoft} !important; }
body[data-theme="${name}"] .blob-3 { background: ${accentSoft} !important; }
body[data-theme="${name}"] h1,
body[data-theme="${name}"] h2,
body[data-theme="${name}"] h3,
body[data-theme="${name}"] .nav-item.active,
body[data-theme="${name}"] .brand-title,
body[data-theme="${name}"] .logo-area span { color: ${accent} !important; }

body[data-theme="${name}"] .nav-item { color: #1E293B !important; }
body[data-theme="${name}"] .nav-item:hover { color: #0F172A !important; background: rgba(6, 182, 212, 0.06) !important; }
body[data-theme="${name}"] .subtitle,
body[data-theme="${name}"] .feature-info p,
body[data-theme="${name}"] .mode-card .mode-desc,
body[data-theme="${name}"] .checkbox-label,
body[data-theme="${name}"] .filter-list-desc,
body[data-theme="${name}"] .filter-counts,
body[data-theme="${name}"] .bl-url { color: #1E293B !important; }
body[data-theme="${name}"] .premium-section-title,
body[data-theme="${name}"] .empty-state,
body[data-theme="${name}"] .bl-time,
body[data-theme="${name}"] .status-sub,
body[data-theme="${name}"] .chart-labels,
body[data-theme="${name}"] .no-rules { color: #334155 !important; }

body[data-theme="${name}"] .mode-card.selected,
body[data-theme="${name}"] .theme-card.selected {
    border-color: ${accent} !important;
    box-shadow: 0 4px 16px ${accentSoft} !important;
}
body[data-theme="${name}"] .mode-card.selected .mode-title,
body[data-theme="${name}"] .theme-card.selected .theme-check { color: ${accent} !important; }
body[data-theme="${name}"] .theme-card.selected .theme-check { background: ${accent} !important; color: #FFFFFF !important; }

body[data-theme="${name}"] .icon-btn { background: transparent !important; color: #475569 !important; }
body[data-theme="${name}"] .icon-btn:hover,
body[data-theme="${name}"] .icon-btn:focus-visible { color: ${accent} !important; background: transparent !important; }
body[data-theme="${name}"] #btnPause.active { color: ${accent} !important; background: transparent !important; }

body[data-theme="${name}"] .search-box { background: rgba(255, 255, 255, 0.7) !important; border-color: ${accentSoft} !important; color: #64748B !important; }
body[data-theme="${name}"] .search-box input { color: #0F172A !important; }
body[data-theme="${name}"] .language-select { background: rgba(255, 255, 255, 0.8) !important; color: #0F172A !important; border-color: ${accentSoft} !important; }
body[data-theme="${name}"] .filter-auto-status { background: rgba(16, 185, 129, 0.12) !important; color: #047857 !important; }
body[data-theme="${name}"] .filter-auto-status.stale { background: rgba(245, 158, 11, 0.15) !important; color: #B45309 !important; }
body[data-theme="${name}"] .empty-illustration svg { stroke: #64748B !important; }

body[data-theme="${name}"] .level-btn { background: rgba(6, 182, 212, 0.08) !important; color: ${accent} !important; border-color: ${accentSoft} !important; }
body[data-theme="${name}"] .level-btn:hover { background: rgba(6, 182, 212, 0.16) !important; }
body[data-theme="${name}"] .level-btn.active { background: ${accent} !important; color: #FFFFFF !important; border-color: transparent !important; box-shadow: none !important; }
`;
}

let themeCss = `/* --- THEMES --- */
`;

themeCss += darkTheme(
    'dark',
    '#0E1015', '#171A21', '#232836',
    'rgba(255, 255, 255, 0.08)',
    '#EDEFF3', '#9CA3B0',
    '#8B5CF6', '#9F6FF7', 'rgba(139, 92, 246, 0.35)'
);

themeCss += darkTheme(
    'midnight',
    '#0B1120', '#111A2E', '#1B2540',
    'rgba(148, 163, 184, 0.14)',
    '#E2E8F0', '#94A3B8',
    '#818CF8', '#60A5FA', 'rgba(129, 140, 248, 0.32)'
);

themeCss += darkTheme(
    'forest',
    '#0B1210', '#101B16', '#1A2A22',
    'rgba(134, 239, 172, 0.13)',
    '#E7F5EC', '#86A79A',
    '#34D399', '#10B981', 'rgba(52, 211, 153, 0.30)'
);

themeCss += lightAccentTheme(
    'ocean',
    '#ECFEFF', '#083344', 'rgba(255, 255, 255, 0.6)',
    '#0891B2', 'rgba(6, 182, 212, 0.25)'
);

function stripOldThemes(css) {
    css = css.replace(/body\[data-theme=[^{]*\{[^}]*\}[;]?/g, '');
    css = css.replace(/\/\*[^*]*(?:THEMES|Karanlik tema|Karanlık tema)[^*]*\*\//g, '');
    css = css.replace(/\n{3,}/g, '\n\n');
    css = css.replace(/[ \t]+\n/g, '\n');
    return css.trimEnd() + '\n';
}

['css/options.css', 'css/popup.css', 'css/welcome.css'].forEach(file => {
    let css = fs.readFileSync(file, 'utf8');
    css = stripOldThemes(css);
    css += themeCss;
    fs.writeFileSync(file, css, 'utf8');
});
console.log('Done CSS');

const jsFiles = ['js/popup.js', 'js/welcome.js'];
jsFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('data-theme')) {
        const themeInjection = `
// Theme loading
chrome.storage.local.get({ theme: 'default' }, (r) => {
    document.body.setAttribute('data-theme', r.theme);
});
`;
        content = themeInjection + '\n' + content;
        fs.writeFileSync(file, content, 'utf8');
    }
});
console.log('Done JS');
