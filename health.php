<?php
require_once __DIR__ . '/db.php';
$db = false;
try { pdo()->query('SELECT 1'); $db = true; } catch (Throwable $e) { $db = false; }
json_out(['ok' => true, 'php' => PHP_VERSION, 'db' => $db, 'time' => gmdate('c')]);
