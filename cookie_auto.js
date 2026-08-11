// cookie_auto.js — cookie onayi bannerlarini otomatik reddetmeye veya gizlemeye calisir.
(function () {
    'use strict';

    // Kelime havuzlari
    const REJECT_RE = /^(reject|reject all|decline|deny|kabul etme|tümünü reddet|reddet|sadece zorunlular|necessary only|essential only|refuse|disagree|hayır|no|cancel)$/i;
    const ACCEPT_RE = /^(accept|accept all|accept cookies|allow|allow all|agree|ok|okay|got it|kabul et|kabul|onayla|anladım|tamam|akzeptieren|aceitar|acepto|accepter|принять|agree)$/i;
    
    // Konteyner tespiti icin ipuclari
    const HINT_RE = /cookie|consent|gdpr|cmp|privacy|notice|banner|onetrust|sp-cc|didomi|quantcast|usercentrics|trustarc|cookiebot/i;

    function closestContainer(btn) {
        let el = btn;
        for (let depth = 0; el && depth < 8; depth++) {
            el = el.parentElement;
            if (!el) return null;
            const id = (el.id || '') + ' ' + (el.className && typeof el.className === 'string' ? el.className : '');
            if (HINT_RE.test(id)) return el;
        }
        return null;
    }

    function tryRejectOrHide() {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a.btn, a.button, input[type="submit"], input[type="button"]'));
        
        let rejectBtn = null;
        let acceptBtn = null;

        for (const btn of buttons) {
            const text = (btn.innerText || btn.textContent || '').trim();
            if (!text || text.length > 60) continue;
            
            const firstLine = text.split(/\n|\|/)[0].trim();
            
            if (REJECT_RE.test(firstLine)) {
                rejectBtn = btn;
                break; // İlk reddet butonunu bulduysan dur
            } else if (!acceptBtn && ACCEPT_RE.test(firstLine)) {
                acceptBtn = btn; // Reddet butonu yoksa diye kabul butonunu kenara ayır (konteyner bulmak için)
            }
        }

        // 1. Senaryo: Reddet butonu bulundu
        if (rejectBtn) {
            try { rejectBtn.click(); } catch (e) {}
            // Yine de kutuyu gizleyelim, bazen tiklaninca kapanmasi uzun surer
            const container = closestContainer(rejectBtn);
            if (container) {
                container.style.setProperty('display', 'none', 'important');
            }
            return true;
        }

        // 2. Senaryo: Reddet butonu yok (Kötü Niyetli Tasarım), sadece Kabul Et var
        // Bu durumda kabul et butonuna TIKLAMADAN direkt ebeveyn konteyneri gizle
        if (acceptBtn) {
            const container = closestContainer(acceptBtn);
            if (container) {
                container.style.setProperty('display', 'none', 'important');
                container.setAttribute('data-vadblock-hidden-cookie', '1');
                
                // Sayfanin scroll kilidi varsa ac
                if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
                if (document.documentElement) document.documentElement.style.setProperty('overflow', 'auto', 'important');
                return true;
            }
        }

        // 3. Senaryo: Olası genel cookie banner'lari (buton bulamasak bile class/id ile)
        const possibleBanners = document.querySelectorAll('div[id*="cookie"], div[class*="cookie"], div[id*="consent"], div[class*="consent"]');
        for (const banner of possibleBanners) {
            const style = window.getComputedStyle(banner);
            if (style.position === 'fixed' || style.position === 'absolute' || style.position === 'sticky') {
                const text = (banner.innerText || '').toLowerCase();
                if (text.includes('cookie') || text.includes('çerez') || text.includes('gdpr')) {
                    banner.style.setProperty('display', 'none', 'important');
                    if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
                    if (document.documentElement) document.documentElement.style.setProperty('overflow', 'auto', 'important');
                    return true;
                }
            }
        }

        return false;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 15; // Cok gec yuklenen siteler icin

    function attempt() {
        if (attempts >= MAX_ATTEMPTS) return;
        attempts++;
        if (tryRejectOrHide()) return;

        if (attempts < MAX_ATTEMPTS) {
            setTimeout(attempt, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attempt);
    } else {
        attempt();
    }

    let observer = null;
    try {
        observer = new MutationObserver(() => {
            if (attempts >= MAX_ATTEMPTS) { if (observer) observer.disconnect(); return; }
            if (tryRejectOrHide()) { if (observer) observer.disconnect(); }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
})();
