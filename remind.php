<?php
/* remind.php — shared Telegram reminder message builder, used by both the cron
   dispatcher and the manual "notify now" endpoint so they stay identical. */
require_once __DIR__ . '/tg.php';

function reminder_payload(array $p, array $it, string $date, string $kind): array {
    $isAct = $it['type'] === 'activity';
    $emoji = $kind === 'overdue' ? '⚠️' : '⏰';
    $head  = $kind === 'overdue' ? 'Întârziat: ' : '';
    $extra = (!$isAct && (int)$it['count'] > 1) ? ' (×' . (int)$it['count'] . ')' : '';
    $txt = $emoji . ' <b>' . htmlspecialchars($p['name']) . "</b>\n" . $head . htmlspecialchars($it['name']) . $extra . ' · ' . fmtmin_ro((int)$it['time_min']);
    $cb = 'L|' . $p['id'] . '|' . $it['id'] . '|' . $date . '|';
    $buttons = [
        [['text' => $isAct ? '✅ Am făcut' : '✅ Am luat', 'callback_data' => $cb . 't'],
         ['text' => $isAct ? '❌ Nu am făcut' : '❌ Nu am luat', 'callback_data' => $cb . 's']],
        [['text' => '⏰ Amână', 'callback_data' => $cb . 'z']],
    ];
    return [$txt, $buttons];
}
function send_item_reminder(array $chats, array $p, array $it, string $date, string $kind): void {
    [$txt, $buttons] = reminder_payload($p, $it, $date, $kind);
    foreach ($chats as $c) tg_send($c, $txt, $buttons);
}
