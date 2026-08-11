<?php
// vAdBlock SponsorSkip API — veritabanı bağlantısı
// cPanel paylaşımlı hostingde MySQL host genelde "localhost" olur.
// Bağlanamazsan hosting panelinden host adresini kontrol et.

define('DB_HOST', 'localhost');
define('DB_NAME', 'vadepro_adblock');
define('DB_USER', 'vadepro_adblockadmin');
define('DB_PASS', 'Kn.kc16072003.');

// CORS: eklenti her sayfadan (youtube.com dahil) çağırsın diye
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}
