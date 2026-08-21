<?php
/* api/notify.php — "notify now": push an immediate reminder for one item to the
   profile's verified Telegram channels. Does NOT write notif_log, so the normal
   scheduled reminder still fires independently (handy for testing). */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../remind.php';
$me = require_user();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('method', 405);
require_csrf();
$b = body_json();
$pid = (int)($b['profile_id'] ?? 0);
require_profile($pid, 'editor');
$pdo = pdo();
$st = $pdo->prepare('SELECT * FROM items WHERE id=? AND profile_id=? AND active=1');
$st->execute([(int)($b['item_id'] ?? 0), $pid]); $item = $st->fetch();
if (!$item) fail('no_item', 404);
$pf = $pdo->prepare('SELECT id,name,timezone FROM profiles WHERE id=?'); $pf->execute([$pid]); $prof = $pf->fetch();
$chs = $pdo->prepare('SELECT address FROM channels WHERE profile_id=? AND kind="telegram" AND verified=1'); $chs->execute([$pid]);
$chats = array_column($chs->fetchAll(), 'address');
if (!$chats) json_out(['sent' => 0, 'no_channel' => true]);
$now = new DateTime('now', new DateTimeZone($prof['timezone'] ?: 'Europe/Bucharest'));
send_item_reminder($chats, $prof, $item, $now->format('Y-m-d'), 'due');
json_out(['sent' => count($chats)]);
