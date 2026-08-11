<?php
/* vAdBlock SponsorSkip — Segment Onaylama Sayfası
   cPanel: public_html/api/submit.php olarak yükle (skipsegments.php ile aynı klasöre).
   Eklentiden ?videoID=..&start=..&end=..&category=..&userID=..&title=..&duration=.. alır.
*/

$videoID   = isset($_GET['videoID']) ? preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['videoID']) : '';
$startRaw  = isset($_GET['start'])  ? $_GET['start']  : '';
$endRaw    = isset($_GET['end'])    ? $_GET['end']    : '';
$category  = isset($_GET['category']) ? $_GET['category'] : 'sponsor';
$userID    = isset($_GET['userID']) ? preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['userID']) : '';
$title     = isset($_GET['title']) ? trim($_GET['title']) : '';
$duration  = isset($_GET['duration']) ? (float) $_GET['duration'] : 0;

$allowedCategories = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic'];
if (!in_array($category, $allowedCategories, true)) $category = 'sponsor';

$start = is_numeric($startRaw) ? (float) $startRaw : -1;
$end   = is_numeric($endRaw)   ? (float) $endRaw   : -1;

$valid = ($videoID !== '' && $start >= 0 && $end > $start && $end - $start >= 1);

function fmtSec($sec) {
    $sec = max(0, (int) round($sec));
    $h = floor($sec / 3600);
    $m = floor(($sec % 3600) / 60);
    $s = $sec % 60;
    if ($h > 0) return $h . ':' . str_pad($m, 2, '0', STR_PAD_LEFT) . ':' . str_pad($s, 2, '0', STR_PAD_LEFT);
    return $m . ':' . str_pad($s, 2, '0', STR_PAD_LEFT);
}

