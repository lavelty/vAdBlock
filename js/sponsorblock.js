// sponsorblock.js — YouTube sponsor segmentlerini altyazılardan tespit edip otomatik atlar.
(async () => {
  'use strict';

  // Zaten çalışıyorsa tekrar başlatma
  if (window.__vadSponsorBlockActive) return;
  window.__vadSponsorBlockActive = true;

  let vadLangData = null;
  try {
      const { vadblockLang } = await chrome.storage.local.get({vadblockLang: 'auto'});
      if (vadblockLang && vadblockLang !== 'auto') {
          const json = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'GET_MESSAGES', lang: vadblockLang }, (resp) => resolve(resp));
          });
          if (json && typeof json === 'object') vadLangData = json;
      }
  } catch (e) { }

  function _t(key, fallback) {
    if (vadLangData && vadLangData[key]) return vadLangData[key].message;
    try { const m = chrome.i18n.getMessage(key); if (m) return m; } catch(e) {}
    return fallback;
  }

  // ─── Ayarlar ───
  const SB_API = 'https://sponsor.ajay.app';
  let VADE_API = 'https://vade.pro/api';
  let showAddBtn = true;
  let categorySettings = {};

  function loadSbSettings() {
    chrome.storage.local.get({ settings: {} }, (r) => {
      const s = r.settings || {};
      if (s.sponsorApiUrl) VADE_API = s.sponsorApiUrl.replace(/\/+$/, '');
      showAddBtn = s.sponsorShowAdd !== false;
      categorySettings = s.sbCategories || {};
    });
  }
  const CATEGORY_COLORS = {
    sponsor:        '#00d400',
    selfpromo:      '#ffff00',
    interaction:    '#cc00ff',
    intro:          '#00ffff',
    outro:          '#0202ed',
    preview:        '#008fd6',
    music_offtopic: '#ff9900'
  };

  // ─── Sponsor Tespit Kalıpları (TR + EN) ───
  const SPONSOR_PATTERNS_HIGH = [
    // EN – yüksek güven
    /this (?:video|episode|content) is (?:brought to you|sponsored|made possible) by/i,
    /(?:today'?s|this week'?s|our) sponsor(?:s)? (?:is|are)/i,
    /thanks to (.+?) for sponsoring/i,
    /sponsored by (.+)/i,
    /a huge thanks to (.+?) for making this/i,
    // TR – yüksek güven
    /bu videonun sponsoru/i,
    /sponsorluğunda/i,
    /sponsor(?:umuz|u) olan/i,
    /destekleriyle sunulmuştur/i
  ];

  const SPONSOR_PATTERNS_MED = [
    // EN – orta güven
    /use (?:my |the )?(?:code|link)/i,
    /check (?:out|them out) (?:at|using)/i,
    /go to (.+?\.(?:com|co|io|org|net|app))/i,
    /sign up (?:for free |today )?(?:at|using|with)/i,
    /download (.+?) for free/i,
    /first (?:\d+|hundred|thousand) (?:people|users|subscribers)/i,
    /get (?:\d+|a|an) (?:percent|%) (?:off|discount)/i,
    /link (?:is )?in (?:the )?description/i,
    /promo(?:tion)? code/i,
    /exclusive (?:offer|deal|discount)/i,
    // TR – orta güven
    /açıklamadaki link/i,
    /indirim (?:kodu|kodunu)/i,
    /ücretsiz dene/i,
    /ilk (?:\d+|yüz|bin) kişi/i,
    /kullanarak .{1,30} indirim/i,
    /promosyon kodu/i,
    /hemen (?:dene|indirin|kaydolun)/i,
    /linke tıkla/i
  ];

  const INTERACTION_PATTERNS = [
    /(?:smash|hit|press) (?:that |the )?(?:like|subscribe|notification|bell)/i,
    /(?:like|abone|subscribe).*(?:button|buton)/i,
    /don'?t forget to (?:like|subscribe|comment)/i,
    /beğen.*abone/i,
    /abone ol.*bildiri/i,
    /leave a (?:like|comment|thumbs up)/i
  ];

  const OUTRO_PATTERNS = [
    /thanks for watching/i,
    /see you (?:in )?(?:the )?next (?:video|one|time|episode)/i,
    /izlediğiniz için teşekkür/i,
    /bir sonraki videoda görüşmek üzere/i,
    /peace out/i,
    /bye(?:\s|$)/i,
    /that'?s (?:it|all) for (?:today|this|now)/i,
    /bugünlük bu kadar/i
  ];

  // ─── State ───
  let currentVideoId = null;
  let segments = [];
  let skippedSegments = new Set();
  let overlayElements = [];
  let toastEl = null;
  let videoEl = null;
  let checkInterval = null;
  let skippedSecondsTotal = 0;
  let skipBtnEl = null;
  let skipBtnSeg = null;
  let addBtnEl = null;
  let categoryMenuEl = null;
  let previewingIntervalGlobal = null;
  let previewPausedTime = null;

  // ─── Yardımcılar ───
  function getVideoId() {
    const url = new URL(window.location.href);
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const m = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function isEnabled() {
    return new Promise(resolve => {
      chrome.storage.local.get({ settings: {}, globalEnabled: true }, r => {
        resolve(r.globalEnabled && (r.settings.sponsorSkip !== false));
      });
    });
  }

  // ─── Altyazı Çekme ───
  async function fetchCaptions(videoId) {
    // Yöntem 1: ytInitialPlayerResponse'dan
    try {
      const pageText = document.documentElement.innerHTML;
      const match = pageText.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*var\s|\s*<\/script)/s);
      if (match) {
        const data = JSON.parse(match[1]);
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length > 0) {
          // Önce İngilizce, yoksa Türkçe, yoksa ilkini al
          const enTrack = tracks.find(t => t.languageCode === 'en') 
                       || tracks.find(t => t.languageCode === 'tr')
                       || tracks[0];
          if (enTrack && enTrack.baseUrl) {
            const res = await fetch(enTrack.baseUrl + '&fmt=json3');
            if (res.ok) {
              const json = await res.json();
              return parseCaptionsJson3(json);
            }
          }
        }
      }
    } catch (e) {
      console.log('[vAdBlock SponsorSkip] ytInitialPlayerResponse parse error:', e);
    }

    // Yöntem 2: timedtext API
    for (const lang of ['en', 'tr', 'a.en']) {
      try {
        const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const captions = parseCaptionsJson3(json);
          if (captions.length > 0) return captions;
        }
      } catch (e) { /* devam */ }
    }

    return [];
  }

  function parseCaptionsJson3(json) {
    if (!json || !json.events) return [];
    const result = [];
    for (const event of json.events) {
      if (!event.segs) continue;
      const text = event.segs.map(s => s.utf8 || '').join('').trim();
      if (!text) continue;
      const start = (event.tStartMs || 0) / 1000;
      const duration = (event.dDurationMs || 0) / 1000;
      result.push({ start, duration, end: start + duration, text });
    }
    return result;
  }

  // ─── SponsorBlock API ───
  async function fetchSBSegments(videoId) {
    // Kendi sunucumuz (vade.pro) ve açık SponsorBlock API her ikisi de çekilir;
    // biri boşsa diğerini yutmasın diye birleştirilir.
    const ours = await fetchVadeSegments(videoId);
    const external = await fetchSBExternalSegments(videoId);
    return mergeSegments(ours, external);
  }

  async function fetchSBExternalSegments(videoId) {
    const categories = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic'];
    const url = SB_API + '/api/skipSegments?videoID=' + encodeURIComponent(videoId) +
                '&categories=' + encodeURIComponent(JSON.stringify(categories));
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 404 || !res.ok) {
        console.log('[vAdBlock SponsorSkip] SB API durumu:', res.status);
        return [];
      }
      const data = await res.json();
      const out = [];
      const push = (start, end, category) => {
        if (typeof start !== 'number' || typeof end !== 'number' || !(end > start)) return;
        const cat = CATEGORY_COLORS[category] ? category : 'sponsor';
        out.push({ start, end, category: cat, confidence: 3, source: 'sb' });
      };
      const items = Array.isArray(data) ? data : (data && Array.isArray(data.segments) ? data.segments : []);
      for (const it of items) {
        if (Array.isArray(it.segment)) {
          push(it.segment[0], it.segment[1], it.category);
        } else if (Array.isArray(it.segments)) {
          for (const s of it.segments) {
            if (Array.isArray(s.segment)) push(s.segment[0], s.segment[1], s.category);
            else if (typeof s.startTime === 'number') push(s.startTime, s.endTime, s.category);
          }
        } else if (typeof it.startTime === 'number') {
          push(it.startTime, it.endTime, it.category);
        }
      }
      return out;
    } catch (e) {
      console.log('[vAdBlock SponsorSkip] SB API hata:', e);
      return [];
    }
  }

  // ─── Kendi Sunucumuz (vade.pro) ───
  async function fetchVadeSegments(videoId) {
    const categories = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic'];
    const url = VADE_API + '/skipsegments.php?videoID=' + encodeURIComponent(videoId) +
                '&categories=' + encodeURIComponent(JSON.stringify(categories));
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 404 || !res.ok) {
        console.log('[vAdBlock SponsorSkip] vade.pro API durumu:', res.status);
        return [];
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter(it => it && typeof it.startTime === 'number' && typeof it.endTime === 'number' && it.endTime > it.startTime)
        .map(it => ({
          start: it.startTime,
          end: it.endTime,
          category: CATEGORY_COLORS[it.category] ? it.category : 'sponsor',
          confidence: 3,
          source: 'vade'
        }));
    } catch (e) {
      console.log('[vAdBlock SponsorSkip] vade.pro API hata:', e);
      return [];
    }
  }

  // ─── userID üretimi ve saklama ───
  function ensureUserID() {
    return new Promise(resolve => {
      chrome.storage.local.get({ vadblockUserID: null }, (r) => {
        if (r.vadblockUserID) { resolve(r.vadblockUserID); return; }
        // 32+ karakter rastgele kimlik
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        const bytes = new Uint8Array(36);
        crypto.getRandomValues(bytes);
        for (let i = 0; i < bytes.length; i++) id += charset[bytes[i] % charset.length];
        chrome.storage.local.set({ vadblockUserID: id }, () => resolve(id));
      });
    });
  }

  // ─── Kendi sunucumuza segment gönder (doğrudan kayıt) ───
  async function submitSegmentToVade(payload) {
    try {
      const res = await fetch(VADE_API + '/skipsegments.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        console.log('[vAdBlock SponsorSkip] Segment eklendi (vade.pro):', payload);
        return true;
      }
      console.log('[vAdBlock SponsorSkip] vade.pro ekleme sonucu:', res.status, data);
      return false;
    } catch (e) {
      console.log('[vAdBlock SponsorSkip] vade.pro ekleme hatası:', e);
      return false;
    }
  }

  // ─── Sponsor Analizi ───
  function analyzeSegments(captions) {
    if (!captions || captions.length === 0) return [];

    const detected = [];

    for (let i = 0; i < captions.length; i++) {
      const cap = captions[i];
      const text = cap.text;
      let category = null;
      let confidence = 0;

      // Sponsor kalıpları
      for (const pattern of SPONSOR_PATTERNS_HIGH) {
        if (pattern.test(text)) {
          category = 'sponsor';
          confidence = 3;
          break;
        }
      }
      if (!category) {
        for (const pattern of SPONSOR_PATTERNS_MED) {
          if (pattern.test(text)) {
            category = 'sponsor';
            confidence = 2;
            break;
          }
        }
      }

      // Etkileşim kalıpları
      if (!category) {
        for (const pattern of INTERACTION_PATTERNS) {
          if (pattern.test(text)) {
            category = 'interaction';
            confidence = 2;
            break;
          }
        }
      }

      // Outro kalıpları
      if (!category) {
        for (const pattern of OUTRO_PATTERNS) {
          if (pattern.test(text)) {
            category = 'outro';
            confidence = 2;
            break;
          }
        }
      }

      if (category) {
        detected.push({
          start: cap.start,
          end: cap.end,
          category,
          confidence,
          captionIndex: i
        });
      }
    }

    // Birleştirme: yakın segmentleri birleştir
    return mergeSegments(detected, captions);
  }

  function mergeSegments(detected, captions) {
    if (detected.length === 0) return [];

    const merged = [];
    let current = { ...detected[0] };

    // Yüksek güvenli sponsor tespiti için çevresini genişlet
    if (current.confidence >= 3) {
      current = expandSegment(current, captions);
    }

    for (let i = 1; i < detected.length; i++) {
      const seg = detected[i];
      // Aynı kategorideyse ve aralarında 8 saniyeden az boşluk varsa birleştir
      if (seg.category === current.category && seg.start - current.end < 8) {
        current.end = Math.max(current.end, seg.end);
        current.confidence = Math.max(current.confidence, seg.confidence);
      } else {
        // Yüksek güvenli segmenti genişlet
        if (current.confidence >= 3) {
          current = expandSegment(current, captions);
        }
        if (isValidSegment(current)) merged.push(current);
        current = { ...seg };
        if (current.confidence >= 3) {
          current = expandSegment(current, captions);
        }
      }
    }

    if (isValidSegment(current)) merged.push(current);

    return merged;
  }

  function expandSegment(seg, captions) {
    // Sponsor başlangıcını biraz daha erkene al (sponsor intro cümlesi genelde 2-3 saniye öncesinde başlar)
    const expandBefore = 2;
    // Sponsorun devamını al — ilk sponsor kalıbından sonra URL ve call-to-action genelde devam eder
    const expandAfter = 15;

    // Sonraki altyazıları kontrol et
    let endTime = seg.end;
    for (const cap of captions) {
      if (cap.start >= seg.start && cap.start <= seg.end + expandAfter) {
        // Sponsor ile ilgili kelimeler devam ediyorsa genişlet
        const text = cap.text.toLowerCase();
        if (text.includes('link') || text.includes('code') || text.includes('free') ||
            text.includes('discount') || text.includes('percent') || text.includes('offer') ||
            text.includes('.com') || text.includes('.co') || text.includes('download') ||
            text.includes('subscribe') || text.includes('indirim') || text.includes('ücretsiz') ||
            text.includes('tıkla') || text.includes('kaydol') || text.includes('dene') ||
            // Genel devam kelimeleri
            text.includes('they') || text.includes('their') || text.includes('it\'s') ||
            text.includes('you can') || text.includes('you get') || text.includes('gonna')) {
          endTime = Math.max(endTime, cap.end);
        }
      }
    }

    return {
      ...seg,
      start: Math.max(0, seg.start - expandBefore),
      end: endTime
    };
  }

  function isValidSegment(seg) {
    const duration = seg.end - seg.start;
    // Minimum 5 saniye, maksimum 180 saniye (3 dakika)
    if (duration < 5 || duration > 180) return false;
    // Düşük güvenli sponsor minimum 10 saniye olsun
    if (seg.confidence < 3 && duration < 10) return false;
    return true;
  }

  // ─── Video Kontrolü ───
  function startMonitoring() {
    if (checkInterval) clearInterval(checkInterval);

    checkInterval = setInterval(() => {
      if (!videoEl) return;

      if (!overlaysRendered && videoEl.duration && segments.length > 0) {
        renderOverlays();
      }

      // Manuel Atla butonunu içinde bulunulan segment için göster
      updateSkipBtn();
      updateAddBtn();

      if (videoEl.paused || segments.length === 0) return;

      if (true) {
        const currentTime = videoEl.currentTime;

        for (const seg of segments) {
          const segKey = `${seg.start}-${seg.end}`;
          if (skippedSegments.has(segKey)) continue;

          const catPref = categorySettings[seg.category] || 'auto';
          if (catPref === 'disabled' || catPref === 'button') continue;

          if (currentTime >= seg.start && currentTime < seg.end - 0.5) {
            skipSegment(seg, false);
            break;
          }
        }
      }
    }, 500);
  }

  function skipSegment(seg, manual) {
    if (!videoEl) return;
    const segKey = `${seg.start}-${seg.end}`;
    videoEl.currentTime = seg.end;
    skippedSegments.add(segKey);

    const skippedDuration = Math.round(seg.end - seg.start);
    addSkippedSeconds(skippedDuration);
    hideSkipBtn();
    showToast(seg.category, skippedDuration, manual);
  }

  function updateSkipBtn() {
    if (!videoEl || segments.length === 0) {
      hideSkipBtn();
      return;
    }
    const currentTime = videoEl.currentTime;
    const active = segments.find((seg) => {
      const segKey = `${seg.start}-${seg.end}`;
      const catPref = categorySettings[seg.category] || 'auto';
      
      if (catPref === 'disabled') return false;
      if (catPref === 'auto') return false;
      
      return !skippedSegments.has(segKey) && currentTime >= seg.start && currentTime < seg.end - 0.5;
    });
    if (active) showSkipBtn(active);
    else hideSkipBtn();
  }

  function updateAddBtn() {
    if (!videoEl || !videoEl.duration || !showAddBtn) {
      hideAddBtn();
      return;
    }
    if (!playerHovered) {
      hideAddBtn();
      return;
    }
    const btn = ensureAddBtn();
    btn.style.display = 'flex';
  }

  // ─── İlerleme Çubuğu İşaretçileri ───
  let overlaysRendered = false;

  let tooltipEl = null;
  let progressBarEl = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    ensureStyles();
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'vadblock-sb-tooltip';
    tooltipEl.style.cssText = `
      position: fixed;
      z-index: 99999;
      display: none;
      background: rgba(28, 28, 28, 0.95);
      color: #f1f1f1;
      padding: 6px 11px;
      border-radius: 6px;
      font-family: 'Roboto','Arial',sans-serif;
      font-size: 12.5px;
      line-height: 1.4;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.45);
      border: 1px solid rgba(255,255,255,0.1);
    `;
    (document.querySelector('.html5-video-player') || document.body).appendChild(tooltipEl);
    return tooltipEl;
  }

  function showTooltip(seg, e) {
    const el = ensureTooltip();
    const color = CATEGORY_COLORS[seg.category] || CATEGORY_COLORS.sponsor;
    const duration = Math.round(seg.end - seg.start);
    el.innerHTML = `
      <span style="display:inline-block;vertical-align:middle;width:8px;height:8px;border-radius:50%;background:${color};margin-right:7px;"></span>
      <span style="font-weight:600;">${getCategoryLabel(seg.category)}</span>
      <span style="color:rgba(241,241,241,0.7);margin-left:8px;">${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
      <span style="color:rgba(241,241,241,0.5);margin-left:6px;">· ${duration} ${_t('sb_seconds', 'sn')}</span>
    `;
    el.style.display = 'block';
    positionTooltip(e);
  }

  function positionTooltip(e) {
    const el = ensureTooltip();
    const rect = el.getBoundingClientRect();
    const barRect = progressBarEl ? progressBarEl.getBoundingClientRect() : null;

    let x, y;
    if (barRect && barRect.width > 0) {
      // YouTube tarzı: imlecin üstünde, yatayda ortalanmış, bar sınırlarından taşmaz
      x = e.clientX - rect.width / 2;
      x = Math.max(barRect.left + 4, Math.min(x, barRect.right - rect.width - 4));
      y = barRect.top - rect.height - 8;
      if (y < 4) y = barRect.bottom + 12;
    } else {
      x = e.clientX + 12;
      y = e.clientY + 12;
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
  }

  function renderOverlays() {
    removeOverlays();
    if (!videoEl || !videoEl.duration || segments.length === 0) return;

    // Segment bloklarını YouTube'un kendi ilerleme listesinin içine koy → reklam
    // çubuğuyla aynı yükseklik/görünüm; hover'da listenin native scaleY büyümesi
    // otomatik olarak marker'lara da uygulanır, ekstra CSS gerekmez.
    const list = document.querySelector('.ytp-progress-list');
    const host = list || (document.querySelector('.ytp-progress-bar') || document.querySelector('.ytp-progress-bar-container'));
    if (!host) {
      setTimeout(renderOverlays, 700);
      return;
    }
    if (!list) {
      host.style.overflow = 'visible';
      if (getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
      }
    }
    ensureStyles();

    progressBarEl = document.querySelector('.ytp-progress-bar') || document.querySelector('.ytp-progress-bar-container');
    attachBarHover(progressBarEl);

    const container = document.createElement('div');
    container.id = 'vadblock-sb-overlays';
    container.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;height:100%;pointer-events:none;z-index:36;overflow:visible;';

    for (const seg of segments) {
      const startPercent = Math.max(0, Math.min(100, (seg.start / videoEl.duration) * 100));
      const widthPercent = Math.max(0.2, Math.min(100 - startPercent, ((seg.end - seg.start) / videoEl.duration) * 100));
      const color = CATEGORY_COLORS[seg.category] || CATEGORY_COLORS.sponsor;

      const block = document.createElement('div');
      block.setAttribute('data-vadblock-sb', '1');
      block.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        left: ${startPercent}%;
        width: ${widthPercent}%;
        min-width: 2px;
        background: ${color};
        pointer-events: auto;
        transition: filter 0.12s ease, box-shadow 0.12s ease;
      `;
      block.addEventListener('mouseenter', (e) => {
        block.style.filter = 'brightness(1.3)';
        block.style.boxShadow = `0 0 6px ${color}88`;
        showTooltip(seg, e);
      });
      block.addEventListener('mousemove', (e) => positionTooltip(e));
      block.addEventListener('mouseleave', () => {
        block.style.filter = '';
        block.style.boxShadow = '';
        hideTooltip();
      });
      container.appendChild(block);
      overlayElements.push(block);
    }

    host.appendChild(container);
    overlayElements.push(container);
    watchOverlays();
    overlaysRendered = true;
    console.log('[vAdBlock SponsorSkip] ' + segments.length + ' işaretçi render edildi');
  }

  // İmleç barın üzerindeyken o noktaya denk gelen segmentin bilgisini göster
  function attachBarHover(el) {
    if (!el || el.dataset.vadblockHover) return;
    el.dataset.vadblockHover = '1';

    const onMove = (e) => {
      if (!videoEl || !videoEl.duration || segments.length === 0) return;
      const rect = progressBarEl ? progressBarEl.getBoundingClientRect() : null;
      if (!rect || rect.width === 0) return;
      const ratio = (e.clientX - rect.left) / rect.width;
      const t = ratio * videoEl.duration;
      // Bloklar en az 2px genişlikte; imleç bloğun kendisine değiyorsa gösterilsin diye
      // 2px'lik mesafeye karşılık gelen süre tolerans olarak eklenir (min. 1.5 sn).
      const tolerance = Math.max(1.5, (2 / rect.width) * videoEl.duration);
      const seg = segments.find(s => t >= s.start - tolerance && t <= s.end + tolerance);
      if (seg) showTooltip(seg, e);
      else hideTooltip();
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('mouseenter', onMove);
  }

  let overlayObserver = null;

  // YouTube listeyi yeniden kurarsa / marker'lar kaybolursa yeniden çiz.
  // Kararlı bir ata eleman izlenir; her yeniden çizimde güncel node'lar sorgulanır
  // (eski/kopmuş listeye takılı kalıp büyüme animasyonunu kaçırmasın diye).
  function watchOverlays() {
    if (overlayObserver) overlayObserver.disconnect();
    const root = document.querySelector('#movie_player') || document.querySelector('.html5-video-player') || document.body;
    overlayObserver = new MutationObserver(() => {
      if (!overlaysRendered) return;
      if (!document.querySelector('#vadblock-sb-overlays') ||
          !document.querySelector('#vadblock-sb-overlays [data-vadblock-sb="1"]')) {
        renderOverlays();
      }
    });
    overlayObserver.observe(root, { childList: true, subtree: true });
  }

  function removeOverlays() {
    for (const el of overlayElements) {
      el.remove();
    }
    overlayElements = [];
    overlaysRendered = false;
    hideTooltip();
    hideSkipBtn();
    hideCategoryMenu();
    hideAddBtn();
  }

  // ─── Ortak Stiller ───
  function ensureStyles() {
    if (document.getElementById('vadblock-sb-style')) return;
    const style = document.createElement('style');
    style.id = 'vadblock-sb-style';
    style.textContent = `
      @keyframes vadblock-sb-tip-in {
        from { opacity: 0; transform: translateY(6px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes vadblock-sb-toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.95); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }
      @keyframes vadblock-sb-toast-out {
        from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        to   { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.95); }
      }
      @keyframes vadblock-sb-toast-progress {
        from { width: 100%; }
        to   { width: 0%; }
      }
    `;
    document.head.appendChild(style);
  }

  function getCategoryIcon(cat, color) {
    const icons = {
      sponsor: '<path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
      selfpromo: '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
      interaction: '<path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
      intro: '<path d="M20.2 6 3 11l-.9-2.4a2 2 0 0 1 1.3-2.5l13.5-4a2 2 0 0 1 2.5 1.3z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      outro: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/><path d="M6 9h.01"/><path d="M6 15h.01"/>',
      preview: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
      music_offtopic: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'
    };
    return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">${icons[cat] || icons.sponsor}</svg>`;
  }

  // ─── Manuel Atla Butonu ───
  function ensureSkipBtn() {
    const player = document.querySelector('.html5-video-player') || document.body;
    
    if (skipBtnEl) {
      if (!player.contains(skipBtnEl)) {
        player.appendChild(skipBtnEl);
      }
      return skipBtnEl;
    }
    
    let s = document.getElementById('vadblock-sb-style');
    if (!s) {
      s = document.createElement('style');
      s.id = 'vadblock-sb-style';
      document.head.appendChild(s);
    }
    if (!s.textContent.includes('top: auto')) {
      s.textContent = `
        #vadblock-sb-skipbtn {
          top: auto !important;
          left: auto !important;
          bottom: 90px !important;
          right: 24px !important;
          margin: 0 !important;
          transform: none !important;
        }
        .ytp-fullscreen #vadblock-sb-skipbtn {
          bottom: 150px !important;
        }
      `;
    }
    
    skipBtnEl = document.createElement('button');
    skipBtnEl.id = 'vadblock-sb-skipbtn';
    skipBtnEl.type = 'button';
    skipBtnEl.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="flex-shrink:0;">
        <path d="M6 4.5v15a1 1 0 0 0 1.53.85L19 12.85a1 1 0 0 0 0-1.7L7.53 3.65A1 1 0 0 0 6 4.5z"/>
      </svg>
      <span style="margin-left:7px;font-weight:600;font-size:13px;">${_t('sb_skip_sponsor', 'Sponsor Atla')}</span>
    `;
    skipBtnEl.style.cssText = `
      position: absolute;
      display: flex;
      opacity: 0;
      pointer-events: none;
      align-items: center;
      background: rgba(18, 18, 18, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-family: 'Roboto', Arial, sans-serif;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.45);
      transition: bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, background 0.15s ease;
    `;
    skipBtnEl.addEventListener('mouseenter', () => { skipBtnEl.style.background = 'rgba(48, 48, 48, 0.9)'; });
    skipBtnEl.addEventListener('mouseleave', () => { skipBtnEl.style.background = 'rgba(18, 18, 18, 0.7)'; });
    skipBtnEl.addEventListener('click', () => {
      if (!videoEl || !skipBtnSeg) return;
      skipSegment(skipBtnSeg, true);
    });
    player.appendChild(skipBtnEl);
    return skipBtnEl;
  }

  function showSkipBtn(seg) {
    const btn = ensureSkipBtn();
    skipBtnSeg = seg;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }

  function hideSkipBtn() {
    skipBtnSeg = null;
    if (skipBtnEl) {
      skipBtnEl.style.opacity = '0';
      skipBtnEl.style.pointerEvents = 'none';
    }
  }

  // ─── Segment Ekleme (Katkı) ───
  const ADD_CATEGORIES = [
    { id: 'sponsor', label: _t('sb_cat_sponsor', 'Sponsor') },
    { id: 'selfpromo', label: _t('sb_cat_selfpromo', 'Öz Tanıtım') },
    { id: 'interaction', label: _t('sb_cat_interaction', 'Etkileşim') },
    { id: 'intro', label: _t('sb_cat_intro', 'İntro') },
    { id: 'outro', label: _t('sb_cat_outro', 'Outro') },
    { id: 'preview', label: _t('sb_cat_preview', 'Önizleme') },
    { id: 'music_offtopic', label: _t('sb_cat_music', 'Müzik Dışı') }
  ];
  let playerHovered = false;

  // --- Removed Add Segment Button from YouTube (Moved to Extension UI) ---
  function ensureAddBtn() { return null; }
  function hideAddBtn() { }

  function showCategoryPanel(initialStart, initialEnd) {
    hideCategoryMenu();
    let start = Math.max(0, initialStart);
    let end = Math.max(start + 1, initialEnd);
    const player = document.querySelector('.html5-video-player') || document.body;
    categoryMenuEl = document.createElement('div');
    categoryMenuEl.id = 'vadblock-sb-catmenu';
    categoryMenuEl.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 340px;
      max-width: calc(100% - 24px);
      background: rgba(18, 18, 18, 0.65);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 20px;
      font-family: 'Roboto', Arial, sans-serif;
      z-index: 10000;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      box-sizing: border-box;
    `;

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:600;color:#ffffff;';
    title.textContent = _t('sb_segment_add', 'Segment Ekle');
    head.appendChild(title);
    categoryMenuEl.appendChild(head);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:#a0a0a0;margin-bottom:16px;';
    sub.textContent = _t('sb_set_times', 'Zamanları ayarla, sonra türünü seç:');
    categoryMenuEl.appendChild(sub);

    // ── Zaman girişleri ──
    const timeRow = document.createElement('div');
    timeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';

    const mkField = (label, placeholder) => {
      const box = document.createElement('div');
      box.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
      const lb = document.createElement('span');
      lb.textContent = label;
      lb.style.cssText = 'font-size:11px;font-weight:500;color:#a0a0a0;text-transform:uppercase;letter-spacing:0.5px;';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.spellcheck = false;
      inp.autocomplete = 'off';
      inp.placeholder = placeholder || 'mm:ss';
      inp.style.cssText = `
        width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
        color:#ffffff;padding:8px 12px;border-radius:8px;font-family:inherit;font-size:14px;text-align:center;
        outline:none;transition:border-color 0.15s ease, background 0.15s ease;
      `;
      inp.addEventListener('focus', () => { inp.style.borderColor = 'rgba(255,255,255,0.4)'; inp.style.background = 'rgba(255,255,255,0.1)'; });
      inp.addEventListener('blur', () => { 
        inp.style.borderColor = 'rgba(255,255,255,0.1)'; 
        inp.style.background = 'rgba(255,255,255,0.05)';
      });
      // Video oynatıcısının klavye kısayollarını engelle
      const stopProp = (e) => e.stopPropagation();
      inp.addEventListener('keydown', stopProp);
      inp.addEventListener('keypress', stopProp);
      inp.addEventListener('keyup', stopProp);
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:10px;color:#7a7a7a;text-align:center;min-height:12px;white-space:nowrap;';
      box.appendChild(lb);
      box.appendChild(inp);
      box.appendChild(hint);
      return { box, inp, hint };
    };

    const startField = mkField(_t('sb_start', 'Başlangıç'), '38:00');
    const endField = mkField(_t('sb_end', 'Bitiş'), '40:00');

    const setHint = (field, sec) => {
      if (sec === null || !isFinite(sec)) { field.hint.textContent = ''; return; }
      field.hint.textContent = formatTime(sec) + ' · ' + Math.round(sec) + ' ' + _t('sb_seconds', 'sn');
    };

    const applyInputs = () => {
      const s = parseTimeInput(startField.inp.value);
      const e = parseTimeInput(endField.inp.value);
      if (s !== null) start = s;
      // Bitiş süresi başlangıçtan en az 5 saniye sonra olmalı
      if (e !== null && e >= start + 5) {
        end = e;
      } else {
        end = start + 5;
      }
      startField.inp.value = formatTimeInput(start);
      endField.inp.value = formatTimeInput(end);
      setHint(startField, start);
      setHint(endField, end);
    };

    startField.inp.value = formatTimeInput(start);
    endField.inp.value = formatTimeInput(end);
    setHint(startField, start);
    setHint(endField, end);

    const onInput = () => {
      // Yazarken input değerini bozma; sadece canlı parse et
      const s = parseTimeInput(startField.inp.value);
      const e = parseTimeInput(endField.inp.value);
      if (s !== null) { start = s; setHint(startField, s); }
      if (e !== null) { end = Math.max(e, start + 5); setHint(endField, e); }
      timePreview.textContent = `${formatTime(start)} – ${formatTime(end)}  ·  ${Math.round(end - start)} ${_t('sb_seconds', 'sn')}`;
      updatePreviewBlock(start, end);
    };
    startField.inp.addEventListener('input', onInput);
    endField.inp.addEventListener('input', onInput);
    startField.inp.addEventListener('blur', applyInputs);
    endField.inp.addEventListener('blur', applyInputs);

    timeRow.appendChild(startField.box);
    timeRow.appendChild(endField.box);
    categoryMenuEl.appendChild(timeRow);

    const timePreview = document.createElement('div');
    timePreview.textContent = `${formatTime(start)} – ${formatTime(end)}  ·  ${Math.round(end - start)} ${_t('sb_seconds', 'sn')}`;
    timePreview.style.cssText = 'font-size:12px;color:#a0a0a0;flex:1;text-align:center;margin-bottom:12px;';
    categoryMenuEl.appendChild(timePreview);

    const seg = document.createElement('div');
    seg.textContent = _t('sb_select_type', 'Tür seç:');
    seg.style.cssText = 'font-size:12px;color:#a0a0a0;margin-bottom:8px;';
    categoryMenuEl.appendChild(seg);

    let selectedCategory = 'sponsor';
    const catButtons = [];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    for (const cat of ADD_CATEGORIES) {
      const opt = document.createElement('button');
      opt.type = 'button';
      const isSelected = cat.id === selectedCategory;
      opt.style.cssText = `
        display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);
        border:1px solid ${isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)'};
        color:#ffffff;padding:10px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;
        transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease; text-align:left;
      `;
      opt.onmouseenter = () => { if(selectedCategory !== cat.id) { opt.style.borderColor = 'rgba(255,255,255,0.2)'; opt.style.background = 'rgba(255,255,255,0.06)'; } };
      opt.onmouseleave = () => { if(selectedCategory !== cat.id) { opt.style.borderColor = 'rgba(255,255,255,0.08)'; opt.style.background = 'rgba(255,255,255,0.03)'; } };
      opt.onmousedown = () => { opt.style.transform = 'scale(0.96)'; };
      opt.onmouseup = () => { opt.style.transform = 'scale(1)'; };
      const dot = document.createElement('span');
      dot.style.cssText = `width:9px;height:9px;border-radius:50%;background:${CATEGORY_COLORS[cat.id]};flex-shrink:0;`;
      const lbl = document.createElement('span');
      lbl.textContent = cat.label;
      opt.appendChild(dot);
      opt.appendChild(lbl);
      opt.addEventListener('click', () => {
        selectedCategory = cat.id;
        catButtons.forEach(b => {
          const isMe = (b.id === selectedCategory);
          b.el.style.borderColor = isMe ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)';
          b.el.style.background = isMe ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)';
        });
      });
      grid.appendChild(opt);
      catButtons.push({ id: cat.id, el: opt });
    }
    categoryMenuEl.appendChild(grid);

    const mkBtn = (label, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `
        background:${primary ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.05)'};
        border:1px solid ${primary ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.1)'};
        color:${primary ? '#000000' : '#ffffff'};padding:8px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;
        white-space:nowrap;transition:transform 0.1s ease, filter 0.15s ease, background 0.15s ease;
      `;
      b.onmouseenter = () => { b.style.filter = 'brightness(0.9)'; };
      b.onmouseleave = () => { b.style.filter = 'none'; };
      b.onmousedown = () => { b.style.transform = 'scale(0.96)'; };
      b.onmouseup = () => { b.style.transform = 'scale(1)'; };
      return b;
    };

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;margin-top:10px;';

    const cancel = mkBtn(_t('sb_cancel', 'Vazgeç'), false);
    cancel.style.cssText = 'flex:1;' + cancel.style.cssText;
    cancel.addEventListener('click', () => { hideCategoryMenu(); });
    actions.appendChild(cancel);

    const saveBtn = mkBtn(_t('sb_submit', 'Gönder'), true);
    saveBtn.style.cssText = 'flex:1;' + saveBtn.style.cssText;
    saveBtn.addEventListener('click', () => {
      applyInputs();
      hideCategoryMenu();
      submitAdd(start, end, selectedCategory);
    });
    actions.appendChild(saveBtn);

    categoryMenuEl.appendChild(actions);

    player.appendChild(categoryMenuEl);
    updatePreviewBlock(start, end);
  }

  function hideCategoryMenu() {
    if (categoryMenuEl) { categoryMenuEl.remove(); categoryMenuEl = null; }
    if (previewingIntervalGlobal) { clearInterval(previewingIntervalGlobal); previewingIntervalGlobal = null; }
    if (videoEl && previewPausedTime !== null) {
      videoEl.pause();
      videoEl.currentTime = previewPausedTime;
      previewPausedTime = null;
    }
    removePreviewBlock();
  }

  function updatePreviewBlock(start, end) {
    const container = document.getElementById('vadblock-sb-overlays');
    if (!container || !videoEl || !videoEl.duration) return;
    let prev = container.querySelector('#vadblock-sb-preview');
    if (!prev) {
      prev = document.createElement('div');
      prev.id = 'vadblock-sb-preview';
      prev.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        background: rgba(0, 212, 0, 0.4);
        border: 1px solid rgba(0, 212, 0, 0.8);
        z-index: 42;
        pointer-events: none;
        min-width: 2px;
        box-sizing: border-box;
      `;
      container.appendChild(prev);
    }
    const dur = videoEl.duration;
    const startPct = (start / dur) * 100;
    const endPct = (end / dur) * 100;
    const left = Math.min(startPct, endPct);
    const width = Math.max(2, Math.abs(endPct - startPct));
    prev.style.left = left + '%';
    prev.style.width = width + '%';
  }

  function removePreviewBlock() {
    const prev = document.getElementById('vadblock-sb-preview');
    if (prev) prev.remove();
  }

  async function submitAdd(start, end, category) {
    const userID = await ensureUserID();
    const seg = { videoId: currentVideoId, start, end, category };
    const payload = {
      videoID: seg.videoId,
      startTime: seg.start,
      endTime: seg.end,
      category: seg.category,
      userID: userID,
      videoTitle: (document.title || '').replace(/\s*-\s*YouTube\s*$/, '').trim(),
      videoDuration: (videoEl && videoEl.duration) ? Math.round(videoEl.duration) : 0
    };
    const ok = await submitSegmentToVade(payload);
    if (ok) {
      // Segment sunucuya "bekliyor" olarak kaydedildi; onaylanınca otomatik görünür.
      // Bu yüzden burada yerel listeye EKLEME — aksi halde F5'e kadar görünür,
      // sonra kaybolur (tutarsız). Gösterilecek olan onaylanmış segmentlerdir.
      showToast(category, Math.round(end - start), true, _t('sb_submitted', 'Katkın gönderildi'));
      refreshVadeSegments();
    } else {
      showToast(category, 0, true, _t('sb_submit_failed', 'Gönderilemedi — sunucuya ulaşılamadı'));
    }
  }

  // Gönderim sonrası onaylı listeyi tazele: kullanıcının katkısı onaylandıysa
  // F5 beklemeden yeni segmentler de görünsün.
  async function refreshVadeSegments() {
    if (!currentVideoId) return;
    const ours = await fetchVadeSegments(currentVideoId);
    const merged = mergeSegments(ours, segments.filter(s => s.source !== 'vade'));
    if (merged.length !== segments.length ||
        merged.some((s, i) => s.start !== segments[i].start || s.end !== segments[i].end)) {
      segments = merged;
      renderOverlays();
    }
  }

  // İki kaynağı birleştir: vade segmentleri önceliklidir, çakışanlar teke iner.
  function mergeSegments(vade, others) {
    const out = vade.slice();
    for (const s of others) {
      const dup = out.some(o =>
        Math.abs(o.start - s.start) < 0.5 && Math.abs(o.end - s.end) < 0.5);
      if (!dup) out.push(s);
    }
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  // ─── Toast Bildirimi ───
  function showToast(category, seconds, manual, customMsg) {
    if (toastEl) toastEl.remove();
    ensureStyles();

    const label = getCategoryLabel(category);
    const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.sponsor;
    const duration = Math.round(seconds);

    let inner;
    if (customMsg) {
      inner = `<span style="font-weight:600;font-size:12.5px;">${customMsg}</span>`;
    } else {
      inner = `
      <span style="display:inline-block;vertical-align:middle;width:8px;height:8px;border-radius:50%;background:${color};margin-right:7px;"></span>
      <span style="font-weight:600;font-size:12.5px;">${label} ${manual ? _t('sb_manual_skipped', 'manuel atlandı') : _t('sb_skipped', 'atlandı')}</span>
      <span style="color:rgba(241,241,241,0.72);font-size:12px;margin-left:7px;">${_t('sb_time_saved', duration + ' sn kazandırdı').replace('$1', duration)}</span>
      <span style="color:rgba(241,241,241,0.5);font-size:11.5px;margin-left:9px;">${_t('sb_total', 'Toplam:')} ${formatDuration(skippedSecondsTotal)}</span>`;
    }

    toastEl = document.createElement('div');
    toastEl.id = 'vadblock-sb-toast';
    toastEl.innerHTML = inner;
    toastEl.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(28, 28, 28, 0.95);
      color: #f1f1f1;
      padding: 6px 14px;
      border-radius: 4px;
      font-family: 'Roboto', Arial, sans-serif;
      z-index: 99999;
      pointer-events: none;
      white-space: nowrap;
      animation: vadblock-sb-toast-in 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    (document.querySelector('.html5-video-player') || document.body).appendChild(toastEl);

    setTimeout(() => {
      if (toastEl) {
        toastEl.style.animation = 'vadblock-sb-toast-out 0.25s ease forwards';
        setTimeout(() => { if (toastEl) toastEl.remove(); toastEl = null; }, 260);
      }
    }, 2600);
  }

  function getCategoryLabel(cat) {
    const labels = {
      sponsor: _t('sb_cat_sponsor', 'Sponsor'),
      selfpromo: _t('sb_cat_selfpromo', 'Öz Tanıtım'),
      interaction: _t('sb_cat_interaction', 'Etkileşim'),
      intro: _t('sb_cat_intro', 'İntro'),
      outro: _t('sb_cat_outro', 'Outro'),
      preview: _t('sb_cat_preview', 'Önizleme'),
      music_offtopic: _t('sb_cat_music', 'Müzik Dışı')
    };
    return labels[cat] || cat;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatTimeInput(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function parseTimeInput(str) {
    if (typeof str !== 'string') return null;
    str = str.trim();
    if (!str) return null;

    // Nokta/virgülleri iki noktaya çevir (38,00 -> 38:00)
    str = str.replace(/[.,]/g, ':');

    const parts = str.split(':').map(p => p.trim());
    if (parts.length > 3) return null;
    const nums = parts.map(p => {
      if (!/^\d+$/.test(p)) return NaN;
      return parseInt(p, 10);
    });
    if (nums.some(n => isNaN(n))) return null;

    let sec = 0;
    if (nums.length === 1) {
      // Yalnızca rakam -> saniye (örn: 42 -> 0:42)
      sec = nums[0];
    } else if (nums.length === 2) {
      // mm:ss (örn: 38:00 -> 38 dk 0 sn)
      sec = nums[0] * 60 + nums[1];
    } else {
      // hh:mm:ss
      sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
    }
    if (!isFinite(sec) || sec < 0) return null;
    return sec;
  }

  // ─── İstatistik (Atlanan Süre) ───
  function loadSkippedStats() {
    chrome.storage.local.get({ vadblockSkippedSeconds: 0 }, (r) => {
      skippedSecondsTotal = r.vadblockSkippedSeconds || 0;
    });
  }

  function addSkippedSeconds(seconds) {
    const sec = Math.round(seconds);
    if (!(sec > 0)) return;
    skippedSecondsTotal += sec;
    chrome.storage.local.set({ vadblockSkippedSeconds: skippedSecondsTotal });
  }

  function formatDuration(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ' ' + _t('sb_hours', 'sa') + ' ' + m + ' ' + _t('sb_minutes', 'dk');
    if (m > 0) return m + ' ' + _t('sb_minutes', 'dk') + ' ' + s + ' ' + _t('sb_seconds', 'sn');
    return s + ' ' + _t('sb_seconds', 'sn');
  }

  // ─── Ana İşlem ───
  async function processVideo() {
    const enabled = await isEnabled();
    if (!enabled) return;

    const videoId = getVideoId();
    if (!videoId || videoId === currentVideoId) return;

    currentVideoId = videoId;
    segments = [];
    skippedSegments.clear();
    removeOverlays();
    if (addBtnEl) { addBtnEl.remove(); addBtnEl = null; }
    console.log('[vAdBlock SponsorSkip] işleniyor, videoId:', videoId);

    // Video elementini bul
    videoEl = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!videoEl) {
      console.log('[vAdBlock SponsorSkip] video elementi bulunamadı, 1.5sn sonra tekrar denenecek');
      currentVideoId = null;
      setTimeout(processVideo, 1500);
      return;
    }

    // SponsorBlock API'den veri almayı dene
    const sbSegments = await fetchSBSegments(videoId);
    if (sbSegments.length > 0) {
      segments = sbSegments;
      console.log(`[vAdBlock SponsorSkip] SponsorBlock API: ${segments.length} segment bulundu`);
    } else {
      // API verisi yoksa altyazı analizine düş
      const captions = await fetchCaptions(videoId);
      if (captions.length > 0) {
        console.log(`[vAdBlock SponsorSkip] ${captions.length} altyazı satırı bulundu, analiz ediliyor...`);
        segments = analyzeSegments(captions);
      } else {
        console.log('[vAdBlock SponsorSkip] SponsorBlock verisi ve altyazı bulunamadı:', videoId);
      }
    }

    if (segments.length > 0) {
      console.log(`[vAdBlock SponsorSkip] ${segments.length} segment tespit edildi:`,
        segments.map(s => `${s.category} (${formatTime(s.start)}-${formatTime(s.end)})`));

      // İlerleme çubuğu işaretçilerini ekle
      // Video metadata yüklendiğinde overlay render et
      if (videoEl.duration) {
        renderOverlays();
      } else {
        videoEl.addEventListener('loadedmetadata', () => renderOverlays(), { once: true });
      }
      videoEl.addEventListener('durationchange', () => renderOverlays());
      videoEl.addEventListener('seeked', () => renderOverlays());

      // Monitörlemeyi başlat
      startMonitoring();
    } else {
      console.log('[vAdBlock SponsorSkip] Sponsor segmenti tespit edilemedi:', videoId);
    }
  }

  // ─── Event Dinleyicileri ───

  // YouTube SPA navigasyonu
  window.addEventListener('yt-navigate-finish', () => {
    currentVideoId = null; // Force re-process
    setTimeout(processVideo, 1500);
  });

  // Sayfa ilk yüklendiğinde
  loadSkippedStats();
  loadSbSettings();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(processVideo, 2000));
  } else {
    setTimeout(processVideo, 2000);
  }

  // URL değişikliklerini de yakala (popstate)
  window.addEventListener('popstate', () => {
    currentVideoId = null;
    setTimeout(processVideo, 1500);
  });

  // Video elementi değişirse (SPA)
  const videoObserver = new MutationObserver(() => {
    const newVideo = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (newVideo && newVideo !== videoEl) {
      videoEl = newVideo;
      if (segments.length > 0) {
        startMonitoring();
        if (videoEl.duration) renderOverlays();
      }
    }
  });

  const playerContainer = document.getElementById('player-container-inner') || document.getElementById('movie_player');
  if (playerContainer) {
    videoObserver.observe(playerContainer, { childList: true, subtree: true });
  }

  // Fullscreen değişikliklerinde overlay yeniden çiz
  document.addEventListener('fullscreenchange', () => {
    hideTooltip();
    if (segments.length > 0) {
      setTimeout(renderOverlays, 500);
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openSponsorMenu') {
      if (videoEl) {
        const start = videoEl.currentTime;
        const end = Math.min(videoEl.duration, start + 10);
        showCategoryPanel(start, end);
        sendResponse({success: true});
      }
    }
  });

})();
