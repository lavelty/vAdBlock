<?php
/* vAdBlock SponsorSkip API — skipsegments.php
   cPanel: public_html/api/skipsegments.php olarak yükle.
   Ayarlar -> Daha Fazla -> Sponsor API URL: https://siten.com/api
*/

// ─── Yapılandırma (DB bilgileri config.php'de, aynı klasöre yükle) ───
require __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Bağlantı ───
$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'db_connect']);
    exit;
}
$mysqli->set_charset('utf8mb4');

// Tabloyu yoksa otomatik oluştur (phpMyAdmin'e gerek yok)
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

// Mevcut tabloya eksik sütunları ekle (eski şemadan yükseltme)
function ensureColumn($mysqli, $column, $definition) {
    $r = $mysqli->query("SHOW COLUMNS FROM sponsor_segments LIKE '" . $column . "'");
    if ($r && $r->num_rows === 0) {
        $mysqli->query("ALTER TABLE sponsor_segments ADD COLUMN " . $column . " " . $definition);
    }
}
ensureColumn($mysqli, 'video_title',    'VARCHAR(255) NOT NULL DEFAULT \'\'');
ensureColumn($mysqli, 'video_duration', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
ensureColumn($mysqli, 'ip_address',     'VARCHAR(45) NOT NULL DEFAULT \'\'');
ensureColumn($mysqli, 'status',         'VARCHAR(16) NOT NULL DEFAULT \'pending\'');
$idx = $mysqli->query("SHOW INDEX FROM sponsor_segments WHERE Key_name = 'idx_status'");
if ($idx && $idx->num_rows === 0) {
    $mysqli->query("CREATE INDEX idx_status ON sponsor_segments (status)");
}

$allowedCategories = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $videoID = isset($_GET['videoID']) ? preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['videoID']) : '';
    if ($videoID === '') {
        http_response_code(400);
        echo json_encode([]);
        exit;
    }
    $stmt = $mysqli->prepare("SELECT start_time, end_time, category FROM sponsor_segments WHERE video_id = ? AND status = 'approved' ORDER BY start_time ASC");
    $stmt->bind_param('s', $videoID);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($row = $res->fetch_assoc()) {
        $out[] = [
            'startTime' => (float) $row['start_time'],
            'endTime'   => (float) $row['end_time'],
            'category'  => $row['category']
        ];
    }
    $stmt->close();
    echo json_encode($out); // sayılar number olmalı (float cast), dizi boş olabilir
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        $body = $_POST;
    }
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'invalid_json']);
        exit;
    }

    $videoID   = isset($body['videoID'])   ? preg_replace('/[^A-Za-z0-9_-]/', '', $body['videoID']) : '';
    $startTime = isset($body['startTime']) ? (float) $body['startTime'] : -1;
    $endTime   = isset($body['endTime'])   ? (float) $body['endTime']   : -1;
    $category  = isset($body['category'])  ? $body['category']          : '';
    $userID    = isset($body['userID'])    ? preg_replace('/[^A-Za-z0-9_-]/', '', $body['userID']) : '';
    $videoTitle = isset($body['videoTitle'])   ? trim((string) $body['videoTitle']) : '';
    $videoDur   = isset($body['videoDuration']) ? (float) $body['videoDuration'] : 0;

    if ($videoID === '' || $startTime < 0 || $endTime <= $startTime || !in_array($category, $allowedCategories, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'invalid_payload']);
        exit;
    }

    $ip = '';
    if (isset($_SERVER['HTTP_CF_CONNECTING_IP']))      $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
    elseif (isset($_SERVER['REMOTE_ADDR']))            $ip = $_SERVER['REMOTE_ADDR'];
    $ip = substr(preg_replace('/[^0-9a-fA-F.:]/', '', $ip), 0, 45);

    $stmt = $mysqli->prepare("INSERT INTO sponsor_segments (video_id, start_time, end_time, category, user_id, video_title, video_duration, ip_address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')");
    $stmt->bind_param('sddsssds', $videoID, $startTime, $endTime, $category, $userID, $videoTitle, $videoDur, $ip);
    $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => true, 'status' => 'pending']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'method']);
