<?php
/* auth/login.php
   - POST  {email,password}  -> local login (bcrypt)
   - GET   ?provider=google  -> redirect to Google consent */
require_once __DIR__ . '/../db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && ($_GET['provider'] ?? '') === 'google') {
    if (!GOOGLE_CLIENT_ID) fail('google_not_configured', 503);
    $state = bin2hex(random_bytes(16));
    setcookie('med_oauth_state', $state, ['expires' => time() + 600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    $params = http_build_query([
        'client_id'     => GOOGLE_CLIENT_ID,
        'redirect_uri'  => GOOGLE_REDIRECT_URI,
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'state'         => $state,
        'prompt'        => 'select_account',
    ]);
    header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
    exit;
}

if ($method === 'POST') {
    $b = body_json();
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = (string)($b['password'] ?? '');
    if (!$email || !$pass) fail('missing', 400);
    // basic rate-limit: small sleep on any attempt to blunt brute force
    usleep(250000);
    $st = pdo()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u || !$u['pass_hash'] || !password_verify($pass, $u['pass_hash'])) fail('bad_credentials', 401);
    issue_auth_cookie($u);
    json_out(['ok' => true]);
}

fail('method', 405);
