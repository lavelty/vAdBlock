// anti_adblock.js — "reklam engelleyici tespit edildi" duvarlarini metin bazli gizler.
(() => {
  'use strict';
  const WALL_TEXT = /reklam engelleyici|adblock|ad block|ad-block|ublock|adguard|disable for futbin|var is checking/i;
  const CTA_TEXT = /devam et|reklam|disable|whitelist|kapat|allow/i;

  function hideWall(el) {
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('data-vadblock-hidden', '1');
    
    // Sitenin kaydırmasını kilitleyen stilleri aç
    if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
    if (document.documentElement) document.documentElement.style.setProperty('overflow', 'auto', 'important');
  }

  function scan() {
    // 1. Admiral Image bypass
    const admiralImgs = document.querySelectorAll('img[src*="getadmiral.com"]');
    admiralImgs.forEach(img => {
        let target = img;
        while (target && target.parentElement && target.parentElement.tagName !== 'BODY' && target.parentElement.tagName !== 'HTML' && target.parentElement.id !== 'root' && target.parentElement.id !== '__next' && target.parentElement.id !== 'app') {
            target = target.parentElement;
        }
        if (target && !target.getAttribute('data-vadblock-hidden')) {
            hideWall(target);
        }
    });

    // 2. Text based bypass
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, button');
    elements.forEach(el => {
        // Sadece en alt seviyedeki veya az cocuklu elementlerin metnine bakalim (gereksiz islemden kacinmak icin)
        if (el.children.length > 3) return;
        
        const text = (el.innerText || el.textContent || '').toLowerCase();
        
        let isMatch = false;
        if (text.includes('var is checking') || text.includes('disable for futbin') || text.includes('red card for ad blocking')) {
            isMatch = true;
        } else if (WALL_TEXT.test(text) && CTA_TEXT.test(text)) {
            isMatch = true;
        }

        if (isMatch) {
            let target = el;
            let depth = 0;
            // Sadece belirli bir derinliğe kadar çık (tüm sayfayı gizlememek için)
            while (target && target.parentElement && target.parentElement.tagName !== 'BODY' && target.parentElement.tagName !== 'HTML' && target.parentElement.id !== 'root' && target.parentElement.id !== '__next' && target.parentElement.id !== 'app' && depth < 5) {
                target = target.parentElement;
                depth++;
            }
            if (target && !target.getAttribute('data-vadblock-hidden')) {
                // Eğer hedef element sayfanın %70'inden fazlasını kaplıyorsa gizleme (yanlış pozitif)
                const rect = target.getBoundingClientRect();
                const viewportArea = window.innerWidth * window.innerHeight;
                if (rect.width * rect.height < viewportArea * 0.7) {
                    hideWall(target);
                }
            }
        }
    });
  }

  const observer = new MutationObserver(() => {
    const now = Date.now();
    if (window.__vadblockLastScan && now - window.__vadblockLastScan < 800) return;
    window.__vadblockLastScan = now;
    scan();
  });

  function start() {
    scan();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // Keep observer running infinitely for SPAs (no disconnect timeout)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
