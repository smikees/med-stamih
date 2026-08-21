<?php
/* install.php?key=INSTALL_KEY — one-time, idempotent schema loader + admin seed.
   Safe to re-run (CREATE TABLE IF NOT EXISTS). Guarded by the secret in config.php. */
require_once __DIR__ . '/db.php';
header('Content-Type: text/plain; charset=utf-8');

if (!hash_equals(INSTALL_KEY, (string)($_GET['key'] ?? ''))) { http_response_code(403); exit("forbidden\n"); }

$sql = file_get_contents(__DIR__ . '/schema.sql');
if ($sql === false) exit("schema.sql missing\n");

$pdo = pdo();
$done = 0;
// Strip every "-- ..." comment to end-of-line FIRST, so semicolons inside
// comments can't break statement splitting. (No schema string contains '--'.)
$noComments = implode("\n", array_map(function ($l) {
    $p = strpos($l, '--');
    return $p === false ? $l : substr($l, 0, $p);
}, explode("\n", $sql)));
foreach (array_filter(array_map('trim', explode(';', $noComments))) as $clean) {
    if ($clean === '') continue;
    try {
        $pdo->exec($clean);
        $done++;
    } catch (Throwable $e) {
        http_response_code(500);
        echo "FAILED statement #" . ($done + 1) . ": " . $e->getMessage() . "\n\n--- SQL ---\n" . substr($clean, 0, 400) . "\n";
        exit;
    }
}

// seed admin accounts (Google-only, is_admin=1) from ADMIN_EMAILS
$seeded = [];
foreach (array_map('trim', explode(',', strtolower(ADMIN_EMAILS))) as $email) {
    if (!$email) continue;
    $st = $pdo->prepare('SELECT id FROM users WHERE email=?'); $st->execute([$email]);
    if ($st->fetch()) { $pdo->prepare('UPDATE users SET is_admin=1 WHERE email=?')->execute([$email]); }
    else { $pdo->prepare('INSERT INTO users (email,is_admin) VALUES (?,1)')->execute([$email]); $seeded[] = $email; }
}

echo "OK\nstatements executed: $done\nadmin seeded: " . (implode(', ', $seeded) ?: '(already present)') . "\n";
