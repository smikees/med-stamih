<?php
require_once __DIR__ . '/../db.php';
clear_auth_cookie();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') json_out(['ok' => true]);
header('Location: ' . APP_URL . '/');
