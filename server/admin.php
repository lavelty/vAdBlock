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

// ─── Aksiyonlar (AJAX / POST) ───
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['admin_ok'])) {
    $isAjax = (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest') || !empty($_POST['ajax']);
    $mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
    $result = ['ok' => false, 'error' => 'db'];
    if (!$mysqli->connect_errno) {
        $mysqli->set_charset('utf8mb4');
        ensureSchema($mysqli);
        $action = $_POST['action'] ?? '';
        $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
        $ok = false;
        if ($id > 0) {
            if ($action === 'approve') {
                $stmt = $mysqli->prepare("UPDATE sponsor_segments SET status = 'approved' WHERE id = ?");
                $stmt->bind_param('i', $id);
                $ok = $stmt->execute();
            } elseif ($action === 'reject') {
                $stmt = $mysqli->prepare("UPDATE sponsor_segments SET status = 'rejected' WHERE id = ?");
                $stmt->bind_param('i', $id);
                $ok = $stmt->execute();
            } elseif ($action === 'delete') {
                $stmt = $mysqli->prepare("DELETE FROM sponsor_segments WHERE id = ?");
                $stmt->bind_param('i', $id);
                $ok = $stmt->execute();
            }
        }
        $result = ['ok' => $ok, 'action' => $action, 'id' => $id];
    }
    if ($isAjax) {
        header('Content-Type: application/json');
        echo json_encode($result);
        exit;
    }
    // No-JS yedek: filtre korunarak geri dön
    $f = isset($_POST['f']) ? preg_replace('/[^a-z]/', '', $_POST['f']) : 'pending';
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?') . '?f=' . $f);
    exit;
}

// ─── Giriş kontrolü ───
$loginErr = false;
if (isset($_POST['pass'])) {
    if (hash_equals($ADMIN_PASS, (string) $_POST['pass'])) {
        $_SESSION['admin_ok'] = true;
    } else {
        $loginErr = true;
    }
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

  .blob { position: fixed; filter: blur(90px); opacity: 0.55; border-radius: 50%; z-index: 0; pointer-events: none; }
  .blob-1 { top: -15%; left: -10%; width: 55vw; height: 55vw; background: #DDD6FE; }
  .blob-2 { bottom: -25%; right: -12%; width: 60vw; height: 60vw; background: #DBEAFE; }
  .blob-3 { top: 45%; left: 42%; width: 45vw; height: 45vw; background: #FCE7F3; opacity: 0.4; }

  .wrap { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 36px 20px 60px; }

  /* Üst bar */
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 26px; }
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
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px; }
  .stat-card {
    background: var(--card-soft); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 18px 20px; display: flex; align-items: center; gap: 14px;
    box-shadow: var(--shadow-sm); transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative; overflow: hidden;
  }
  .stat-card::after { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: currentColor; opacity: 0.2; }
  .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .stat-card .ico { width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .stat-card .lbl { font-size: 12.5px; color: var(--muted); font-weight: 600; }
  .stat-card .val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; transition: transform 0.15s ease; }
  .stat-card.pop .val { transform: scale(1.25); }
  .stat-card.pending { color: var(--amber); } .stat-card.pending .ico { background: rgba(245,158,11,0.12); }
  .stat-card.approved { color: var(--green); } .stat-card.approved .ico { background: rgba(16,185,129,0.12); }
  .stat-card.rejected { color: var(--red); } .stat-card.rejected .ico { background: rgba(239,68,68,0.12); }
  .stat-card.total { color: var(--accent); } .stat-card.total .ico { background: var(--accent-soft); }
  .stat-card .lbl { color: var(--muted); }

  /* Sekmeler */
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; background: rgba(15,23,42,0.045); padding: 5px; border-radius: 100px; width: fit-content; }
  .tab {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 18px; border-radius: 100px; text-decoration: none;
    font-size: 13.5px; font-weight: 600; color: var(--muted); transition: all 0.2s ease;
  }
  .tab:hover { color: var(--text); }
  .tab.active { background: var(--card); color: var(--accent); box-shadow: 0 2px 8px rgba(15,23,42,0.1); }
  .tab .cnt { background: rgba(15,23,42,0.06); border-radius: 999px; padding: 1px 8px; font-size: 11.5px; font-weight: 700; }
  .tab.active .cnt { background: var(--accent-soft); color: var(--accent); }

  .search-box {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 220px; max-width: 340px;
    background: var(--card-soft); border: 1px solid var(--border); border-radius: 100px;
    padding: 9px 16px; color: var(--muted-2); transition: all 0.2s ease;
  }
  .search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .search-box input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 13.5px; color: var(--text); }
  .search-box input::placeholder { color: var(--muted-2); }

  /* Segment kartları */
  .seg {
    background: var(--card-soft); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 20px; margin-bottom: 14px; box-shadow: var(--shadow-sm);
    display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;
    transition: all 0.2s ease; position: relative; overflow: hidden;
  }
  .seg:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
  .seg::before { content: ""; position: absolute; left: 0; top: 20px; bottom: 20px; width: 5px; border-radius: 0 5px 5px 0; background: var(--status-color, var(--muted-2)); }
  .seg.st-pending { --status-color: var(--amber); }
  .seg.st-approved { --status-color: var(--green); }
  .seg.st-rejected { --status-color: var(--red); }
  .seg.gone { animation: slideOut 0.3s ease forwards; }
  @keyframes slideOut { to { opacity: 0; transform: translateX(30px) scale(0.98); max-height: 0; padding: 0; margin: 0; border: none; overflow: hidden; } }

  .thumb-wrap { position: relative; flex-shrink: 0; }
  .thumb { width: 170px; height: 96px; border-radius: 12px; object-fit: cover; background: rgba(15,23,42,0.05); display: block; box-shadow: 0 4px 12px rgba(15,23,42,0.14); }
  .thumb-wrap::after {
    content: ""; position: absolute; inset: 0; border-radius: 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.45), transparent 55%);
  }
  .play-btn {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
    width: 38px; height: 38px; border-radius: 50%; z-index: 2;
    background: rgba(255,255,255,0.92); color: #111; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25); transition: transform 0.15s ease;
  }
  .thumb-wrap:hover .play-btn { transform: translate(-50%,-50%) scale(1.12); }

  .seg-main { flex: 1; min-width: 280px; }
  .seg-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 5px; line-height: 1.3; }
  .seg-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .kbd { font-family: 'Consolas', 'Menlo', monospace; font-size: 11.5px; background: rgba(124,58,237,0.08); color: var(--accent); border-radius: 6px; padding: 2px 7px; }
  .seg-meta .dim { font-size: 12.5px; color: var(--muted-2); }
  .seg-meta .dim strong { color: var(--text); font-weight: 600; }

  .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; padding: 4px 11px; border-radius: 999px; }
  .badge .dot { width: 7px; height: 7px; border-radius: 50%; }
  .b-cat { color: var(--cat-color, #333); background: rgba(15,23,42,0.04); border: 1px solid rgba(15,23,42,0.06); }
  .b-status { color: var(--st-color); background: var(--st-bg); border: 1px solid var(--st-border); }
  .b-pending { --st-color: #B45309; --st-bg: rgba(245,158,11,0.1); --st-border: rgba(245,158,11,0.25); }
  .b-approved { --st-color: #047857; --st-bg: rgba(16,185,129,0.1); --st-border: rgba(16,185,129,0.25); }
  .b-rejected { --st-color: #B91C1C; --st-bg: rgba(239,68,68,0.1); --st-border: rgba(239,68,68,0.25); }

  /* Mini zaman çubuğu: segmentin videodaki konumu */
  .timeline { position: relative; height: 10px; border-radius: 100px; background: rgba(15,23,42,0.07); margin: 6px 0 14px; overflow: hidden; }
  .timeline .seg-bar { position: absolute; top: 0; bottom: 0; border-radius: 100px; background: var(--cat-color, #8B5CF6); box-shadow: 0 0 8px var(--cat-color, #8B5CF6); }
  .timeline .seg-bar.start { border-radius: 100px 0 0 100px; }
  .timeline .seg-bar.end { border-radius: 0 100px 100px 0; }
  .tl-labels { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--muted-2); margin-top: 3px; font-weight: 600; }

  .seg-times { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .tbox { display: inline-block; text-align: center; min-width: 78px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 6px rgba(15,23,42,0.04); }
  .tbox .lbl { font-size: 10px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
  .tbox .val { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tbox.green .val { color: var(--green); }
  .tbox.amber .val { color: var(--amber); }
  .tbox .dur { font-size: 11px; color: var(--muted-2); font-weight: 600; margin-top: 2px; }
  .tarrow { color: var(--muted-2); font-size: 14px; }

  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 4px; }
  .meta-cell { background: rgba(255,255,255,0.55); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; }
  .meta-cell .k { font-size: 10px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  .meta-cell .v { font-size: 12.5px; font-weight: 600; margin-top: 2px; word-break: break-all; }
  .meta-cell .v.mono { font-family: 'Consolas', monospace; font-size: 11.5px; color: var(--muted); }

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
  .btn[disabled] { opacity: 0.5; cursor: wait; pointer-events: none; }

  .link { color: var(--accent); text-decoration: none; font-size: 13px; font-weight: 600; }
  .link:hover { text-decoration: underline; }

  .empty { text-align: center; padding: 56px 24px; color: var(--muted); background: var(--card-soft); border: 2px dashed var(--border-strong); border-radius: var(--radius); font-size: 14.5px; font-weight: 500; }
  .empty .big { font-size: 40px; margin-bottom: 12px; }

  /* Toast */
  .toast-wrap { position: fixed; top: 20px; right: 20px; z-index: 999; display: flex; flex-direction: column; gap: 10px; }
  .toast {
    min-width: 280px; max-width: 360px; padding: 14px 18px;
    background: var(--card); border-radius: 16px; box-shadow: var(--shadow);
    display: flex; align-items: center; gap: 12px;
    border: 1px solid var(--border); animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .toast.leaving { animation: toastOut 0.25s ease forwards; }
  @keyframes toastIn { from { opacity: 0; transform: translateX(40px) scale(0.95); } }
  @keyframes toastOut { to { opacity: 0; transform: translateX(40px) scale(0.95); } }
  .toast .t-ico { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .toast .t-title { font-size: 13.5px; font-weight: 700; }
  .toast .t-sub { font-size: 12px; color: var(--muted); margin-top: 1px; }
  .toast.ok .t-ico { background: rgba(16,185,129,0.12); }
  .toast.err .t-ico { background: rgba(239,68,68,0.12); }
  .toast.info .t-ico { background: var(--accent-soft); }

  /* Giriş ekranı */
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .login-card {
    width: 100%; max-width: 400px; background: var(--card-soft); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border); border-radius: 28px; padding: 36px; box-shadow: var(--shadow); text-align: center;
  }
  .login-card .logo { width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 18px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; box-shadow: 0 12px 28px -8px rgba(124, 58, 237, 0.55); }
  .login-card h2 { font-size: 21px; margin-bottom: 6px; letter-spacing: -0.02em; }
  .login-card .hint { font-size: 13.5px; color: var(--muted); margin-bottom: 24px; }
  .login-card input[type=password] { width: 100%; padding: 14px 16px; border-radius: 14px; text-align: center; background: var(--card); border: 2px solid var(--border-strong); color: var(--text); font-family: inherit; font-size: 15px; outline: none; margin-bottom: 14px; transition: border-color 0.2s, box-shadow 0.2s; }
  .login-card input[type=password]:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .login-card button { width: 100%; }
  .err { color: var(--red); font-size: 13px; font-weight: 600; margin-bottom: 12px; }

  .hidden { display: none !important; }
  .fade-in { animation: fadeIn 0.35s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  @media (max-width: 640px) {
    .wrap { padding: 22px 14px 40px; }
    .thumb { width: 100%; height: 150px; }
    .thumb-wrap { width: 100%; }
    .actions { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
</style>
</head>
<body>

<?php if (!$loggedIn): ?>
<div class="login-wrap">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="login-card fade-in">
    <div class="logo">🛡️</div>
    <h2>Yönetici Girişi</h2>
    <div class="hint">vAdBlock Sponsor Skip yönetim paneline hoş geldin</div>
    <?php if ($loginErr): ?><div class="err">Yanlış şifre, tekrar dene.</div><?php endif; ?>
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
      echo '<div class="wrap"><div class="empty">Veritabanı bağlantı hatası: MySQL bilgilerini kontrol et.</div></div>';
      exit;
  }
  $mysqli->set_charset('utf8mb4');
  ensureSchema($mysqli);

  $filter = $_GET['f'] ?? 'all';
  if (!in_array($filter, ['all', 'approved', 'pending', 'rejected'], true)) $filter = 'all';

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
  $total = $res ? $res->num_rows : 0;
  ?>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="wrap">
    <div class="topbar">
      <div class="brand">
        <div class="logo">🛡️</div>
        <div>
          <h1>Segment Yönetimi</h1>
          <div class="sub">vAdBlock Sponsor Skip · gönderimleri incele, onayla veya reddet</div>
        </div>
      </div>
      <a class="logout-btn" href="?logout=1">Çıkış yap</a>
    </div>

    <div class="stats">
      <div class="stat-card total" data-stat="all"><div class="ico">📊</div><div><div class="lbl">Toplam Gönderim</div><div class="val" data-count="all"><?= $counts['all'] ?></div></div></div>
      <div class="stat-card approved" data-stat="approved"><div class="ico">✅</div><div><div class="lbl">Onaylı</div><div class="val" data-count="approved"><?= $counts['approved'] ?></div></div></div>
      <div class="stat-card pending" data-stat="pending"><div class="ico">⏳</div><div><div class="lbl">Bekliyor</div><div class="val" data-count="pending"><?= $counts['pending'] ?></div></div></div>
      <div class="stat-card rejected" data-stat="rejected"><div class="ico">🚫</div><div><div class="lbl">Reddedilen</div><div class="val" data-count="rejected"><?= $counts['rejected'] ?></div></div></div>
    </div>

    <div class="toolbar">
      <div class="tabs">
        <a class="tab <?= $filter === 'all' ? 'active' : '' ?>" href="?f=all">Tümü<span class="cnt"><?= $counts['all'] ?></span></a>
        <a class="tab <?= $filter === 'approved' ? 'active' : '' ?>" href="?f=approved">Onaylı<span class="cnt"><?= $counts['approved'] ?></span></a>
        <a class="tab <?= $filter === 'pending' ? 'active' : '' ?>" href="?f=pending">Bekliyor<span class="cnt"><?= $counts['pending'] ?></span></a>
        <a class="tab <?= $filter === 'rejected' ? 'active' : '' ?>" href="?f=rejected">Reddedilen<span class="cnt"><?= $counts['rejected'] ?></span></a>
      </div>
      <div class="search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="segSearch" placeholder="Video başlığı veya ID ara...">
      </div>
    </div>

    <div id="segList">
    <?php if ($total === 0): ?>
      <div class="empty" id="emptyState">
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
      $vDur = (float)$row['video_duration'];
      $barL = $vDur > 0 ? max(0, min(100, ($row['start_time'] / $vDur) * 100)) : 0;
      $barW = $vDur > 0 ? max(0.5, min(100 - $barL, ($durSec / $vDur) * 100)) : 100;
      ?>
      <div class="seg st-<?= $statusKey ?> fade-in" id="seg-<?= $row['id'] ?>" data-id="<?= $row['id'] ?>" data-status="<?= $statusKey ?>" data-search="<?= esc(strtolower($row['video_title'] . ' ' . $row['video_id'])) ?>">
        <a class="thumb-wrap" href="<?= $yt ?>" target="_blank" rel="noopener">
          <img class="thumb" loading="lazy" src="https://i.ytimg.com/vi/<?= esc($row['video_id']) ?>/hqdefault.jpg" onerror="this.style.visibility='hidden'">
          <span class="play-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </a>
        <div class="seg-main">
          <div class="seg-title"><?= esc($title) ?></div>
          <div class="seg-meta">
            <span class="kbd"><?= esc($row['video_id']) ?></span>
            <?php if ($vDur > 0): ?><span class="dim">· Video süresi <strong><?= fmtSec($vDur) ?></strong></span><?php endif; ?>
            <span class="badge b-cat" style="--cat-color:<?= $catColor ?>"><span class="dot" style="background:<?= $catColor ?>"></span><?= esc($catLabel) ?></span>
            <span class="badge b-status b-<?= $statusKey ?>"><span class="dot" style="background:<?= $statusColor ?>"></span><?= $statusLabel ?></span>
          </div>

          <?php if ($vDur > 0): ?>
          <div class="timeline">
            <div class="seg-bar <?= $barL === 0 ? 'start' : '' ?> <?= ($barL + $barW) >= 99.5 ? 'end' : '' ?>" style="left:<?= $barL ?>%;width:<?= $barW ?>%;--cat-color:<?= $catColor ?>"></div>
          </div>
          <div class="tl-labels"><span>0:00</span><span><?= fmtSec($vDur) ?></span></div>
          <?php endif; ?>

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
          <span style="flex:1"></span>
          <?php if ($row['status'] !== 'approved'): ?>
            <button class="btn btn-ok btn-sm act" data-id="<?= $row['id'] ?>" data-action="approve" type="button">✓ Onayla</button>
          <?php endif; ?>
          <?php if ($row['status'] !== 'rejected'): ?>
            <button class="btn btn-no btn-sm act" data-id="<?= $row['id'] ?>" data-action="reject" type="button">✕ Reddet</button>
          <?php endif; ?>
          <button class="btn btn-ghost btn-sm act" data-id="<?= $row['id'] ?>" data-action="delete" data-confirm="1" type="button">🗑 Sil</button>
        </div>
      </div>
    <?php endwhile; endif; ?>
    </div>
  </div>

  <div class="toast-wrap" id="toastWrap"></div>

  <script>
    const ACT_ICONS = {
      approve: { ico: '✅', title: 'Onaylandı', sub: 'Segment artık herkese görünüyor', cls: 'ok' },
      reject:  { ico: '✕',  title: 'Reddedildi', sub: 'Segment yayınlanmayacak', cls: 'err' },
      delete:  { ico: '🗑',  title: 'Silindi', sub: 'Segment veritabanından kaldırıldı', cls: 'info' }
    };

    const curFilter = <?= json_encode($filter) ?>;

    function toast(type, title, sub) {
      const wrap = document.getElementById('toastWrap');
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.innerHTML = '<div class="t-ico">' + (ACT_ICONS[type] ? ACT_ICONS[type].ico : 'ℹ️') + '</div><div><div class="t-title">' + title + '</div><div class="t-sub">' + sub + '</div></div>';
      wrap.appendChild(el);
      setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, 2600);
    }

    function popStat(stat) {
      const val = document.querySelector('.stat-card[data-stat="' + stat + '"] .val');
      if (!val) return;
      val.classList.remove('pop');
      void val.offsetWidth;
      val.classList.add('pop');
      setTimeout(() => val.classList.remove('pop'), 200);
    }

    // İstatistik sayaçlarını DOM'dan güncelle (AJAX sonrası server ile senkron)
    function updateCount(stat, delta) {
      const el = document.querySelector('.stat-card[data-stat="' + stat + '"] .val');
      if (!el) return;
      const n = Math.max(0, (parseInt(el.textContent, 10) || 0) + delta);
      el.textContent = n;
      popStat(stat);
      // sekme rozetini de güncelle
      const tab = document.querySelector('.tab[href="?f=' + stat + '"] .cnt');
      if (tab) tab.textContent = n;
      // toplamı da güncelle
      if (stat !== 'all') {
        const allEl = document.querySelector('.stat-card[data-stat="all"] .val');
        if (allEl) {
          const an = Math.max(0, (parseInt(allEl.textContent, 10) || 0) + delta);
          allEl.textContent = an;
          document.querySelector('.tab[href="?f=all"] .cnt').textContent = an;
        }
      }
    }

    document.querySelectorAll('.act').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (btn.dataset.confirm && !confirm('Bu segmenti kalıcı olarak silmek istediğine emin misin?')) return;

        const acts = btn.closest('.actions').querySelectorAll('.act');
        acts.forEach(a => a.disabled = true);
        btn.textContent = '⋯';

        try {
          const fd = new FormData();
          fd.append('action', action);
          fd.append('id', id);
          fd.append('ajax', '1');
          const res = await fetch(window.location.pathname, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          const data = await res.json();
          if (data.ok) {
            const info = ACT_ICONS[action];
            toast(info.cls, info.title, info.sub);

            // Durum geçişi: eski durum -> yeni durum (silme = kayıt gider)
            const card = document.getElementById('seg-' + id);
            const oldStatus = card ? card.dataset.status : null;
            const nextStatus = action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : null);

            if (action === 'delete') {
              updateCount(oldStatus, -1);
              updateCount('all', -1);
              if (card) { card.classList.add('gone'); setTimeout(() => card.remove(), 300); }
            } else {
              if (oldStatus) updateCount(oldStatus, -1);
              updateCount(nextStatus, 1);
              // Aktif sekmede yeni durum listelenmiyorsa kartı kaldır
              if (curFilter !== 'all' && curFilter !== nextStatus) {
                if (card) { card.classList.add('gone'); setTimeout(() => card.remove(), 300); }
              } else {
                // Kartın görünümünü güncelle (badge + sol şerit)
                if (card) {
                  card.dataset.status = nextStatus;
                  card.className = 'seg st-' + nextStatus;
                  const badge = card.querySelector('.b-status');
                  const colors = { approved: ['#10B981', '#047857'], rejected: ['#EF4444', '#B91C1C'], pending: ['#F59E0B', '#B45309'] };
                  const labels = { approved: 'Onaylı', rejected: 'Reddedildi', pending: 'Bekliyor' };
                  badge.innerHTML = '<span class="dot" style="background:' + colors[nextStatus][0] + '"></span>' + labels[nextStatus];
                  badge.className = 'badge b-status b-' + nextStatus;
                  const otherBtn = card.querySelector('.act[data-action="' + (action === 'approve' ? 'reject' : 'approve') + '"]');
                  const sameBtn = card.querySelector('.act[data-action="' + action + '"]');
                  if (otherBtn) otherBtn.remove();
                  if (sameBtn) sameBtn.remove();
                }
              }
            }
          } else {
            toast('err', 'Hata oluştu', 'Sunucu isteği işleyemedi');
          }
        } catch (e) {
          toast('err', 'Bağlantı hatası', 'Sunucuya ulaşılamadı');
          acts.forEach(a => a.disabled = false);
          const label = btn.textContent = (btn.dataset.action === 'approve' ? '✓ Onayla' : btn.dataset.action === 'reject' ? '✕ Reddet' : '🗑 Sil');
        }
      });
    });

    // Canlı arama
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
