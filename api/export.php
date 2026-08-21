<?php
/* api/export.php — access-checked CSV of a profile's logged history, for the doctor.
   GET ?profile=<id>&days=30|90|365. Read-only; require_profile gates access. */
require_once __DIR__ . '/../db.php';
$me = require_user();
$pid = (int)($_GET['profile'] ?? 0);
require_profile($pid);
$days = (int)($_GET['days'] ?? 90); if ($days < 1) $days = 90; if ($days > 1000) $days = 1000;
$to = gmdate('Y-m-d'); $from = gmdate('Y-m-d', time() - ($days - 1) * 86400);
$pdo = pdo();
$pr = $pdo->prepare('SELECT name FROM profiles WHERE id=?'); $pr->execute([$pid]);
$pname = $pr->fetch()['name'] ?? 'profil';
$st = $pdo->prepare('SELECT l.d, i.time_min, i.type, i.name, i.purpose, l.status, l.taken_min, l.note
                     FROM logs l JOIN items i ON i.id=l.item_id
                     WHERE l.profile_id=? AND l.d BETWEEN ? AND ? ORDER BY l.d, i.time_min, i.name');
$st->execute([$pid, $from, $to]);
$safe = preg_replace('/[^A-Za-z0-9_-]+/', '_', $pname);
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="istoric_' . $safe . '_' . $from . '_' . $to . '.csv"');
$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");   // UTF-8 BOM so Excel shows diacritics correctly
$hm = function ($m) { if ($m === null || $m === '') return ''; $m = ((int)$m % 1440 + 1440) % 1440; return sprintf('%02d:%02d', intdiv($m, 60), $m % 60); };
fputcsv($out, ['Data', 'Ora', 'Tip', 'Nume', 'Pentru', 'Stare', 'Ora reală', 'Notă']);
foreach ($st->fetchAll() as $r) {
    fputcsv($out, [
        $r['d'], $hm($r['time_min']),
        $r['type'] === 'activity' ? 'Activitate' : 'Medicament',
        $r['name'], $r['purpose'] ?? '',
        $r['status'] === 'taken' ? 'Luat/Făcut' : 'Nu',
        $hm($r['taken_min']),
        $r['note'] ?? '',
    ]);
}
fclose($out);
