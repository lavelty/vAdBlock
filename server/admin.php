<?php
/* vAdBlock SponsorSkip — Admin Kontrol Paneli
   cPanel: public_html/api/admin.php olarak yükle (config.php ile aynı klasöre).
   Şifre ve DB bilgileri config.php'de. Sonra https://siten.com/api/admin.php ile aç.
*/

// ─── Yapılandırma (DB + yönetim şifresi) ───
require __DIR__ . '/config.php';

// ─── Yardımcılar ───
function esc($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

// Tabloyu oluştur + eski tablodan eksik sütunları ekle (eski şemadan yükseltme)
function ensureSchema($mysqli) {
    $mysqli->query("CREATE TABLE IF NOT EXISTS sponsor_segments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id VARCHAR(32) NOT NULL,
        start_time DECIMAL(10,2) NOT NULL,
        end_time DECIMAL(10,2) NOT NULL,
        category VARCHAR(32) NOT NULL DEFAULT 'sponsor',
        user_id VARCHAR(64) NOT NULL DEFAULT '',
        video_title VARCHAR(255) NOT NULL DEFAULT '',
        video_duration DECIMAL(10,2) NOT NULL DEFAULT 0,
        ip_address VARCHAR(45) NOT NULL DEFAULT '',
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_video (video_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $cols = [
        'video_title'    => 'VARCHAR(255) NOT NULL DEFAULT \'\'',
        'video_duration' => 'DECIMAL(10,2) NOT NULL DEFAULT 0',
        'ip_address'     => 'VARCHAR(45) NOT NULL DEFAULT \'\'',
        'status'         => 'VARCHAR(16) NOT NULL DEFAULT \'pending\''
    ];
    foreach ($cols as $col => $def) {
        $r = $mysqli->query("SHOW COLUMNS FROM sponsor_segments LIKE '" . $col . "'");
        if ($r && $r->num_rows === 0) {
            $mysqli->query("ALTER TABLE sponsor_segments ADD COLUMN " . $col . " " . $def);
        }
    }
    $idx = $mysqli->query("SHOW INDEX FROM sponsor_segments WHERE Key_name = 'idx_status'");
    if ($idx && $idx->num_rows === 0) {
        $mysqli->query("CREATE INDEX idx_status ON sponsor_segments (status)");
    }
}

function fmtSec($sec) {
    $sec = max(0, (int) round((float) $sec));
    $h = floor($sec / 3600);
    $m = floor(($sec % 3600) / 60);
    $s = $sec % 60;
    if ($h > 0) return $h . ':' . str_pad($m, 2, '0', STR_PAD_LEFT) . ':' . str_pad($s, 2, '0', STR_PAD_LEFT);
    return $m . ':' . str_pad($s, 2, '0', STR_PAD_LEFT);
}

$CAT_COLORS = [
    'sponsor' => '#00d400',
    'selfpromo' => '#f9c800',
    'interaction' => '#cc00ff',
    'intro' => '#00bcd4',
    'outro' => '#0202ed',
    'preview' => '#008fd6',
    'music_offtopic' => '#ff9900'
];
$CAT_LABELS = [
    'sponsor' => 'Sponsor',
    'selfpromo' => 'Öz Tanıtım',
    'interaction' => 'Etkileşim',
    'intro' => 'İntro',
    'outro' => 'Outro',
    'preview' => 'Önizleme',
    'music_offtopic' => 'Müzik Dışı'
];

$STATUS_LABELS = ['pending' => 'Bekliyor', 'approved' => 'Onaylı', 'rejected' => 'Reddedildi'];
$STATUS_COLORS = ['pending' => '#F59E0B', 'approved' => '#10B981', 'rejected' => '#EF4444'];

// ─── Oturum ───
session_start();

// ─── Aksiyonlar (POST) ───
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['admin_ok'])) {
    $mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
    if (!$mysqli->connect_errno) {
        $mysqli->set_charset('utf8mb4');
        ensureSchema($mysqli);
        $action = $_POST['action'] ?? '';
        $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
        if ($id > 0) {
            if ($action === 'approve') {
                $stmt = $mysqli->prepare("UPDATE sponsor_segments SET status = 'approved' WHERE id = ?");
                $stmt->bind_param('i', $id);
                $stmt->execute();
            } elseif ($action === 'reject') {
                $stmt = $mysqli->prepare("UPDATE sponsor_segments SET status = 'rejected' WHERE id = ?");
                $stmt->bind_param('i', $id);
                $stmt->execute();
            } elseif ($action === 'delete') {
                $stmt = $mysqli->prepare("DELETE FROM sponsor_segments WHERE id = ?");
                $stmt->bind_param('i', $id);
                $stmt->execute();
            }
        }
    }
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

// ─── Giriş kontrolü ───
if (isset($_POST['pass']) && hash_equals($ADMIN_PASS, (string) $_POST['pass'])) {
    $_SESSION['admin_ok'] = true;
}
if (isset($_GET['logout'])) {
    unset($_SESSION['admin_ok']);
}

$loggedIn = !empty($_SESSION['admin_ok']);
?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>vAdBlock · Segment Yönetimi</title>
<style>
  :root {
    --bg: #F8FAFC;
    --card: #FFFFFF;
    --card-soft: rgba(255,255,255,0.72);
    --text: #1E293B;
    --muted: #64748B;
    --muted-2: #94A3B8;
    --accent: #7C3AED;
    --accent-2: #8B5CF6;
    --accent-soft: rgba(124, 58, 237, 0.08);
    --green: #10B981;
    --red: #EF4444;
    --amber: #F59E0B;
    --border: rgba(15, 23, 42, 0.06);
    --border-strong: rgba(15, 23, 42, 0.1);
    --shadow: 0 10px 40px -12px rgba(15, 23, 42, 0.12);
    --shadow-sm: 0 4px 12px -4px rgba(15, 23, 42, 0.06);
    --radius: 22px;
    --radius-sm: 14px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
  }

  /* Yumuşak mesh arka plan (eklenti ayarlarıyla aynı) */
  .blob { position: fixed; filter: blur(90px); opacity: 0.55; border-radius: 50%; z-index: 0; pointer-events: none; }
  .blob-1 { top: -15%; left: -10%; width: 55vw; height: 55vw; background: #DDD6FE; }
  .blob-2 { bottom: -25%; right: -12%; width: 60vw; height: 60vw; background: #DBEAFE; }
  .blob-3 { top: 45%; left: 42%; width: 45vw; height: 45vw; background: #FCE7F3; opacity: 0.4; }

  .wrap {
    position: relative; z-index: 1;
    max-width: 1060px; margin: 0 auto; padding: 36px 20px 60px;
  }

  /* Üst bar */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 14px; flex-wrap: wrap; margin-bottom: 26px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .logo {
    width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    display: flex; align-items: center; justify-content: center; color: #fff;
    box-shadow: 0 8px 20px -6px rgba(124, 58, 237, 0.5);
  }
  .brand h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  .brand .sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .topbar .logout-btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--card); border: 1px solid var(--border-strong);
    color: var(--muted); text-decoration: none; font-size: 13.5px; font-weight: 600;
    padding: 10px 18px; border-radius: 100px; transition: all 0.2s ease;
  }
  .topbar .logout-btn:hover { color: var(--red); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.05); transform: translateY(-1px); }

  /* İstatistik kartları */
  .stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px; margin-bottom: 24px;
  }
  .stat-card {
    background: var(--card-soft);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 18px 20px;
    display: flex; align-items: center; gap: 14px;
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .stat-card .ico {
    width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .stat-card .lbl { font-size: 12.5px; color: var(--muted); font-weight: 600; }
  .stat-card .val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .stat-card.pending .ico { background: rgba(245,158,11,0.12); }
  .stat-card.pending .val { color: var(--amber); }
  .stat-card.approved .ico { background: rgba(16,185,129,0.12); }
  .stat-card.approved .val { color: var(--green); }
  .stat-card.rejected .ico { background: rgba(239,68,68,0.12); }
  .stat-card.rejected .val { color: var(--red); }
  .stat-card.total .ico { background: var(--accent-soft); }
  .stat-card.total .val { color: var(--accent); }

  /* Sekmeler (segmented) */
  .tabs {
    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 22px;
    background: rgba(15,23,42,0.045); padding: 5px; border-radius: 100px; width: fit-content;
  }
  .tab {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 18px; border-radius: 100px; text-decoration: none;
    font-size: 13.5px; font-weight: 600; color: var(--muted);
    transition: all 0.2s ease;
  }
  .tab:hover { color: var(--text); }
  .tab.active { background: var(--card); color: var(--accent); box-shadow: 0 2px 8px rgba(15,23,42,0.1); }
  .tab .cnt {
    background: rgba(15,23,42,0.06); border-radius: 999px;
    padding: 1px 8px; font-size: 11.5px; font-weight: 700;
  }
  .tab.active .cnt { background: var(--accent-soft); color: var(--accent); }

  /* Segment kartları */
  .seg {
    background: var(--card-soft);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    margin-bottom: 14px;
    box-shadow: var(--shadow-sm);
    display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap;
    transition: all 0.2s ease;
    position: relative;
  }
  .seg:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
  .seg::before {
    content: ""; position: absolute; left: 0; top: 18px; bottom: 18px; width: 4px;
    border-radius: 0 4px 4px 0; background: var(--status-color, var(--muted-2));
  }
  .seg.st-pending { --status-color: var(--amber); }
  .seg.st-approved { --status-color: var(--green); }
  .seg.st-rejected { --status-color: var(--red); }

  .thumb {
    width: 150px; height: 84px; border-radius: 12px; object-fit: cover;
    background: rgba(15,23,42,0.05); flex-shrink: 0; box-shadow: 0 4px 10px rgba(15,23,42,0.12);
  }
  .seg-main { flex: 1; min-width: 260px; }
  .seg-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 5px; line-height: 1.3; }
  .seg-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .kbd {
    font-family: 'Consolas', 'Menlo', monospace; font-size: 11.5px;
    background: rgba(124,58,237,0.08); color: var(--accent);
    border-radius: 6px; padding: 2px 7px;
  }
  .seg-meta .dim { font-size: 12.5px; color: var(--muted-2); }
  .seg-meta .dim strong { color: var(--text); font-weight: 600; }

  /* Rozetler */
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11.5px; font-weight: 700; padding: 4px 11px; border-radius: 999px;
  }
  .badge .dot { width: 7px; height: 7px; border-radius: 50%; }
  .b-cat { color: var(--cat-color, #333); background: rgba(15,23,42,0.04); border: 1px solid rgba(15,23,42,0.06); }
  .b-status { color: var(--st-color); background: var(--st-bg); border: 1px solid var(--st-border); }
  .b-pending { --st-color: #B45309; --st-bg: rgba(245,158,11,0.1); --st-border: rgba(245,158,11,0.25); }
  .b-approved { --st-color: #047857; --st-bg: rgba(16,185,129,0.1); --st-border: rgba(16,185,129,0.25); }
  .b-rejected { --st-color: #B91C1C; --st-bg: rgba(239,68,68,0.1); --st-border: rgba(239,68,68,0.25); }

  /* Zaman kutuları */
  .seg-times { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .tbox {
    display: inline-block; text-align: center; min-width: 74px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 6px rgba(15,23,42,0.04);
  }
  .tbox .lbl { font-size: 10px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
  .tbox .val { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tbox.green .val { color: var(--green); }
  .tbox.amber .val { color: var(--amber); }
  .tbox .dur { font-size: 11px; color: var(--muted-2); font-weight: 600; margin-top: 2px; }
  .tarrow { color: var(--muted-2); font-size: 14px; }

  /* Meta ızgara */
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 4px; }
  .meta-cell {
    background: rgba(255,255,255,0.55); border: 1px solid var(--border);
    border-radius: 10px; padding: 8px 12px;
  }
  .meta-cell .k { font-size: 10px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  .meta-cell .v { font-size: 12.5px; font-weight: 600; margin-top: 2px; word-break: break-all; }
  .meta-cell .v.mono { font-family: 'Consolas', monospace; font-size: 11.5px; color: var(--muted); }

  /* Aksiyonlar */
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; width: 100%; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px; justify-content: center;
    border: none; border-radius: 100px; cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 700;
    padding: 9px 16px; transition: all 0.15s ease; text-decoration: none;
  }
  .btn:active { transform: scale(0.96); }
  .btn-sm { padding: 7px 13px; font-size: 12.5px; }
  .btn-ok { background: var(--green); color: #fff; box-shadow: 0 6px 14px -5px rgba(16,185,129,0.5); }
  .btn-ok:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .btn-no { background: rgba(239,68,68,0.12); color: var(--red); border: 1px solid rgba(239,68,68,0.25); }
  .btn-no:hover { background: rgba(239,68,68,0.2); }
  .btn-ghost { background: rgba(15,23,42,0.05); color: var(--muted); border: 1px solid var(--border-strong); }
  .btn-ghost:hover { background: rgba(15,23,42,0.09); color: var(--text); }
  .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; box-shadow: 0 6px 16px -6px rgba(124,58,237,0.5); }
  .btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }

  .link { color: var(--accent); text-decoration: none; font-size: 13px; font-weight: 600; }
  .link:hover { text-decoration: underline; }

  .empty {
    text-align: center; padding: 56px 24px; color: var(--muted);
    background: var(--card-soft); border: 2px dashed var(--border-strong);
    border-radius: var(--radius); font-size: 14.5px; font-weight: 500;
  }
  .empty .big { font-size: 40px; margin-bottom: 12px; }

  /* Giriş ekranı */
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .login-card {
    width: 100%; max-width: 400px;
    background: var(--card-soft); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border); border-radius: 28px; padding: 36px;
    box-shadow: var(--shadow); text-align: center;
  }
  .login-card .logo {
    width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 18px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px;
    box-shadow: 0 12px 28px -8px rgba(124, 58, 237, 0.55);
  }
  .login-card h2 { font-size: 21px; margin-bottom: 6px; letter-spacing: -0.02em; }
  .login-card .hint { font-size: 13.5px; color: var(--muted); margin-bottom: 24px; }
  .login-card input[type=password] {
    width: 100%; padding: 14px 16px; border-radius: 14px; text-align: center;
    background: var(--card); border: 2px solid var(--border-strong); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; margin-bottom: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .login-card input[type=password]:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .login-card button { width: 100%; }
  .err { color: var(--red); font-size: 13px; font-weight: 600; margin-bottom: 12px; }

  /* Filtre + arama çubuğu */
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
  .search-box {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 220px; max-width: 340px;
    background: var(--card-soft); border: 1px solid var(--border); border-radius: 100px;
    padding: 9px 16px; color: var(--muted-2); transition: all 0.2s ease;
  }
  .search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .search-box input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 13.5px; color: var(--text); }
  .search-box input::placeholder { color: var(--muted-2); }

  .hidden { display: none !important; }
  .fade-in { animation: fadeIn 0.35s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  @media (max-width: 640px) {
    .wrap { padding: 22px 14px 40px; }
    .thumb { width: 100%; height: 140px; }
    .actions { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>
</head>
<body>

<?php if (!$loggedIn): ?>
<div class="login-wrap">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="login-card fade-in">
    <div class="logo">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
    </div>
    <h2>Yönetici Girişi</h2>
    <div class="hint">vAdBlock Sponsor Skip yönetim paneline hoş geldin</div>
    <?php if (isset($loginErr)): ?><div class="err">Yanlış şifre, tekrar dene.</div><?php endif; ?>
    <form method="post">
      <input type="password" name="pass" placeholder="Yönetim şifresi" autofocus required>
      <button class="btn btn-primary" type="submit">Giriş Yap</button>
    </form>
  </div>
</div>
<?php else: ?>
  <?php
  $mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
  if ($mysqli->connect_errno) {
      echo '<div class="wrap"><div class="card">Veritabanı bağlantı hatası: MySQL bilgilerini kontrol et.</div></div>';
      exit;
  }
  $mysqli->set_charset('utf8mb4');
  ensureSchema($mysqli);

  $filter = $_GET['f'] ?? 'pending';
  if (!in_array($filter, ['all', 'pending', 'approved', 'rejected'], true)) $filter = 'pending';

  $counts = ['all' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0];
  $res = $mysqli->query("SELECT status, COUNT(*) c FROM sponsor_segments GROUP BY status");
  while ($row = $res->fetch_assoc()) {
      $counts[$row['status']] = (int) $row['c'];
      $counts['all'] += (int) $row['c'];
  }

  $sql = "SELECT * FROM sponsor_segments";
  if ($filter !== 'all') $sql .= " WHERE status = '" . $mysqli->real_escape_string($filter) . "'";
  $sql .= " ORDER BY created_at DESC";
  $res = $mysqli->query($sql);
  ?>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="wrap">
    <div class="topbar">
      <div class="brand">
        <div class="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
        </div>
        <div>
          <h1>Segment Yönetimi</h1>
          <div class="sub">vAdBlock Sponsor Skip · gönderimleri incele, onayla veya reddet</div>
        </div>
      </div>
      <a class="logout-btn" href="?logout=1">Çıkış yap</a>
    </div>

    <div class="stats">
      <div class="stat-card total">
        <div class="ico">📊</div>
        <div><div class="lbl">Toplam Gönderim</div><div class="val"><?= $counts['all'] ?></div></div>
      </div>
      <div class="stat-card pending">
        <div class="ico">⏳</div>
        <div><div class="lbl">Bekleyen</div><div class="val"><?= $counts['pending'] ?></div></div>
      </div>
      <div class="stat-card approved">
        <div class="ico">✅</div>
        <div><div class="lbl">Onaylı</div><div class="val"><?= $counts['approved'] ?></div></div>
      </div>
      <div class="stat-card rejected">
        <div class="ico">🚫</div>
        <div><div class="lbl">Reddedilen</div><div class="val"><?= $counts['rejected'] ?></div></div>
      </div>
    </div>

    <div class="toolbar">
      <div class="tabs">
        <a class="tab <?= $filter === 'pending' ? 'active' : '' ?>" href="?f=pending">Bekliyor<span class="cnt"><?= $counts['pending'] ?></span></a>
        <a class="tab <?= $filter === 'approved' ? 'active' : '' ?>" href="?f=approved">Onaylı<span class="cnt"><?= $counts['approved'] ?></span></a>
        <a class="tab <?= $filter === 'rejected' ? 'active' : '' ?>" href="?f=rejected">Reddedilen<span class="cnt"><?= $counts['rejected'] ?></span></a>
        <a class="tab <?= $filter === 'all' ? 'active' : '' ?>" href="?f=all">Tümü<span class="cnt"><?= $counts['all'] ?></span></a>
      </div>
      <div class="search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="segSearch" placeholder="Video başlığı veya ID ara...">
      </div>
    </div>

    <div id="segList">
    <?php if ($res && $res->num_rows === 0): ?>
      <div class="empty">
        <div class="big">🗂️</div>
        <?php if ($filter === 'pending'): ?>Burada onay bekleyen segment yok. Kullanıcılar gönderdikçe burada görünecek.
        <?php elseif ($filter === 'approved'): ?>Henüz onaylanmış segment yok.
        <?php elseif ($filter === 'rejected'): ?>Henüz reddedilen segment yok.
        <?php else: ?>Henüz hiç segment gönderilmemiş.<?php endif; ?>
      </div>
    <?php else: while ($row = $res->fetch_assoc()): ?>
      <?php
      $catColor = $CAT_COLORS[$row['category']] ?? '#00d400';
      $catLabel = $CAT_LABELS[$row['category']] ?? $row['category'];
      $statusLabel = $STATUS_LABELS[$row['status']] ?? $row['status'];
      $statusKey = in_array($row['status'], ['pending', 'approved', 'rejected'], true) ? $row['status'] : 'pending';
      $statusColor = $STATUS_COLORS[$statusKey];
      $title = $row['video_title'] !== '' ? $row['video_title'] : '(başlık yok)';
      $userID = $row['user_id'] !== '' ? $row['user_id'] : '(yok)';
      $durSec = (float)$row['end_time'] - (float)$row['start_time'];
      $yt = 'https://www.youtube.com/watch?v=' . $row['video_id'];
      ?>
      <div class="seg st-<?= $statusKey ?> fade-in" data-search="<?= esc(strtolower($row['video_title'] . ' ' . $row['video_id'])) ?>">
        <img class="thumb" loading="lazy"
             src="https://i.ytimg.com/vi/<?= esc($row['video_id']) ?>/hqdefault.jpg"
             onerror="this.style.visibility='hidden'">
        <div class="seg-main">
          <div class="seg-title"><?= esc($title) ?></div>
          <div class="seg-meta">
            <span class="kbd"><?= esc($row['video_id']) ?></span>
            <?php if ((float)$row['video_duration'] > 0): ?>
              <span class="dim">· Video süresi <strong><?= fmtSec($row['video_duration']) ?></strong></span>
            <?php endif; ?>
            <span class="badge b-cat" style="--cat-color:<?= $catColor ?>"><span class="dot" style="background:<?= $catColor ?>"></span><?= esc($catLabel) ?></span>
            <span class="badge b-status b-<?= $statusKey ?>"><span class="dot" style="background:<?= $statusColor ?>"></span><?= $statusLabel ?></span>
          </div>
          <div class="seg-times">
            <div class="tbox green"><div class="lbl">Başlangıç</div><div class="val"><?= fmtSec($row['start_time']) ?></div></div>
            <span class="tarrow">→</span>
            <div class="tbox"><div class="lbl">Bitiş</div><div class="val"><?= fmtSec($row['end_time']) ?></div></div>
            <span class="tarrow">·</span>
            <div class="tbox amber"><div class="lbl">Uzunluk</div><div class="val"><?= (int) round($durSec) ?> sn</div><div class="dur">atlanan kısım</div></div>
          </div>
          <div class="meta-grid">
            <div class="meta-cell"><div class="k">Kullanıcı ID</div><div class="v mono"><?= esc($userID) ?></div></div>
            <div class="meta-cell"><div class="k">IP Adresi</div><div class="v mono"><?= esc($row['ip_address'] ?: '-') ?></div></div>
            <div class="meta-cell"><div class="k">Gönderilme</div><div class="v"><?= date('d.m.Y H:i', strtotime($row['created_at'])) ?></div></div>
            <div class="meta-cell"><div class="k">Kayıt ID</div><div class="v mono">#<?= $row['id'] ?></div></div>
          </div>
        </div>
        <div class="actions">
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="<?= $yt ?>&t=<?= (int)$row['start_time'] ?>">▶ Başlangıç</a>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="<?= $yt ?>&t=<?= (int)$row['end_time'] ?>">▶ Bitiş</a>
          <a class="link" target="_blank" rel="noopener" href="<?= $yt ?>">Videoyu aç →</a>
          <span style="flex:1"></span>
          <?php if ($row['status'] !== 'approved'): ?>
            <form method="post" style="display:inline">
              <input type="hidden" name="action" value="approve"><input type="hidden" name="id" value="<?= $row['id'] ?>">
              <button class="btn btn-ok btn-sm" type="submit">✓ Onayla</button>
            </form>
          <?php endif; ?>
          <?php if ($row['status'] !== 'rejected'): ?>
            <form method="post" style="display:inline">
              <input type="hidden" name="action" value="reject"><input type="hidden" name="id" value="<?= $row['id'] ?>">
              <button class="btn btn-no btn-sm" type="submit">✕ Reddet</button>
            </form>
          <?php endif; ?>
          <form method="post" style="display:inline" onsubmit="return confirm('Bu kaydı kalıcı olarak silmek istediğine emin misin?')">
            <input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $row['id'] ?>">
            <button class="btn btn-ghost btn-sm" type="submit">🗑 Sil</button>
          </form>
        </div>
      </div>
    <?php endwhile; endif; ?>
    </div>
  </div>

  <script>
    // Canlı arama: başlık veya video ID'ye göre kartları filtrele
    const input = document.getElementById('segSearch');
    if (input) {
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        document.querySelectorAll('#segList .seg').forEach(el => {
          el.classList.toggle('hidden', q !== '' && !(el.dataset.search || '').includes(q));
        });
      });
    }
  </script>
<?php endif; ?>
</body>
</html>
