<?php
// vAdBlock SponsorSkip API
// GET  /api/skipsegments.php?videoID=xxx&categories=["sponsor"]  → segment listesi
// POST /api/skipsegments.php (JSON body)                          → segment ekle
require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ─── GET: segmentleri çek ───
if ($method === 'GET') {
    $videoID = isset($_GET['videoID']) ? trim($_GET['videoID']) : '';
    if ($videoID === '') respond(['error' => 'videoID required'], 400);

    // categories=["sponsor","intro"] formatı; yoksa hepsi
    $categories = [];
    if (isset($_GET['categories'])) {
        $raw = json_decode($_GET['categories'], true);
        if (is_array($raw)) $categories = $raw;
    }

    $sql = 'SELECT startTime, endTime, category, votes, hidden FROM segments WHERE videoID = ? AND hidden = 0';
    $params = [$videoID];
    if (count($categories) > 0) {
        $placeholders = implode(',', array_fill(0, count($categories), '?'));
        $sql .= ' AND category IN (' . $placeholders . ')';
        $params = array_merge($params, $categories);
    }
    $sql .= ' ORDER BY startTime ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $out = [];
    foreach ($rows as $row) {
        $out[] = [
            'videoID' => $videoID,
            'startTime' => (float)$row['startTime'],
            'endTime' => (float)$row['endTime'],
            'category' => $row['category'],
            'votes' => (int)$row['votes'],
            'actionType' => 'skip',
        ];
    }
    respond($out);
}

// ─── POST: segment ekle ───
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) respond(['error' => 'invalid JSON'], 400);

    // Tek segment olabilir veya segment dizisi
    $items = isset($body['segments']) ? $body['segments'] : [$body];

    // Yeni veya var olan userID — cihaz başına aynı kimlik
    $userID = isset($body['userID']) ? trim($body['userID']) : '';
    if ($userID === '') {
        $userID = isset($body['userID']) ? trim($body['userID']) : 'anon';
    }

    $timeSubmitted = time();
    $inserted = 0;
    $stmt = $pdo->prepare(
        'INSERT INTO segments (videoID, startTime, endTime, category, userID, votes, hidden, timeSubmitted)
         VALUES (?, ?, ?, ?, ?, 1, 0, ?)'
    );

    foreach ($items as $seg) {
        $videoID = isset($seg['videoID']) ? trim($seg['videoID']) : '';
        $start = isset($seg['startTime']) ? (float)$seg['startTime'] : null;
        $end = isset($seg['endTime']) ? (float)$seg['endTime'] : null;
        $category = isset($seg['category']) ? trim($seg['category']) : 'sponsor';

        if ($videoID === '' || $start === null || $end === null || $end <= $start) continue;

        // Aynı kullanıcıdan üst üste eklemeyi önle (aynı video + ±2sn içinde aynı aralık)
        $dup = $pdo->prepare(
            'SELECT id FROM segments WHERE videoID = ? AND userID = ?
             AND ABS(startTime - ?) < 2 AND ABS(endTime - ?) < 2 LIMIT 1'
        );
        $dup->execute([$videoID, $userID, $start, $end]);
        if ($dup->fetchColumn()) continue;

        $stmt->execute([$videoID, $start, $end, $category, $userID, $timeSubmitted]);
        $inserted++;
    }

    if ($inserted > 0) {
        respond(['success' => true, 'inserted' => $inserted, 'timeSubmitted' => $timeSubmitted]);
    }
    respond(['success' => false, 'inserted' => 0, 'message' => 'no new segments'], 200);
}

respond(['error' => 'method not allowed'], 405);
