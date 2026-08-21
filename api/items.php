<?php
/* api/items.php — medicines & activities for a profile. Every path authorizes
   the profile via require_profile(). */
require_once __DIR__ . '/../db.php';
$me = require_user();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'GET' ? 'list' : '');

function item_row(int $id): ?array {
    $s = pdo()->prepare('SELECT * FROM items WHERE id=?'); $s->execute([$id]);
    return $s->fetch() ?: null;
}
function shape(array $r): array {
    return [
        'id' => (int)$r['id'], 'profile_id' => (int)$r['profile_id'], 'type' => $r['type'],
        'name' => $r['name'], 'count' => (int)$r['count'], 'grp' => $r['grp'], 'time_min' => (int)$r['time_min'],
        'purpose' => $r['purpose'], 'note' => $r['note'], 'photo_url' => $r['photo_url'],
        'freq' => $r['freq'], 'days' => $r['days'] ? json_decode($r['days'], true) : [],
        'dom' => $r['dom'] !== null ? (int)$r['dom'] : null,
        'end_mode' => $r['end_mode'], 'end_date' => $r['end_date'], 'end_count' => $r['end_count'] !== null ? (int)$r['end_count'] : null,
        'start_date' => $r['start_date'],
    ];
}
function clean(array $b): array {
    $type = in_array($b['type'] ?? '', ['pill', 'activity'], true) ? $b['type'] : 'pill';
    $grp  = in_array($b['grp'] ?? '', ['morning', 'noon', 'evening', 'bedtime'], true) ? $b['grp'] : 'morning';
    $freq = in_array($b['freq'] ?? '', ['daily', 'weekly', 'monthly'], true) ? $b['freq'] : 'daily';
    $em   = in_array($b['end_mode'] ?? '', ['never', 'date', 'count'], true) ? $b['end_mode'] : 'never';
    $days = array_values(array_filter(array_map('intval', is_array($b['days'] ?? null) ? $b['days'] : []), fn($d) => $d >= 0 && $d <= 6));
    return [
        'type' => $type, 'name' => mb_substr(trim($b['name'] ?? ''), 0, 200),
        'count' => max(1, (int)($b['count'] ?? 1)), 'grp' => $grp,
        'time_min' => max(0, min(1439, (int)($b['time_min'] ?? 480))),
        'purpose' => mb_substr(trim($b['purpose'] ?? ''), 0, 200) ?: null,
        'note' => mb_substr(trim($b['note'] ?? ''), 0, 300) ?: null,
        'photo_url' => ($b['photo_url'] ?? null) ? mb_substr($b['photo_url'], 0, 512) : null,
        'freq' => $freq, 'days' => $freq === 'weekly' ? json_encode($days) : null,
        'dom' => $freq === 'monthly' ? max(1, min(31, (int)($b['dom'] ?? 1))) : null,
        'end_mode' => $em, 'end_date' => $em === 'date' ? ($b['end_date'] ?: null) : null,
        'end_count' => $em === 'count' ? max(1, (int)($b['end_count'] ?? 1)) : null,
    ];
}

if ($method === 'GET' && $action === 'list') {
    $pid = (int)($_GET['profile'] ?? 0);
    require_profile($pid);
    $s = pdo()->prepare('SELECT * FROM items WHERE profile_id=? AND active=1 ORDER BY time_min, id'); $s->execute([$pid]);
    json_out(['items' => array_map('shape', $s->fetchAll())]);
}

if ($method !== 'POST') fail('method', 405);
require_csrf();
$b = body_json();

if ($action === 'create') {
    $pid = (int)($b['profile_id'] ?? 0);
    require_profile($pid, 'editor');
    $c = clean($b);
    if ($c['name'] === '') fail('name_required', 400);
    pdo()->prepare('INSERT INTO items (profile_id,type,name,count,grp,time_min,purpose,note,photo_url,freq,days,dom,end_mode,end_date,end_count,start_date,created_by)
                    VALUES (:pid,:type,:name,:count,:grp,:time_min,:purpose,:note,:photo,:freq,:days,:dom,:em,:ed,:ec,CURDATE(),:uid)')
        ->execute([':pid' => $pid, ':type' => $c['type'], ':name' => $c['name'], ':count' => $c['count'], ':grp' => $c['grp'],
                   ':time_min' => $c['time_min'], ':purpose' => $c['purpose'], ':note' => $c['note'], ':photo' => $c['photo_url'],
                   ':freq' => $c['freq'], ':days' => $c['days'], ':dom' => $c['dom'], ':em' => $c['end_mode'],
                   ':ed' => $c['end_date'], ':ec' => $c['end_count'], ':uid' => (int)$me['id']]);
    json_out(['id' => (int)pdo()->lastInsertId()], 201);
}

if ($action === 'update') {
    $id = (int)($b['id'] ?? 0);
    $it = item_row($id); if (!$it) fail('not_found', 404);
    require_profile((int)$it['profile_id'], 'editor');
    $c = clean($b);
    if ($c['name'] === '') fail('name_required', 400);
    pdo()->prepare('UPDATE items SET type=:type,name=:name,count=:count,grp=:grp,time_min=:time_min,purpose=:purpose,note=:note,photo_url=:photo,freq=:freq,days=:days,dom=:dom,end_mode=:em,end_date=:ed,end_count=:ec WHERE id=:id')
        ->execute([':type' => $c['type'], ':name' => $c['name'], ':count' => $c['count'], ':grp' => $c['grp'], ':time_min' => $c['time_min'],
                   ':purpose' => $c['purpose'], ':note' => $c['note'], ':photo' => $c['photo_url'], ':freq' => $c['freq'], ':days' => $c['days'],
                   ':dom' => $c['dom'], ':em' => $c['end_mode'], ':ed' => $c['end_date'], ':ec' => $c['end_count'], ':id' => $id]);
    json_out(['ok' => true]);
}

if ($action === 'delete') {
    $id = (int)($b['id'] ?? 0);
    $it = item_row($id); if (!$it) fail('not_found', 404);
    require_profile((int)$it['profile_id'], 'editor');
    pdo()->prepare('UPDATE items SET active=0 WHERE id=?')->execute([$id]);   // soft-delete keeps history
    json_out(['ok' => true]);
}

fail('bad_action', 400);