function esc($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

$CAT_COLORS = [
    'sponsor' => '#00d400',
    'selfpromo' => '#ffff00',
    'interaction' => '#cc00ff',
    'intro' => '#00ffff',
    'outro' => '#0202ed',
    'preview' => '#008fd6',
    'music_offtopic' => '#ff9900'
];
$catColor = $CAT_COLORS[$category] ?? '#00d400';

$catLabels = [
    'sponsor' => 'Sponsor',
    'selfpromo' => 'Öz Tanıtım',
    'interaction' => 'Etkileşim',
    'intro' => 'İntro',
    'outro' => 'Outro',
    'preview' => 'Önizleme',
    'music_offtopic' => 'Müzik Dışı'
];
$catLabel = $catLabels[$category] ?? $category;
?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Segment Onaylama · vAdBlock</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    background: radial-gradient(1200px 600px at 20% -10%, #16213e 0%, #0d1117 55%, #0b0f14 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: #e6edf3;
  }
  .card {
    width: 100%;
    max-width: 520px;
    background: rgba(22, 27, 34, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.55);
  }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 6px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.3px;
    margin-bottom: 16px;
  }
  .badge .dot { width: 8px; height: 8px; border-radius: 50%; background: #00d400; }
  h1 { font-size: 21px; font-weight: 700; margin-bottom: 6px; }
  .video-title { font-size: 14px; color: #9fb0c3; margin-bottom: 22px; line-height: 1.45; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.07);
    gap: 12px;
  }
  .row .label { font-size: 12px; color: #7d8b9f; text-transform: uppercase; letter-spacing: 0.5px; }
  .row .value { font-size: 14px; font-weight: 600; text-align: right; word-break: break-all; }
  .row .value.mono { font-family: 'Consolas', 'Menlo', monospace; font-size: 13px; }
  .seg-times {
    display: flex; gap: 10px; margin: 18px 0 4px;
  }
  .seg-box {
    flex: 1; text-align: center;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px; padding: 14px 10px;
  }
  .seg-box .st-label { font-size: 11px; color: #7d8b9f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .seg-box .st-time { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .seg-box .st-dur { font-size: 12px; color: #9fb0c3; margin-top: 4px; }
  .seg-box.green .st-time { color: #00d400; }
  .seg-box.arrow { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; font-size: 18px; color: #7d8b9f; }
  .btn-group { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
  .btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    border: none; border-radius: 12px; cursor: pointer;
    font-family: inherit; font-size: 14px; font-weight: 600;
    padding: 13px 16px; transition: transform 0.1s ease, filter 0.15s ease, background 0.15s ease;
  }
  .btn:hover { filter: brightness(1.08); }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.6; cursor: default; }
  .btn-play { background: rgba(255,255,255,0.06); color: #e6edf3; border: 1px solid rgba(255,255,255,0.14); }
  .btn-primary { background: #e6edf3; color: #0b0f14; }
  .btn-danger { background: rgba(255,255,255,0.05); color: #c9d4e1; border: 1px solid rgba(255,255,255,0.14); }
  .status {
    margin-top: 18px; text-align: center; font-size: 14px; font-weight: 600;
    min-height: 22px; border-radius: 10px; padding: 12px;
  }
  .status.ok { background: rgba(0,212,0,0.12); color: #00d400; border: 1px solid rgba(0,212,0,0.25); }
  .status.err { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .status.info { color: #9fb0c3; }
  .foot { margin-top: 18px; text-align: center; font-size: 12px; color: #5a6a7e; }
  .kbd { font-family: 'Consolas', 'Menlo', monospace; background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 5px; }
  a.go-link { text-decoration: none; color: inherit; }
  .error-box {
    background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 12px; padding: 18px; margin-top: 18px;
  }
  .error-box h2 { font-size: 16px; color: #f87171; margin-bottom: 8px; }
  .error-box p { font-size: 13px; color: #c9d4e1; }
</style>
</head>
<body>
<?php if (!$valid): ?>
  <div class="card">
    <h1>Geçersiz istek</h1>
    <div class="error-box">
      <h2>Segment verileri eksik ya da hatalı.</h2>
      <p>Bu sayfa doğrudan değil, vAdBlock eklentisinden "Onayla &amp; Gönder" ile açılmalıdır.</p>
    </div>
  </div>
<?php else: ?>
  <div class="card">
    <span class="badge"><span class="dot" style="background:<?= $catColor ?>"></span> vAdBlock Sponsor Atlama</span>
    <h1><?= $title !== '' ? esc($title) : 'Segment Onaylama' ?></h1>
    <div class="video-title">
      Video: <span class="kbd"><?= esc($videoID) ?></span>
      <?php if ($duration > 0): ?> · Süre: <strong><?= fmtSec($duration) ?></strong><?php endif; ?>
    </div>

    <div class="seg-times">
      <div class="seg-box green">
        <div class="st-label">Başlangıç</div>
        <div class="st-time"><?= fmtSec($start) ?></div>
      </div>
      <div class="seg-box arrow">→</div>
      <div class="seg-box">
        <div class="st-label">Bitiş</div>
        <div class="st-time"><?= fmtSec($end) ?></div>
        <div class="st-dur"><?= round($end - $start) ?> saniye</div>
      </div>
    </div>

    <div class="row">
      <span class="label">Tür</span>
      <span class="value"><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:<?= $catColor ?>;margin-right:6px;vertical-align:middle;"></span><?= esc($catLabel) ?></span>
    </div>
    <div class="row">
      <span class="label">Kullanıcı ID</span>
      <span class="value mono"><?= $userID !== '' ? esc(substr($userID, 0, 12)) . '…' : 'anonim' ?></span>
    </div>

    <div class="btn-group">
      <a class="btn btn-play go-link" target="_blank" rel="noopener"
         href="https://www.youtube.com/watch?v=<?= esc($videoID) ?>&t=<?= (int) $start ?>">
        ▶ Başlangıcı kontrol et (<?= fmtSec($start) ?>)
      </a>
      <a class="btn btn-play go-link" target="_blank" rel="noopener"
         href="https://www.youtube.com/watch?v=<?= esc($videoID) ?>&t=<?= (int) $end ?>">
        ▶ Bitişi kontrol et (<?= fmtSec($end) ?>)
      </a>
      <button class="btn btn-primary" id="confirmBtn">✓ Onayla ve Gönder</button>
      <button class="btn btn-danger" id="cancelBtn">✕ Vazgeç</button>
    </div>

    <div class="status info" id="status"></div>
    <div class="foot">Kayıt, bu sunucunun <span class="kbd">skipsegments.php</span> uç noktasına yazılır.</div>
  </div>

  <script>
    (function () {
      const VIDEO_ID = <?= json_encode($videoID) ?>;
      const START    = <?= json_encode($start) ?>;
      const END      = <?= json_encode($end) ?>;
      const CATEGORY = <?= json_encode($category) ?>;
      const USER_ID  = <?= json_encode($userID) ?>;
      const STATUS   = document.getElementById('status');
      const BTN      = document.getElementById('confirmBtn');

      function setStatus(text, cls) {
        STATUS.textContent = text;
        STATUS.className = 'status ' + (cls || 'info');
      }

      document.getElementById('cancelBtn').addEventListener('click', function () {
        window.close();
      });

      BTN.addEventListener('click', async function () {
        if (BTN.disabled) return;
        BTN.disabled = true;
        BTN.textContent = 'Gönderiliyor…';
        setStatus('Gönderiliyor, lütfen bekleyin…', 'info');
        try {
          const res = await fetch('skipsegments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoID: VIDEO_ID,
              startTime: START,
              endTime: END,
              category: CATEGORY,
              userID: USER_ID
            })
          });
          let data = {};
          try { data = await res.json(); } catch (e) {}
          if (res.ok && data.success) {
            setStatus('✓ Segment başarıyla kaydedildi!', 'ok');
            BTN.textContent = '✓ Gönderildi';
            document.getElementById('cancelBtn').textContent = 'Pencereyi Kapat';
          } else {
            setStatus('Gönderilemedi: sunucu ' + res.status + ' döndürdü.', 'err');
            BTN.textContent = 'Tekrar Dene';
            BTN.disabled = false;
          }
        } catch (e) {
          setStatus('Gönderilemedi — sunucuya ulaşılamadı.', 'err');
          BTN.textContent = 'Tekrar Dene';
          BTN.disabled = false;
        }
      });
    })();
  </script>
<?php endif; ?>
</body>
</html>
