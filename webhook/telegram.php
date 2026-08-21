<?php
/* webhook/telegram.php — receives Telegram updates: /start <token> links a chat to a
   profile; inline-button taps log took/didn't/snooze straight from the chat. */
require_once __DIR__ . '/../tg.php';
$pdo = pdo();
$update = json_decode(file_get_contents('php://input'), true);
http_response_code(200);
if (!is_array($update)) exit;

/* ---- link flow: /start <token> ---- */
if (isset($update['message']['text'])) {
    $text = trim($update['message']['text']);
    $chat = $update['message']['chat']['id'] ?? 0;
    $from = $update['message']['from'] ?? [];
    if (strpos($text, '/start') === 0) {
        $tok = trim(substr($text, 6));
        if ($tok === '') { tg_send($chat, "👋 <b>Alongside</b>\nDeschide aplicația → Setări/Gestionare → Notificări și apasă „Leagă Telegram”."); exit; }
        $st = $pdo->prepare('SELECT c.id, p.name pname FROM channels c JOIN profiles p ON p.id=c.profile_id WHERE c.link_token=? AND c.kind="telegram" LIMIT 1');
        $st->execute([$tok]); $ch = $st->fetch();
        if (!$ch) { tg_send($chat, "Linkul a expirat. Deschide din nou „Leagă Telegram” în aplicație."); exit; }
        $pdo->prepare('UPDATE channels SET address=?, verified=1, link_token=NULL, label=? WHERE id=?')
            ->execute([(string)$chat, ($from['first_name'] ?? 'Telegram'), $ch['id']]);
        tg_send($chat, "✅ Gata! Vei primi memento pentru <b>" . htmlspecialchars($ch['pname']) . "</b> aici.");
    }
    exit;
}

/* ---- two-way: inline button taps ---- */
if (isset($update['callback_query'])) {
    $cq = $update['callback_query'];
    $cid = $cq['id']; $data = $cq['data'] ?? '';
    $chat = $cq['message']['chat']['id'] ?? 0; $msgId = $cq['message']['message_id'] ?? 0;
    $parts = explode('|', $data);   // L|profile|item|date|action
    if (count($parts) !== 5 || $parts[0] !== 'L') { tg_answer($cid); exit; }
    [, $pid, $iid, $date, $act] = $parts; $pid = (int)$pid; $iid = (int)$iid;
    // authorize: this chat must be a verified telegram channel of the profile
    $chk = $pdo->prepare('SELECT 1 FROM channels WHERE profile_id=? AND kind="telegram" AND verified=1 AND address=? LIMIT 1');
    $chk->execute([$pid, (string)$chat]);
    if (!$chk->fetch()) { tg_answer($cid, 'Neautorizat'); exit; }
    $it = $pdo->prepare('SELECT name,type FROM items WHERE id=? AND profile_id=?'); $it->execute([$iid, $pid]); $item = $it->fetch();
    if (!$item) { tg_answer($cid, '—'); exit; }
    $isAct = $item['type'] === 'activity';
    if ($act === 't' || $act === 's') {
        $status = $act === 't' ? 'taken' : 'skipped';
        $tz = (string)($pdo->query('SELECT timezone FROM profiles WHERE id=' . $pid)->fetchColumn() ?: 'Europe/Bucharest');
        $tmin = $act === 't' ? tznow_min($tz) : null;
        $pdo->prepare('INSERT INTO logs (profile_id,item_id,d,status,taken_min,at_epoch,actor_user_id,note) VALUES (?,?,?,?,?,?,NULL,NULL)
                       ON DUPLICATE KEY UPDATE status=VALUES(status),taken_min=VALUES(taken_min),at_epoch=VALUES(at_epoch),actor_user_id=NULL')
            ->execute([$pid, $iid, $date, $status, $tmin, (int)(microtime(true) * 1000)]);
        $pdo->prepare('UPDATE notif_log SET response=? WHERE profile_id=? AND item_id=? AND d=? AND kind IN ("due","overdue")')->execute([$status, $pid, $iid, $date]);
        $lab = $act === 't' ? ($isAct ? '✅ Făcut' : '✅ Luat') : ('❌ ' . ($isAct ? 'Nefăcut' : 'Neluat'));
        tg_answer($cid, $lab);
        tg_edit($chat, $msgId, htmlspecialchars($item['name']) . ' — <b>' . $lab . '</b>');
    } elseif ($act === 'z') {
        $pdo->prepare('UPDATE notif_log SET response="snooze", sent_at=NOW() WHERE profile_id=? AND item_id=? AND d=? AND kind="due"')->execute([$pid, $iid, $date]);
        tg_answer($cid, '⏰ Amânat 15 min');
    }
    exit;
}
