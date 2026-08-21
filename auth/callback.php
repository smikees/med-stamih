<?php
/* Google OAuth callback: exchange code -> id token / userinfo -> upsert user -> cookie. */
require_once __DIR__ . '/../db.php';

$code  = $_GET['code']  ?? '';
$state = $_GET['state'] ?? '';
$saved = $_COOKIE['med_oauth_state'] ?? '';
if (!$code || !$state || !hash_equals($saved, $state)) { http_response_code(400); exit('bad_state'); }
setcookie('med_oauth_state', '', ['expires' => time() - 3600, 'path' => '/']);

function post_form(string $url, array $fields): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_TIMEOUT => 15,
    ]);
    $r = curl_exec($ch); curl_close($ch);
    return json_decode($r ?: '[]', true) ?: [];
}
function get_auth(string $url, string $token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token], CURLOPT_TIMEOUT => 15]);
    $r = curl_exec($ch); curl_close($ch);
    return json_decode($r ?: '[]', true) ?: [];
}

$tok = post_form('https://oauth2.googleapis.com/token', [
    'code' => $code, 'client_id' => GOOGLE_CLIENT_ID, 'client_secret' => GOOGLE_CLIENT_SECRET,
    'redirect_uri' => GOOGLE_REDIRECT_URI, 'grant_type' => 'authorization_code',
]);
if (empty($tok['access_token'])) { http_response_code(401); exit('token_exchange_failed'); }

$info = get_auth('https://openidconnect.googleapis.com/v1/userinfo', $tok['access_token']);
$email = strtolower(trim($info['email'] ?? ''));
$sub   = $info['sub'] ?? '';
if (!$email || empty($info['email_verified'])) { http_response_code(401); exit('email_unverified'); }

$name   = $info['name'] ?? '';
$avatar = $info['picture'] ?? '';
$isAdmin = in_array($email, array_map('trim', explode(',', strtolower(ADMIN_EMAILS))), true) ? 1 : 0;

$pdo = pdo();
$st = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
$st->execute([$email]);
$u = $st->fetch();
if ($u) {
    $pdo->prepare('UPDATE users SET google_sub=?, name=COALESCE(NULLIF(name,""),?), avatar=?, is_admin=GREATEST(is_admin,?) WHERE id=?')
        ->execute([$sub, $name, $avatar, $isAdmin, $u['id']]);
    $u['is_admin'] = max((int)$u['is_admin'], $isAdmin);
} else {
    $pdo->prepare('INSERT INTO users (email,name,avatar,google_sub,is_admin) VALUES (?,?,?,?,?)')
        ->execute([$email, $name, $avatar, $sub, $isAdmin]);
    $u = ['id' => $pdo->lastInsertId(), 'email' => $email, 'name' => $name, 'avatar' => $avatar, 'is_admin' => $isAdmin];
}
issue_auth_cookie($u);
header('Location: ' . APP_URL . '/');
