<?php
require_once __DIR__ . '/../db.php';
$u = current_user();
if (!$u) json_out(['user' => null], 200);
json_out([
    'user' => ['id' => $u['id'], 'email' => $u['email'], 'name' => $u['name'], 'avatar' => $u['avatar'], 'admin' => (int)($u['admin'] ?? 0)],
    'csrf' => csrf_token(),
]);
