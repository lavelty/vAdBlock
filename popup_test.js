
// Theme loading
chrome.storage.local.get({ theme: 'default' }, (r) => {
    document.body.setAttribute('data-theme', r.theme);
});

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const domainText = document.getElementById('domainText');
  const shieldCard = document.getElementById('shieldCard');
  const powerBtn = document.getElementById('powerBtn');
  const pageBlockedCount = document.getElementById('pageBlockedCount');
  const totalBlockedCount = document.getElementById('totalBlockedCount');
  const protectionState = document.getElementById('protectionState');
  
  const tabActions = document.getElementById('tabActions');
  const tabStats = document.getElementById('tabStats');
  
  const viewActions = document.getElementById('viewActions');
  const viewStats = document.getElementById('viewStats');
  
  const headerActions = document.getElementById('headerActions');
  const headerStats = document.getElementById('headerStats');
  
  
  
  const statAds = document.getElementById('statAds');
  const statTrackers = document.getElementById('statTrackers');
  const statCdn = document.getElementById('statCdn');
  const statOther = document.getElementById('statOther');
  
  const toast = document.getElementById('toast');
  const pauseWrap = document.getElementById('pauseWrap');
  const pauseBtn = document.getElementById('btnPause');
  const pauseMenu = document.getElementById('pauseMenu');
  let currentDomain = '';

  // ── Site Rules Check ──
  function checkSiteRules() {
    if (!currentDomain) return;
    chrome.storage.local.get({ userRules: [] }, (r) => {
      // Feature: Check if site has rules, no longer hides the button.
    });
  }

  // Listen for rule changes (e.g. from picker)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.userRules) checkSiteRules();
  });

  // ── Domain ──
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');
        domainText.textContent = currentDomain;
      } catch(e) {
        domainText.textContent = window.vAdBlockT('popup_unknown') || 'Bilinmeyen';
      }
    } else {
      domainText.textContent = window.vAdBlockT('popup_unknown') || 'Bilinmeyen';
    }
    checkSiteRules();
    updatePowerBtnState();
  });

  // 🎯 Protection Toggle 🎯
  let pauseCountdownTimer = null;
  function clearPauseCountdown() {
    if (pauseCountdownTimer) { clearInterval(pauseCountdownTimer); pauseCountdownTimer = null; }
  }
  function renderPauseCountdown() {
    chrome.storage.local.get({ pauseUntil: 0 }, (r) => {
      if (!r.pauseUntil) return;
      const remain = r.pauseUntil - Date.now();
      if (remain <= 0) { setUI(true); return; }
      const mins = Math.floor(remain / 60000);
      const secs = Math.floor((remain % 60000) / 1000);
      const state = window.vAdBlockT('pause_paused_state') || 'Duraklatıldı';
      const mUnit = window.vAdBlockT('pause_min_unit') || 'dk';
      const sUnit = window.vAdBlockT('pause_sec_unit') || 'sn';
      if (protectionState) protectionState.textContent = state + ' · ' + mins + ' ' + mUnit + ' ' + secs + ' ' + sUnit;
    });
  }
  function startPauseCountdown() {
    clearPauseCountdown();
    renderPauseCountdown();
    pauseCountdownTimer = setInterval(renderPauseCountdown, 1000);
  }

  function setUI(enabled) {
    const onText = window.vAdBlockT('popup_protection_on') || 'Koruma Açık';
    const offText = window.vAdBlockT('popup_protection_off') || 'Koruma Kapalı';
    if (pauseBtn) pauseBtn.classList.toggle('active', false);
    if (enabled) {
      clearPauseCountdown();
      shieldCard.classList.remove('off');
      powerBtn.classList.add('active');
      if (protectionState) protectionState.textContent = onText;
    } else {
      shieldCard.classList.add('off');
      powerBtn.classList.remove('active');
      chrome.storage.local.get({ pauseUntil: 0 }, (r) => {
        const paused = !!r.pauseUntil;
        if (pauseBtn) pauseBtn.classList.toggle('active', paused);
        if (paused) {
          startPauseCountdown();
        } else {
          clearPauseCountdown();
          if (protectionState) protectionState.textContent = offText;
        }
      });
    }
  }

  function updatePowerBtnState() {
    chrome.storage.local.get({ globalEnabled: true }, (r) => {
      if (!r.globalEnabled) {
          setUI(false);
          return;
      }
      if (currentDomain) {
          chrome.runtime.sendMessage({ type: 'GET_TEMP_SITE_STATUS', domain: currentDomain }, (until) => {
              const isPausedSite = until && until > Date.now();
              if (isPausedSite) {
                  setUI(false);
                  if (protectionState) protectionState.textContent = window.vAdBlockT('popup_paused_site') || 'Bu Sitede Duraklatıldı';
                  if (pauseBtn) pauseBtn.classList.add('active');
              } else {
                  setUI(true);
              }
          });
      } else {
          setUI(true);
      }
    });
  }

  powerBtn.addEventListener('click', () => {
    chrome.storage.local.get({ globalEnabled: true }, (r) => {
      const nextEnabled = !r.globalEnabled;
      
      chrome.storage.local.set({ globalEnabled: nextEnabled }, () => {
        chrome.runtime.sendMessage({ type: 'TOGGLE_PROTECTION', enabled: nextEnabled });
        setUI(nextEnabled);
        
        setTimeout(() => {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
          });
        }, 300);
      });
    });
  });

  // ── Tabs ──
  tabActions.addEventListener('click', () => {
    tabActions.classList.add('active');
    tabStats.classList.remove('active');
    viewActions.classList.add('active');
    viewStats.classList.remove('active');
    headerActions.classList.add('active');
    headerStats.classList.remove('active');
  });

  tabStats.addEventListener('click', () => {
    tabStats.classList.add('active');
    tabActions.classList.remove('active');
    viewStats.classList.add('active');
    viewActions.classList.remove('active');
    headerStats.classList.add('active');
    headerActions.classList.remove('active');
  });

  // ── Chart ──
  let currentHistoryData = null;
  let currentTimePeriod = '7d';
  let fullStats = null;

  function generateLabels(period, count) {
    const now = new Date();
    const labelData = [];

    if (period === '24h') {
      const currentHour = now.getHours();
      for (let i = 0; i < count; i++) {
        const hour = (currentHour - (count - 1 - i) + 24) % 24;
        const show = (i % 3 === 0) || (i === count - 1);
        labelData.push({ text: String(hour).padStart(2, '0'), show });
      }
    } else if (period === '7d') {
      const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const today = now.getDay();
      for (let i = 0; i < count; i++) {
        let dayIndex = (today - (count - 1 - i) + 7) % 7;
        labelData.push({ text: days[dayIndex], show: true });
      }
    } else if (period === '30d') {
      for (let i = 0; i < count; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (count - 1 - i));
        const dayNum = d.getDate();
        const show = (i % 3 === 0) || (i === count - 1);
        labelData.push({ text: String(dayNum), show });
      }
    } else if (period === '1y') {
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      const currentMonth = now.getMonth();
      for (let i = 0; i < count; i++) {
        const monthIdx = (currentMonth - (count - 1 - i) + 12) % 12;
        labelData.push({ text: months[monthIdx], show: true });
      }
    }
    return labelData;
  }

  function getDataForPeriod(period, chartType) {
    if (!fullStats) return null;
    if (period === '24h' && fullStats.hourly) return fullStats.hourly[chartType];
    if (period === '7d' && fullStats.history) return fullStats.history[chartType];
    if (period === '30d' && fullStats.monthly) return fullStats.monthly[chartType];
    if (period === '1y' && fullStats.yearly) return fullStats.yearly[chartType];
    return null;
  }

  function drawChart(historyDataArray) {
    const svg = document.getElementById('statsChart');
    const labels = document.getElementById('chartLabels');
    if (!svg || !labels || !historyDataArray || historyDataArray.length === 0) return;

    const count = historyDataArray.length;
    const maxVal = Math.max(...historyDataArray, 10);
    const width = svg.clientWidth || 270;
    const height = 112; // Matches CSS chart-body height
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const paddingX = 15;
    const chartWidth = width - (paddingX * 2);
    const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth;

    let pathD = `M ${paddingX} ${height}`;
    let lineD = '';
    
    // Clean old elements
    svg.querySelectorAll('.chart-grid-line, .chart-hit-point, .chart-point-dot').forEach(el => el.remove());

    const labelData = generateLabels(currentTimePeriod, count);
    let labelsHtml = '';

    const hitPoints = [];

    for (let i = 0; i < count; i++) {
      const val = historyDataArray[i];
      const x = paddingX + i * stepX;
      const y = height - ((val / maxVal) * height);
      
      if (i === 0) {
        lineD += `M ${x} ${y}`;
        pathD += ` L ${x} ${y}`;
      } else {
        const prevX = paddingX + (i - 1) * stepX;
        const prevY = height - ((historyDataArray[i-1] / maxVal) * height);
        const cpX = prevX + (x - prevX) / 2;
        lineD += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
        pathD += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }

      // Grid line (only at labeled points to avoid clutter)
      if (labelData[i] && labelData[i].show) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', height);
        line.setAttribute('class', 'chart-grid-line');
        line.setAttribute('id', `grid-line-${i}`);
        svg.insertBefore(line, svg.firstChild);
      }

      hitPoints.push({x, y, val, show: labelData[i] && labelData[i].show, index: i});

      // Label
      if (labelData[i] && labelData[i].show) {
        labelsHtml += `<span style="position:absolute; left:${x}px; transform:translateX(-50%); white-space:nowrap;">${labelData[i].text}</span>`;
      }
    }

    pathD += ` L ${paddingX + chartWidth} ${height} Z`;

    const chartArea = document.getElementById('chartArea');
    const chartLine = document.getElementById('chartLine');
    if(chartArea) chartArea.setAttribute('d', pathD);
    if(chartLine) chartLine.setAttribute('d', lineD);
    labels.innerHTML = labelsHtml;

    // Add interactive hit points only for shown labels
    const shownHitPoints = hitPoints.filter(p => p.show);
    
    shownHitPoints.forEach((pt, idx) => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', 4);
      dot.style.fill = 'var(--chart-color)';
      dot.setAttribute('class', 'chart-point-dot');
      dot.style.opacity = 0;
      dot.style.transition = 'opacity 0.2s';
      dot.style.pointerEvents = 'none';
      svg.appendChild(dot);

      // Hit area spans halfway to previous and next SHOWN point
      const prevPt = shownHitPoints[idx - 1];
      const nextPt = shownHitPoints[idx + 1];
      const startX = prevPt ? pt.x - (pt.x - prevPt.x) / 2 : 0;
      const endX = nextPt ? pt.x + (nextPt.x - pt.x) / 2 : width;
      const hitWidth = endX - startX;

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hit.setAttribute('x', startX);
      hit.setAttribute('y', 0);
      hit.setAttribute('width', hitWidth);
      hit.setAttribute('height', height);
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('class', 'chart-hit-point');
      hit.style.cursor = 'crosshair';
      
      hit.addEventListener('mouseenter', () => {
        dot.style.opacity = 1;
        dot.setAttribute('r', 5);
        
        const gridLine = document.getElementById(`grid-line-${pt.index}`);
        if (gridLine) {
          gridLine.style.stroke = 'rgba(16, 185, 129, 0.5)';
          gridLine.style.strokeWidth = '2';
        }

        const tooltip = document.getElementById('chartTooltip');
        if (tooltip) {
          tooltip.textContent = pt.val.toLocaleString('tr-TR');
          tooltip.style.left = pt.x + 'px';
          tooltip.style.top = pt.y + 'px';
          tooltip.style.opacity = 1;
        }
      });
      
      hit.addEventListener('mouseleave', () => {
        dot.style.opacity = 0;
        dot.setAttribute('r', 4);
        
        const gridLine = document.getElementById(`grid-line-${pt.index}`);
        if (gridLine) {
          gridLine.style.stroke = '';
          gridLine.style.strokeWidth = '';
        }

        const tooltip = document.getElementById('chartTooltip');
        if (tooltip) tooltip.style.opacity = 0;
      });
      svg.appendChild(hit);
    });
  }

  // ── Listen to Custom Dropdowns ──
  const setupDropdown = (id, onChange) => {
    const el = document.getElementById(id);
    if (!el) return;
    const trigger = el.querySelector('.select-trigger');
    const textSpan = el.querySelector('.trigger-text');
    const items = el.querySelectorAll('.select-item');
    
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select').forEach(d => {
        if (d !== el) d.classList.remove('open');
      });
      el.classList.toggle('open');
    });

    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const text = item.childNodes[0].textContent.trim();
        textSpan.textContent = text;
        el.classList.remove('open');
        if(onChange) onChange(item.dataset.value);
      });
    });
  };

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select').forEach(el => el.classList.remove('open'));
  });

  let currentChartType = 'total';
  
  setupDropdown('typeSelect', (val) => {
    currentChartType = val;
    const data = getDataForPeriod(currentTimePeriod, val);
    if (data) drawChart(data);
  });

  setupDropdown('timeSelect', (val) => {
    currentTimePeriod = val;
    const data = getDataForPeriod(val, currentChartType);
    if (data) drawChart(data);
  });

  // ── Stats ──
  function formatSkipped(sec) {
    sec = Math.floor(sec || 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ' sa ' + m + ' dk';
    if (m > 0) return m + ' dk ' + s + ' sn';
    return s + ' sn';
  }
  function updateSkippedStat() {
    chrome.storage.local.get({ vadblockSkippedSeconds: 0 }, (r) => {
      const el = document.getElementById('statSkipped');
      if (el) el.textContent = formatSkipped(r.vadblockSkippedSeconds);
    });
  }
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.vadblockSkippedSeconds) updateSkippedStat();
  });

  function updateStats() {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (s) => {
      if (s && totalBlockedCount) {
        totalBlockedCount.textContent = (s.total || 0).toLocaleString('tr-TR');
        if (statAds) statAds.textContent = (s.ads || 0).toLocaleString('tr-TR');
        if (statTrackers) statTrackers.textContent = (s.trackers || 0).toLocaleString('tr-TR');
        if (statCdn) statCdn.textContent = (s.cdn || 0).toLocaleString('tr-TR');
        if (statOther) statOther.textContent = (s.other || 0).toLocaleString('tr-TR');
        
        fullStats = s;
        currentHistoryData = s.history;
        const data = getDataForPeriod(currentTimePeriod, currentChartType);
        if (data) drawChart(data);
      }
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && pageBlockedCount) {
        chrome.runtime.sendMessage({ type: 'GET_PAGE_STATS', tabId: tabs[0].id }, (pageBlocked) => {
          pageBlockedCount.textContent = (pageBlocked || 0).toLocaleString('tr-TR');
        });
      }
    });
  }

  updateStats();
  // Listen for real-time updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATS_UPDATE') {
  updateStats();
  updateSkippedStat();
    }
  });

  // ── Header buttons ──
  document.getElementById('btnRefresh').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'UPDATE_FILTERS' }, (res) => {
        showToast(window.vAdBlockT('opt_update_success') || 'GUI güncellendi ve filtreler senkronize edildi!');
        // Refresh local UI stats
        chrome.storage.local.get(['globalEnabled'], (r) => {
            updatePowerBtnState();
        });
    });
  });
  document.getElementById('btnSettings').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open('options.html');
  });

  // ── Toast ──
  function showToast(msg, isError) {
    const icon = isError 
      ? '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' 
      : '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    toast.innerHTML = icon + ' <span>' + msg + '</span>';
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => { toast.className = 'toast'; }, 2500);
  }

  const btnReportIssue = document.getElementById('btnReportIssue');
  if (btnReportIssue) {
    btnReportIssue.addEventListener('click', () => {
      const manifest = chrome.runtime.getManifest();
      chrome.storage.local.get({ globalEnabled: true, protectionLevel: 'balanced' }, (r) => {
        const M = (key) => window.vAdBlockT(key) || key;
        const lines = [
          M('report_title'),
          M('report_version') + ': ' + manifest.version,
          M('report_page') + ': ' + (currentDomain || 'bilinmiyor'),
          M('report_level') + ': ' + (r.globalEnabled ? M('toast_protection_on') : M('toast_protection_off')) + ' | ' + r.protectionLevel,
          M('report_date') + ': ' + new Date().toLocaleString('tr-TR')
        ];
        navigator.clipboard.writeText(lines.join('\n')).then(() => {
          showToast(M('toast_report_copied'));
        }).catch(() => showToast(M('toast_copy_failed'), true));
      });
    });
  }

  // ── Duraklatma menüsü ──
  if (pauseWrap && pauseBtn && pauseMenu) {
    

    document.addEventListener('click', (e) => {
      if (!pauseWrap.contains(e.target)) pauseMenu.classList.remove('open');
    });

    let selectedPauseTime = 0;
    const pauseMenuMain = document.getElementById('pauseMenuMain');
    const pauseMenuScope = document.getElementById('pauseMenuScope');
    
    // removed duplicate logic

    // Reset view when opening menu
    pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pauseMenuMain) pauseMenuMain.style.display = 'block';
        if (pauseMenuScope) pauseMenuScope.style.display = 'none';
        
        // Show/hide resume button based on shield state
        const shieldCard = document.getElementById('shieldCard');
        if (shieldCard) {
            const isPaused = shieldCard.classList.contains('off');
            const resSep = document.getElementById('resumeSep');
            const resBtn = document.getElementById('resumeBtn');
            if (resSep) resSep.style.display = isPaused ? 'block' : 'none';
            if (resBtn) resBtn.style.display = isPaused ? 'block' : 'none';
        }
        
        pauseMenu.classList.toggle('open');
    });

    if (pauseMenuMain) {
        pauseMenuMain.querySelectorAll('.time-opt').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedPauseTime = parseInt(item.dataset.minutes, 10);
                pauseMenuMain.style.display = 'none';
                pauseMenuScope.style.display = 'block';
            });
        });
    }

    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pauseMenu.classList.remove('open');
            chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE', minutes: 0 }, () => {
                chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_TEMP', domain: currentDomain, minutes: 0 }, (res) => {
                    showToast(window.vAdBlockT('pause_toast_resume') || 'Koruma devam ediyor');
                    updatePowerBtnState();
                    setTimeout(() => {
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
                        });
                    }, 400);
                });
            });
        });
    }

    if (pauseMenuScope) {
        pauseMenuScope.querySelectorAll('.scope-opt').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                pauseMenu.classList.remove('open');
                const scope = item.dataset.scope;
                if (scope === 'site') {
                    if (!currentDomain) return;
                    chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_TEMP', domain: currentDomain, minutes: selectedPauseTime }, (res) => {
                        showToast(window.vAdBlockT('site_temp_off_msg', [String(selectedPauseTime)]) || ('Bu site ' + selectedPauseTime + ' dk kapatildi'));
                        updatePowerBtnState();
                        setTimeout(() => {
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                if (tabs[0]) chrome.tabs.reload(tabs[0].id);
                            });
                        }, 400);
                    });
                } else {
                    const until = Date.now() + selectedPauseTime * 60 * 1000;
                    chrome.storage.local.set({ globalEnabled: false, pauseUntil: until }, () => {
                        chrome.runtime.sendMessage({ type: 'TOGGLE_PROTECTION', enabled: false }, () => {
                            showToast(window.vAdBlockT('global_temp_off_msg', [String(selectedPauseTime)]) || ('Tüm sitelerde ' + selectedPauseTime + ' dk durduruldu'));
                            updatePowerBtnState();
                            setTimeout(() => {
                                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                    if (tabs[0]) chrome.tabs.reload(tabs[0].id);
                                });
                            }, 400);
                        });
                    });

                }
            });
        });

        pauseMenuScope.querySelector('.scope-cancel').addEventListener('click', (e) => {
            e.stopPropagation();
            pauseMenu.classList.remove('open');
        });
    }

  // ── Koruma seviyesi seçici ──
  const levelSelector = document.getElementById('levelSelector');
  if (levelSelector) {
    function updatePill() {
      const activeBtn = levelSelector.querySelector('.level-btn.active');
      const pill = document.getElementById('levelPill');
      if (activeBtn && pill) {
        pill.style.width = activeBtn.offsetWidth + 'px';
        pill.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;
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
              files: ['picker.js']
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
  const rulesList = document.getElementById('rulesList');

  document.getElementById('btnManageRules').addEventListener('click', () => {
    loadRules();
    overlay.classList.add('open');
  });
  document.getElementById('btnBackRules').addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  let currentRulesPage = 0;
  const RULES_PER_PAGE = 5;

  function loadRules() {
    chrome.storage.local.get({ userRules: [] }, (r) => {
      const rules = r.userRules || [];
      rulesList.innerHTML = '';
      if (rules.length === 0) {
        rulesList.innerHTML = '<div class="empty-state">' + (window.vAdBlockT('rules_empty') || 'Henüz özel kural eklenmemiş.') + '</div>';
        return;
      }
      
      const totalPages = Math.ceil(rules.length / RULES_PER_PAGE);
      if (currentRulesPage >= totalPages) currentRulesPage = Math.max(0, totalPages - 1);
      
      const startIdx = currentRulesPage * RULES_PER_PAGE;
      const paginatedRules = rules.slice(startIdx, startIdx + RULES_PER_PAGE);

      paginatedRules.forEach((rule, localIdx) => {
        const i = startIdx + localIdx;
        const parts = rule.split('##');
        const domain = parts[0] || (window.vAdBlockT('rules_global') || 'Global');
        const selector = parts[1] || rule;
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.innerHTML = `
          <div class="rule-domain">${domain}</div>
          <div class="rule-selector">${selector}</div>
          <div class="rule-actions">
            <button class="rule-mini-btn preview" data-idx="${i}">👁️ ${window.vAdBlockT('rules_preview') || 'Önizle'}</button>
            <button class="rule-mini-btn delete" data-idx="${i}">${window.vAdBlockT('rules_delete') || 'Sil'}</button>
          </div>`;
        rulesList.appendChild(card);
      });

      if (totalPages > 1) {
          const pagControls = document.createElement('div');
          pagControls.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 13px; color: var(--text-muted);';
          
          const prevBtn = document.createElement('button');
          prevBtn.textContent = '◀';
          prevBtn.style.cssText = 'background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 12px; border-radius: 6px; font-size: 12px;';
          if (currentRulesPage === 0) { prevBtn.style.opacity = '0.4'; prevBtn.style.cursor = 'not-allowed'; }
          else { prevBtn.style.cursor = 'pointer'; prevBtn.onclick = () => { currentRulesPage--; loadRules(); }; }
          
          const nextBtn = document.createElement('button');
          nextBtn.textContent = '▶';
          nextBtn.style.cssText = 'background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 12px; border-radius: 6px; font-size: 12px;';
          if (currentRulesPage === totalPages - 1) { nextBtn.style.opacity = '0.4'; nextBtn.style.cursor = 'not-allowed'; }
          else { nextBtn.style.cursor = 'pointer'; nextBtn.onclick = () => { currentRulesPage++; loadRules(); }; }
          
          const infoSpan = document.createElement('span');
          infoSpan.textContent = (currentRulesPage + 1) + ' / ' + totalPages;
          infoSpan.style.fontWeight = '600';
          
          pagControls.appendChild(prevBtn);
          pagControls.appendChild(infoSpan);
          pagControls.appendChild(nextBtn);
          rulesList.appendChild(pagControls);
      }

      rulesList.querySelectorAll('.rule-mini-btn.preview').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          const parts = rules[idx].split('##');
          const sel = parts[1] || rules[idx];
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'PREVIEW_RULE', selector: sel }).catch(()=>{});
          });
        });
      });

      rulesList.querySelectorAll('.rule-mini-btn.delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          rules.splice(idx, 1);
          chrome.storage.local.set({ userRules: rules }, loadRules);
        });
      });
    });
  }

  // Promo System Logic
  function initPromoSystem() {
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.get({ settings: {}, promo_discount_shown: false, installTime: Date.now() }, (res) => {
      // If user disabled promotional messages, don't show
      if (res.settings.promoMessages === false) return;
      
      // 30% chance to show a promo
      if (Math.random() > 0.3) return;
      
      const promos = [
        {
          id: 'rating',
          title: '⭐ vAdBlock\'u beğendiniz mi?',
          desc: 'Geliştirmeye devam edebilmemiz için bize 5 yıldız vererek destek olabilirsiniz!',
          btn: 'Değerlendir'
        },
        {
          id: 'premium',
          title: '🚀 vAdBlock Premium',
          desc: 'Premium abonelik alarak %100 gizlilik ve ekstra özelliklerden faydalanmak ister misiniz?',
          btn: 'İncele'
        }
      ];

      // If user has been using for > 3 days and discount never shown
      const daysUsed = (Date.now() - res.installTime) / (1000 * 60 * 60 * 24);
      if (daysUsed >= 3 && !res.promo_discount_shown) {
        promos.push({
          id: 'discount',
          title: '🎁 Sana Özel İndirim!',
          desc: 'Uzun süredir bizimlesin! Premium üyelikte %50 indirim kazanmak için kodun: LAVE-' + Math.random().toString(36).substring(2,6).toUpperCase(),
          btn: 'Kodu Kullan'
        });
      }

      const selectedPromo = promos[Math.floor(Math.random() * promos.length)];
      
      const container = document.getElementById('promo-container');
      const title = document.getElementById('promo-title');
      const desc = document.getElementById('promo-desc');
      const btnAction = document.getElementById('promo-btn-action');
      const btnClose = document.getElementById('promo-btn-close');
      
      if (!container || !title || !desc || !btnAction) return;
      
      title.innerHTML = selectedPromo.title;
      desc.textContent = selectedPromo.desc;
      btnAction.textContent = selectedPromo.btn;
      
      container.style.display = 'block';
      
      btnAction.onclick = () => {
        if (selectedPromo.id === 'discount') {
          chrome.storage.local.set({ promo_discount_shown: true });
        }
        showToast('Yönlendiriliyor...');
        setTimeout(() => container.style.display = 'none', 1000);
      };
      
      btnClose.onclick = () => {
        container.style.display = 'none';
      };
    });
  }

  // Initial call
  
}