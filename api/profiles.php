<?php
/* api/profiles.php — the caller's profiles + owner-gated management.
   The list is ALWAYS derived server-side from membership; the client can never
   ask for a profile it isn't a member of. */
require_once __DIR__ . '/../db.php';
$me = require_user();
$uid = (int)$me['id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'GET' ? 'list' : '');

if ($method === 'GET' && $action === 'list') {
    $rows = my_profiles($uid);
    $out = array_map(fn($p) => [
        'id' => (int)$p['id'], 'name' => $p['name'], 'relation' => $p['relation'],
        'tint' => $p['tint'], 'avatar_url' => $p['avatar_url'], 'timezone' => $p['timezone'],
        'role' => $p['role'],
    ], $rows);
    json_out(['profiles' => $out]);
}

if ($method !== 'POST') fail('method', 405);
require_csrf();
$b = body_json();

if ($action === 'create') {
    $name = trim($b['name'] ?? '');
    if ($name === '') fail('name_required', 400);
    $pdo = pdo();
    $pdo->prepare('INSERT INTO profiles (name,relation,timezone,tint,created_by) VALUES (?,?,?,?,?)')
        ->execute([$name, trim($b['relation'] ?? ''), trim($b['timezone'] ?? 'Europe/Bucharest'), $b['tint'] ?? null, $uid]);
    $pid = (int)$pdo->lastInsertId();
    $pdo->prepare('INSERT INTO profile_members (profile_id,user_id,role) VALUES (?,?,"owner")')->execute([$pid, $uid]);
    json_out(['id' => $pid], 201);
}

if ($action === 'rename') {
    $pid = (int)($b['id'] ?? 0);
    require_profile($pid, 'owner');
    pdo()->prepare('UPDATE profiles SET name=?, relation=?, timezone=? WHERE id=?')
        ->execute([trim($b['name'] ?? ''), trim($b['relation'] ?? ''), trim($b['timezone'] ?? 'Europe/Bucharest'), $pid]);
    json_out(['ok' => true]);
}

if ($action === 'share') {
    $pid = (int)($b['id'] ?? 0);
    require_profile($pid, 'owner');
    $email = strtolower(trim($b['email'] ?? ''));
    $role  = ($b['role'] ?? 'editor') === 'owner' ? 'owner' : 'editor';
    $u = pdo()->prepare('SELECT id FROM users WHERE email=?'); $u->execute([$email]); $row = $u->fetch();
    if (!$row) fail('no_such_user', 404);
    pdo()->prepare('INSERT IGNORE INTO profile_members (profile_id,user_id,role) VALUES (?,?,?)')->execute([$pid, (int)$row['id'], $role]);
    json_out(['ok' => true]);
}

if ($action === 'unshare') {
    $pid = (int)($b['id'] ?? 0);
    require_profile($pid, 'owner');
    $email = strtolower(trim($b['email'] ?? ''));
    $u = pdo()->prepare('SELECT id FROM users WHERE email=?'); $u->execute([$email]); $row = $u->fetch();
    if ($row) pdo()->prepare('DELETE FROM profile_members WHERE profile_id=? AND user_id=? AND role<>"owner"')->execute([$pid, (int)$row['id']]);
    json_out(['ok' => true]);
}

fail('bad_action', 400);
