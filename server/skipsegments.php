<?php
/* vAdBlock SponsorSkip API — skipsegments.php
   cPanel: public_html/api/skipsegments.php olarak yükle.
   Ayarlar -> Daha Fazla -> Sponsor API URL: https://siten.com/api
*/

// ─── MySQL bilgileri (cPanel -> MySQL Databases'ten al) ───
$DB_HOST = 'localhost';
$DB_NAME = 'SENIN_DB_ADIN';
$DB_USER = 'SENIN_DB_KULLANICIN';
$DB_PASS = 'SENIN_DB_SIFREN';

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_video (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$allowedCategories = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $videoID = isset($_GET['videoID']) ? preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['videoID']) : '';
    if ($videoID === '') {
        http_response_code(400);
        echo json_encode([]);
        exit;
    }
    $stmt = $mysqli->prepare("SELECT start_time, end_time, category FROM sponsor_segments WHERE video_id = ? ORDER BY start_time ASC");
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
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'invalid_json']);
        exit;
    }

    $videoID   = isset($body['videoID'])   ? preg_replace('/[^A-Za-z0-9_-]/', '', $body['videoID']) : '';
    $startTime = isset($body['startTime']) ? (float) $body['startTime'] : -1;
    $endTime   = isset($body['endTime'])   ? (float) $body['endTime']   : -1;
    $category  = isset($body['category'])  ? $body['category']          : '';
    $userID    = isset($body['userID'])    ? preg_replace('/[^A-Za-z0-9_-]/', '', $body['userID']) : '';

    if ($videoID === '' || $startTime < 0 || $endTime <= $startTime || !in_array($category, $allowedCategories, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'invalid_payload']);
        exit;
    }

    $stmt = $mysqli->prepare("INSERT INTO sponsor_segments (video_id, start_time, end_time, category, user_id) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param('sddss', $videoID, $startTime, $endTime, $category, $userID);
    $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'method']);
