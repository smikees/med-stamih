<?php
/* api/logs.php — daily log state + corrections. Shared source of truth: any
   member of the profile can read/write; every write records the actor. */
require_once __DIR__ . '/../db.php';
$me = require_user();
$uid = (int)$me['id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

function isodate($s): ?string { return preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$s) ? $s : null; }

/* GET day: logs (map by item_id) + the day note, for one profile+date */
if ($method === 'GET' && $action === 'day') {
    $pid = (int)($_GET['profile'] ?? 0);
    $date = isodate($_GET['date'] ?? '') ?? gmdate('Y-m-d');
    require_profile($pid);
    $s = pdo()->prepare('SELECT item_id,status,taken_min,note,actor_user_id FROM logs WHERE profile_id=? AND d=?');
    $s->execute([$pid, $date]);
    $logs = [];
    foreach ($s->fetchAll() as $r) {
        $logs[(int)$r['item_id']] = ['status' => $r['status'], 'taken_min' => $r['taken_min'] !== null ? (int)$r['taken_min'] : null, 'note' => $r['note'], 'actor' => $r['actor_user_id'] !== null ? (int)$r['actor_user_id'] : null];
    }
    $n = pdo()->prepare('SELECT note FROM day_notes WHERE profile_id=? AND d=?'); $n->execute([$pid, $date]);
    $dn = $n->fetch();
    json_out(['logs' => $logs, 'day_note' => $dn ? $dn['note'] : '']);
}

/* GET range: all logs between from..to (for History), map "iso|item_id" */
if ($method === 'GET' && $action === 'range') {
    $pid = (int)($_GET['profile'] ?? 0);
    $from = isodate($_GET['from'] ?? '') ?? gmdate('Y-m-d');
    $to   = isodate($_GET['to'] ?? '') ?? $from;
    require_profile($pid);
    $s = pdo()->prepare('SELECT d,item_id,status,taken_min,note FROM logs WHERE profile_id=? AND d BETWEEN ? AND ?');
    $s->execute([$pid, $from, $to]);
    $out = [];
    foreach ($s->fetchAll() as $r) $out[$r['d'] . '|' . (int)$r['item_id']] = ['status' => $r['status'], 'taken_min' => $r['taken_min'] !== null ? (int)$r['taken_min'] : null, 'note' => $r['note']];
    json_out(['logs' => $out]);
}

if ($method !== 'POST') fail('method', 405);
require_csrf();
$b = body_json();

/* POST set: upsert or clear one (profile,item,date) log */
if ($action === 'set') {
    $pid  = (int)($b['profile_id'] ?? 0);
    $iid  = (int)($b['item_id'] ?? 0);
    $date = isodate($b['date'] ?? '');
    if (!$date) fail('bad_date', 400);
    require_profile($pid, 'editor');
    // item must belong to this profile
    $chk = pdo()->prepare('SELECT 1 FROM items WHERE id=? AND profile_id=?'); $chk->execute([$iid, $pid]);
    if (!$chk->fetch()) fail('bad_item', 400);
    $status = $b['status'] ?? null;
    if ($status === null || $status === '') {
        pdo()->prepare('DELETE FROM logs WHERE profile_id=? AND item_id=? AND d=?')->execute([$pid, $iid, $date]);
        json_out(['ok' => true, 'cleared' => true]);
    }
    if (!in_array($status, ['taken', 'skipped'], true)) fail('bad_status', 400);
    $takenMin = isset($b['taken_min']) && $b['taken_min'] !== null ? max(0, min(1439, (int)$b['taken_min'])) : null;
    $note = isset($b['note']) ? mb_substr(trim((string)$b['note']), 0, 300) : null;
    $atMs = (int)(microtime(true) * 1000);
    pdo()->prepare('INSERT INTO logs (profile_id,item_id,d,status,taken_min,at_epoch,actor_user_id,note)
                    VALUES (:p,:i,:d,:s,:tm,:at,:a,:n)
                    ON DUPLICATE KEY UPDATE status=VALUES(status),taken_min=VALUES(taken_min),at_epoch=VALUES(at_epoch),actor_user_id=VALUES(actor_user_id),note=VALUES(note)')
        ->execute([':p' => $pid, ':i' => $iid, ':d' => $date, ':s' => $status, ':tm' => $takenMin, ':at' => $atMs, ':a' => $uid, ':n' => $note]);
    json_out(['ok' => true]);
}

/* POST daynote: upsert the per-day note */
if ($action === 'daynote') {
    $pid  = (int)($b['profile_id'] ?? 0);
    $date = isodate($b['date'] ?? '');
    if (!$date) fail('bad_date', 400);
    require_profile($pid, 'editor');
    $note = mb_substr(trim((string)($b['note'] ?? '')), 0, 2000);
    if ($note === '') pdo()->prepare('DELETE FROM day_notes WHERE profile_id=? AND d=?')->execute([$pid, $date]);
    else pdo()->prepare('INSERT INTO day_notes (profile_id,d,note,actor_user_id) VALUES (?,?,?,?)
                         ON DUPLICATE KEY UPDATE note=VALUES(note),actor_user_id=VALUES(actor_user_id)')->execute([$pid, $date, $note, $uid]);
    json_out(['ok' => true]);
}

fail('bad_action', 400);
