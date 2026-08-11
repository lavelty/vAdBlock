// space_remover.js - Akıllı Boşluk Silici
(() => {
    'use strict';

    if (window.__vadSpaceRemoverActive) return;
    window.__vadSpaceRemoverActive = true;

    const AD_CONTAINER_SELECTORS = [
        '[id^="div-gpt-ad"]',
        '.adsbygoogle',
        '.ad-container',
        '.ad-slot',
        '.banner-ad',
        'ins.adsbygoogle',
        'iframe[src*="doubleclick"]',
        'iframe[src*="googleads"]',
        'iframe[id^="google_ads_iframe"]',
        '.GoogleActiveViewElement',
        '[data-google-query-id]'
    ].join(',');

    function checkAndHide(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches(AD_CONTAINER_SELECTORS)) {
                // Sadece içerisinde metin (içerik) barındırmayan kutuları sil
                const style = window.getComputedStyle(node);
                if (style.display !== 'none') {
                    const textContent = node.innerText || node.textContent;
                    if (!textContent || textContent.trim() === '') {
                        node.style.setProperty('display', 'none', 'important');
                        node.setAttribute('data-vad-removed', 'true');
                    }
                }
            } else {
                node.querySelectorAll(AD_CONTAINER_SELECTORS).forEach(checkAndHide);
            }
        }
    }

    if (document.body) checkAndHide(document.body);

    const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
            mut.addedNodes.forEach(node => {
                checkAndHide(node);
            });
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
