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
    'selfpromo' => '#ffff00',
    'interaction' => '#cc00ff',
    'intro' => '#00ffff',
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
$STATUS_COLORS = ['pending' => '#f59e0b', 'approved' => '#00d400', 'rejected' => '#ef4444'];

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
<title>Segment Yönetimi · vAdBlock</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    background: radial-gradient(1200px 600px at 20% -10%, #16213e 0%, #0d1117 55%, #0b0f14 100%);
    min-height: 100vh;
    color: #e6edf3;
    padding: 32px 20px;
  }
  .wrap { max-width: 1000px; margin: 0 auto; }
  .head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 22px; }
  .head h1 { font-size: 22px; font-weight: 700; }
  .head .sub { font-size: 13px; color: #9fb0c3; }
  .logout { color: #9fb0c3; text-decoration: none; font-size: 13px; border: 1px solid rgba(255,255,255,0.15); padding: 7px 14px; border-radius: 9px; }
  .logout:hover { color: #fff; background: rgba(255,255,255,0.06); }
  .card {
    background: rgba(22,27,34,0.85);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 22px;
    margin-bottom: 16px;
  }
  .card.login { max-width: 380px; margin: 80px auto; }
  .card.login h2 { margin-bottom: 14px; }
  .card.login input[type=password] {
    width: 100%; padding: 12px 14px; border-radius: 10px;
    background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.15);
    color: #fff; font-size: 14px; outline: none; margin-bottom: 12px;
  }
  .btn {
    display: inline-flex; align-items: center; gap: 6px; justify-content: center;
    border: none; border-radius: 9px; cursor: pointer;
    font-family: inherit; font-size: 13px; font-weight: 600;
    padding: 9px 14px; transition: transform 0.1s ease, filter 0.15s ease;
  }
  .btn:hover { filter: brightness(1.1); }
  .btn:active { transform: scale(0.97); }
  .btn-primary { background: #e6edf3; color: #0b0f14; }
  .btn-ok { background: rgba(0,212,0,0.16); color: #00d400; border: 1px solid rgba(0,212,0,0.3); }
  .btn-no { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .btn-ghost { background: rgba(255,255,255,0.05); color: #c9d4e1; border: 1px solid rgba(255,255,255,0.14); }
  .btn-sm { padding: 6px 10px; font-size: 12px; }
  .tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab {
    padding: 8px 16px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
    background: rgba(255,255,255,0.05); color: #9fb0c3; border: 1px solid rgba(255,255,255,0.1);
    text-decoration: none;
  }
  .tab.active { background: rgba(255,255,255,0.12); color: #fff; }
  .tab .cnt { display: inline-block; background: rgba(255,255,255,0.12); border-radius: 999px; padding: 1px 8px; margin-left: 6px; font-size: 12px; }
  .seg {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 16px; margin-bottom: 12px;
    display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;
  }
  .thumb { width: 120px; height: 68px; border-radius: 8px; object-fit: cover; background: rgba(255,255,255,0.06); flex-shrink: 0; }
  .seg-main { flex: 1; min-width: 260px; }
  .seg-title { font-size: 14.5px; font-weight: 600; margin-bottom: 4px; }
  .seg-meta { font-size: 12.5px; color: #9fb0c3; line-height: 1.6; }
  .seg-meta .kbd { font-family: 'Consolas','Menlo',monospace; background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 5px; font-size: 12px; }
  .seg-times { display: flex; align-items: center; gap: 10px; margin: 8px 0; flex-wrap: wrap; }
  .tbox {
    display: inline-block; text-align: center;
    background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 9px; padding: 8px 12px;
  }
  .tbox .lbl { font-size: 10px; color: #7d8b9f; text-transform: uppercase; letter-spacing: 0.5px; }
  .tbox .val { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tbox.green .val { color: #00d400; }
  .tarrow { color: #7d8b9f; font-size: 16px; }
  .badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
  .badge .dot { width: 7px; height: 7px; border-radius: 50%; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .link { color: #7cc4ff; text-decoration: none; font-size: 13px; }
  .link:hover { text-decoration: underline; }
  .empty { text-align: center; color: #7d8b9f; padding: 40px 0; font-size: 14px; }
  .flash { text-align: center; font-size: 14px; font-weight: 600; margin-bottom: 14px; }
  .flash.green { color: #00d400; }
  .flash.red { color: #f87171; }
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 10px; }
  .meta-cell { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; }
  .meta-cell .k { font-size: 10px; color: #7d8b9f; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-cell .v { font-size: 12.5px; font-weight: 600; margin-top: 2px; word-break: break-all; }
</style>
</head>
<body>
<div class="wrap">
<?php if (!$loggedIn): ?>
  <div class="card login">
    <h2>Yönetici Girişi</h2>
    <form method="post">
      <input type="password" name="pass" placeholder="Yönetim şifresi" autofocus required>
      <button class="btn btn-primary" style="width:100%;" type="submit">Giriş Yap</button>
    </form>
  </div>
<?php else: ?>
  <?php
  $mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
  if ($mysqli->connect_errno) {
      echo '<div class="card"><h2>Veritabanı bağlantı hatası</h2><p>MySQL bilgilerini kontrol et.</p></div>';
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
  <div class="head">
    <div>
      <h1>Segment Yönetimi</h1>
      <div class="sub">vAdBlock Sponsor Skip · kayıtlı segmentleri incele, onayla veya reddet</div>
    </div>
    <a class="logout" href="?logout=1">Çıkış yap</a>
  </div>

  <div class="tabs">
    <a class="tab <?= $filter === 'pending' ? 'active' : '' ?>" href="?f=pending">Bekliyor<span class="cnt"><?= $counts['pending'] ?></span></a>
    <a class="tab <?= $filter === 'approved' ? 'active' : '' ?>" href="?f=approved">Onaylı<span class="cnt"><?= $counts['approved'] ?></span></a>
    <a class="tab <?= $filter === 'rejected' ? 'active' : '' ?>" href="?f=rejected">Reddedilen<span class="cnt"><?= $counts['rejected'] ?></span></a>
    <a class="tab <?= $filter === 'all' ? 'active' : '' ?>" href="?f=all">Tümü<span class="cnt"><?= $counts['all'] ?></span></a>
  </div>

  <?php if ($res && $res->num_rows === 0): ?>
    <div class="empty">Bu sekmede kayıt yok.</div>
  <?php else: while ($row = $res->fetch_assoc()): ?>
    <?php
    $catColor = $CAT_COLORS[$row['category']] ?? '#00d400';
    $catLabel = $CAT_LABELS[$row['category']] ?? $row['category'];
    $statusLabel = $STATUS_LABELS[$row['status']] ?? $row['status'];
    $statusColor = $STATUS_COLORS[$row['status']] ?? '#888';
    $title = $row['video_title'] !== '' ? $row['video_title'] : '(başlık yok)';
    $userID = $row['user_id'] !== '' ? $row['user_id'] : '(yok)';
    ?>
    <div class="seg">
      <img class="thumb" loading="lazy"
           src="https://i.ytimg.com/vi/<?= esc($row['video_id']) ?>/hqdefault.jpg"
           onerror="this.style.visibility='hidden'">
      <div class="seg-main">
        <div class="seg-title"><?= esc($title) ?></div>
        <div class="seg-meta">
          Video ID: <span class="kbd"><?= esc($row['video_id']) ?></span>
          <?php if ((float)$row['video_duration'] > 0): ?> · Süre: <strong><?= fmtSec($row['video_duration']) ?></strong><?php endif; ?>
          <span class="badge" style="color:<?= $statusColor ?>;border:1px solid <?= $statusColor ?>66;background:<?= $statusColor ?>1a;margin-left:6px;"><span class="dot" style="background:<?= $statusColor ?>"></span><?= $statusLabel ?></span>
          <span class="badge" style="color:<?= $catColor ?>;border:1px solid <?= $catColor ?>66;background:<?= $catColor ?>1a;margin-left:4px;"><span class="dot" style="background:<?= $catColor ?>"></span><?= $catLabel ?></span>
        </div>
        <div class="seg-times">
          <div class="tbox green"><div class="lbl">Başlangıç</div><div class="val"><?= fmtSec($row['start_time']) ?></div></div>
          <span class="tarrow">→</span>
          <div class="tbox"><div class="lbl">Bitiş</div><div class="val"><?= fmtSec($row['end_time']) ?></div></div>
          <span class="tarrow">·</span>
          <div class="tbox"><div class="lbl">Uzunluk</div><div class="val" style="font-size:14px;"><?= (int) round((float)$row['end_time'] - (float)$row['start_time']) ?> sn</div></div>
        </div>
        <div class="meta-grid">
          <div class="meta-cell"><div class="k">Kullanıcı ID</div><div class="v" style="font-family:'Consolas',monospace;font-size:11px;"><?= esc($userID) ?></div></div>
          <div class="meta-cell"><div class="k">IP Adresi</div><div class="v"><?= esc($row['ip_address'] ?: '-') ?></div></div>
          <div class="meta-cell"><div class="k">Gönderilme</div><div class="v"><?= date('d.m.Y H:i', strtotime($row['created_at'])) ?></div></div>
          <div class="meta-cell"><div class="k">Kayıt ID</div><div class="v" style="font-family:'Consolas',monospace;">#<?= $row['id'] ?></div></div>
        </div>
      </div>
      <div class="actions">
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=<?= esc($row['video_id']) ?>&t=<?= (int)$row['start_time'] ?>">▶ Başla</a>
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=<?= esc($row['video_id']) ?>&t=<?= (int)$row['end_time'] ?>">▶ Bitiş</a>
        <a class="link" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=<?= esc($row['video_id']) ?>">Video →</a>
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
        <form method="post" style="display:inline" onsubmit="return confirm('Bu kaydı silmek istediğine emin misin?')">
          <input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $row['id'] ?>">
          <button class="btn btn-ghost btn-sm" type="submit">🗑 Sil</button>
        </form>
      </div>
    </div>
  <?php endwhile; endif; ?>
<?php endif; ?>
</div>
</body>
</html>
