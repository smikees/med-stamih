<?php
/* tg.php — Telegram Bot API helpers (server-only). Messages are Romanian (primary market). */
require_once __DIR__ . '/db.php';

function tg($method, array $params = []) {
    if (!TELEGRAM_BOT_TOKEN) return null;
    $ch = curl_init('https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($params),
        CURLOPT_TIMEOUT => 15,
    ]);
    $r = curl_exec($ch); curl_close($ch);
    return json_decode($r ?: '[]', true);
}
function tg_send($chatId, string $html, ?array $buttons = null) {
    $p = ['chat_id' => $chatId, 'text' => $html, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
    if ($buttons) $p['reply_markup'] = ['inline_keyboard' => $buttons];
    return tg('sendMessage', $p);
}
function tg_answer($cbId, string $text = '') { return tg('answerCallbackQuery', ['callback_query_id' => $cbId, 'text' => $text]); }
function tg_edit($chatId, $msgId, string $html) { return tg('editMessageText', ['chat_id' => $chatId, 'message_id' => $msgId, 'text' => $html, 'parse_mode' => 'HTML']); }

function fmtmin_ro(int $m): string { $m = (($m % 1440) + 1440) % 1440; return sprintf('%02d:%02d', intdiv($m, 60), $m % 60); }
function tznow_min(string $tz): int { $n = new DateTime('now', new DateTimeZone($tz ?: 'Europe/Bucharest')); return (int)$n->format('G') * 60 + (int)$n->format('i'); }
