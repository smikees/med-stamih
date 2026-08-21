<?php
/* api/channels.php — linked messaging channels per profile (max 3), require_profile-gated. */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../config.php';
$me = require_user();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'GET' ? 'list' : '');
$pdo = pdo();

if ($method === 'GET' && $action === 'list') {
    $pid = (int)($_GET['profile'] ?? 0);
    require_profile($pid);
    $st = $pdo->prepare('SELECT id,kind,label,verified,address FROM channels WHERE profile_id=? ORDER BY created_at');
    $st->execute([$pid]);
    $out = array_map(fn($c) => [
        'id' => (int)$c['id'], 'kind' => $c['kind'], 'label' => $c['label'],
        'verified' => (int)$c['verified'],
    ], $st->fetchAll());
    json_out(['channels' => $out, 'bot' => TELEGRAM_BOT_USER]);
}

if ($method !== 'POST') fail('method', 405);
require_csrf();
$b = body_json();

if ($action === 'link') {
    $pid = (int)($b['profile_id'] ?? 0);
    require_profile($pid, 'editor');
    // clean stale pendings (>1h) and cap verified at 3
    $pdo->prepare('DELETE FROM channels WHERE profile_id=? AND verified=0 AND created_at < (NOW() - INTERVAL 1 HOUR)')->execute([$pid]);
    $cnt = (int)$pdo->query('SELECT COUNT(*) FROM channels WHERE profile_id=' . $pid . ' AND verified=1')->fetchColumn();
    if ($cnt >= 3) fail('max_channels', 400);
    $token = bin2hex(random_bytes(16));
    $pdo->prepare('INSERT INTO channels (profile_id,kind,address,label,verified,link_token) VALUES (?,?,?,?,0,?)')
        ->execute([$pid, 'telegram', '', $b['label'] ?? null, $token]);
    json_out(['deep_link' => 'https://t.me/' . TELEGRAM_BOT_USER . '?start=' . $token, 'token' => $token]);
}

if ($action === 'unlink') {
    $pid = (int)($b['profile_id'] ?? 0);
    require_profile($pid, 'editor');
    $pdo->prepare('DELETE FROM channels WHERE id=? AND profile_id=?')->execute([(int)($b['id'] ?? 0), $pid]);
    json_out(['ok' => true]);
}

fail('bad_action', 400);
