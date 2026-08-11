
  // ── Koruma seviyesi seçici ──
  const levelSelector = document.getElementById('levelSelector');
  if (levelSelector) {
    function updatePill() {
      const activeBtn = levelSelector.querySelector('.level-btn.active');
      const pill = document.getElementById('levelPill');
      if (activeBtn && pill) {
        pill.style.width = activeBtn.offsetWidth + 'px';
        pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
      }
    }

    chrome.storage.local.get({ protectionLevel: 'balanced' }, (r) => {
      levelSelector.querySelectorAll('.level-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.level === r.protectionLevel);
      });
      setTimeout(updatePill, 50); // allow layout to calculate
    });

    levelSelector.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        levelSelector.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updatePill();
        const level = btn.dataset.level;
        chrome.storage.local.set({ protectionLevel: level }, () => {
          chrome.storage.sync.set({ protectionLevel: level });
          showToast(window.vAdBlockT('toast_protection_updated') || 'Koruma seviyesi güncellendi');
        });
      });
    });
  }

  // ── Action Buttons ──
  const btnAddSegment = document.getElementById('btnAddSegment');
  if (btnAddSegment) {
    btnAddSegment.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes('youtube.com/watch')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'openSponsorMenu' }, (resp) => {
            if (chrome.runtime.lastError) {
              showToast('YouTube sayfasını yenileyin.', true);
            } else {
              window.close();
            }
          });
        } else {
          showToast('Bu özellik sadece YouTube videolarında çalışır.', true);
        }
      });
    });
  }

  document.getElementById('btnManualBlock').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'START_PICKER' }, (resp) => {
          if (chrome.runtime.lastError) {
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              files: ['js/picker.js']
            }, () => {
              if (chrome.runtime.lastError) {
                showToast(window.vAdBlockT('toast_page_not_available') || 'Bu sayfada kullanılamaz (Chrome koruması)', true);
              } else {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'START_PICKER' });
                window.close();
              }
            });
          } else { window.close(); }
        });
      }
    });
  });

  // ── Clear Site Rules ──
  document.getElementById('btnClearSiteRules').addEventListener('click', () => {
    if (!currentDomain) { showToast(window.vAdBlockT('toast_site_info_failed') || 'Site bilgisi alınamadı', true); return; }
    chrome.storage.local.get({ userRules: [] }, (r) => {
      const before = r.userRules.length;
      const after = r.userRules.filter(rule => {
        const parts = rule.split('##');
        return parts[0] !== currentDomain;
      });
      if (after.length < before) {
        chrome.storage.local.set({ userRules: after }, () => {
          showToast(window.vAdBlockT('toast_rules_cleared', [String(before - after.length)]) || `${before - after.length} kural temizlendi. Sayfa yenileniyor...`);
          setTimeout(() => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
              if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
          }, 800);
        });
      } else {
        showToast(window.vAdBlockT('toast_no_rules_site') || 'Bu sitede kural yok', true);
      }
    });
  });

  // ── Rules Overlay ──
  const overlay = document.getElementById('rulesOverlay');
