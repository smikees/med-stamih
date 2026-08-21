<?php
/* cron/dispatch.php — every-minute reminder engine. Runs from host cron (CLI, trusted)
   or via HTTPS with ?key=CRON_KEY. Sends due + overdue + end-of-day summary to each
   profile's verified Telegram channels; idempotent via notif_log. */
require_once __DIR__ . '/../tg.php';
require_once __DIR__ . '/../sched.php';
header('Content-Type: text/plain; charset=utf-8');

$cli = php_sapi_name() === 'cli';
if (!$cli && !hash_equals(CRON_KEY, (string)($_GET['key'] ?? ''))) { http_response_code(403); exit("forbidden\n"); }
if (!TELEGRAM_BOT_TOKEN) { exit("no bot token\n"); }

$pdo = pdo();
const GRACE = 40;            // minutes after due → overdue nudge
const SUMMARY_MIN = 21 * 60; // 21:00 local → end-of-day summary

function record_notif(PDO $pdo, int $pid, int $iid, string $date, string $kind) {
    $pdo->prepare('INSERT INTO notif_log (profile_id,item_id,d,kind) VALUES (?,?,?,?)
                   ON DUPLICATE KEY UPDATE sent_at=NOW(), response=NULL')->execute([$pid, $iid, $date, $kind]);
}
function send_reminder(array $chats, array $p, array $it, string $date, string $kind) {
    $isAct = $it['type'] === 'activity';
    $emoji = $kind === 'overdue' ? '⚠️' : '⏰';
    $head = $kind === 'overdue' ? 'Întârziat: ' : '';
    $extra = (!$isAct && (int)$it['count'] > 1) ? ' (×' . (int)$it['count'] . ')' : '';
    $txt = $emoji . ' <b>' . htmlspecialchars($p['name']) . "</b>\n" . $head . htmlspecialchars($it['name']) . $extra . ' · ' . fmtmin_ro((int)$it['time_min']);
    $cb = 'L|' . $p['id'] . '|' . $it['id'] . '|' . $date . '|';
    $buttons = [
        [['text' => $isAct ? '✅ Am făcut' : '✅ Am luat', 'callback_data' => $cb . 't'],
         ['text' => $isAct ? '❌ Nu am făcut' : '❌ Nu am luat', 'callback_data' => $cb . 's']],
        [['text' => '⏰ Amână', 'callback_data' => $cb . 'z']],
    ];
    foreach ($chats as $c) tg_send($c, $txt, $buttons);
}

$profs = $pdo->query('SELECT DISTINCT p.id,p.name,p.timezone FROM profiles p
                      JOIN channels c ON c.profile_id=p.id WHERE c.kind="telegram" AND c.verified=1')->fetchAll();
$sent = 0;
foreach ($profs as $p) {
    $pid = (int)$p['id'];
    $now = new DateTime('now', new DateTimeZone($p['timezone'] ?: 'Europe/Bucharest'));
    $nowMin = (int)$now->format('G') * 60 + (int)$now->format('i');
    $dateISO = $now->format('Y-m-d');

    $chs = $pdo->prepare('SELECT address FROM channels WHERE profile_id=? AND kind="telegram" AND verified=1');
    $chs->execute([$pid]); $chats = array_column($chs->fetchAll(), 'address');
    if (!$chats) continue;

    $items = $pdo->prepare('SELECT * FROM items WHERE profile_id=? AND active=1'); $items->execute([$pid]); $items = $items->fetchAll();
    $lg = $pdo->prepare('SELECT item_id,status FROM logs WHERE profile_id=? AND d=?'); $lg->execute([$pid, $dateISO]);
    $logs = []; foreach ($lg->fetchAll() as $r) $logs[(int)$r['item_id']] = $r['status'];
    $nf = $pdo->prepare('SELECT item_id,kind,response,UNIX_TIMESTAMP(sent_at) ts FROM notif_log WHERE profile_id=? AND d=?'); $nf->execute([$pid, $dateISO]);
    $notif = []; foreach ($nf->fetchAll() as $r) $notif[$r['kind'] . '|' . (int)$r['item_id']] = ['response' => $r['response'], 'ts' => (int)$r['ts']];

    foreach ($items as $it) {
        if (!item_scheduled_on($it, $now)) continue;
        $iid = (int)$it['id']; $tm = (int)$it['time_min'];
        if (isset($logs[$iid])) continue;   // already logged → no reminder
        $due = $notif['due|' . $iid] ?? null;
        $snoozeActive = $due && $due['response'] === 'snooze' && (time() - $due['ts'] < 15 * 60);
        $snoozeExpired = $due && $due['response'] === 'snooze' && (time() - $due['ts'] >= 15 * 60);
        if ($nowMin >= $tm && !$snoozeActive && (!$due || $snoozeExpired)) {
            send_reminder($chats, $p, $it, $dateISO, 'due'); record_notif($pdo, $pid, $iid, $dateISO, 'due'); $sent++;
            continue;
        }
        if ($due && !$snoozeActive && $nowMin >= $tm + GRACE && !isset($notif['overdue|' . $iid])) {
            send_reminder($chats, $p, $it, $dateISO, 'overdue'); record_notif($pdo, $pid, $iid, $dateISO, 'overdue'); $sent++;
        }
    }

    if ($nowMin >= SUMMARY_MIN && !isset($notif['summary|0'])) {
        $sched = 0; $taken = 0; $missed = [];
        foreach ($items as $it) { if (!item_scheduled_on($it, $now)) continue; $sched++; $s = $logs[(int)$it['id']] ?? null; if ($s === 'taken') $taken++; else $missed[] = $it['name']; }
        if ($sched > 0) {
            $txt = '🌙 <b>' . htmlspecialchars($p['name']) . '</b> — ' . $taken . ' / ' . $sched . ' luate azi';
            if ($missed) $txt .= "\nLipsă: " . htmlspecialchars(implode(', ', array_slice($missed, 0, 6)));
            foreach ($chats as $c) tg_send($c, $txt);
            record_notif($pdo, $pid, 0, $dateISO, 'summary'); $sent++;
        }
    }
}
echo "ok sent=$sent profiles=" . count($profs) . "\n";
