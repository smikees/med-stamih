<?php
/* db.php — shared bootstrap: PDO, JSON helpers, cookie auth, and the single
   authorization choke-point requireProfile(). Every API includes this. */
require_once __DIR__ . '/config.php';

mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');

function pdo(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
             PDO::ATTR_EMULATE_PREPARES => false]
        );
    }
    return $pdo;
}

/* ---------- JSON I/O ---------- */
function body_json(): array {
    $raw = file_get_contents('php://input');
    $j = json_decode($raw ?: '[]', true);
    return is_array($j) ? $j : [];
}
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): void { json_out(['error' => $msg], $code); }

/* ---------- Signed cookie auth (stateless, HMAC) ---------- */
function issue_auth_cookie(array $user): void {
    $payload = [
        'id'     => (int)$user['id'],
        'email'  => $user['email'],
        'name'   => $user['name'] ?? '',
        'avatar' => $user['avatar'] ?? '',
        'admin'  => (int)($user['is_admin'] ?? 0),
        'exp'    => time() + 60 * 60 * 24 * 60,   // 60 days
    ];
    $p = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $p, AUTH_SECRET);
    setcookie('med_auth', $p . '.' . $sig, [
        'expires'  => $payload['exp'],
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
function clear_auth_cookie(): void {
    setcookie('med_auth', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
}
function current_user(): ?array {
    $c = $_COOKIE['med_auth'] ?? '';
    if (!$c || substr_count($c, '.') !== 1) return null;
    [$p, $sig] = explode('.', $c, 2);
    if (!hash_equals(hash_hmac('sha256', $p, AUTH_SECRET), $sig)) return null;
    $data = json_decode(base64_decode(strtr($p, '-_', '+/')), true);
    if (!is_array($data) || ($data['exp'] ?? 0) < time()) return null;
    return $data;
}
function require_user(): array {
    $u = current_user();
    if (!$u) fail('auth', 401);
    return $u;
}

/* ---------- CSRF (double-submit token tied to the auth cookie) ---------- */
function csrf_token(): string {
    $c = $_COOKIE['med_auth'] ?? '';
    return substr(hash_hmac('sha256', 'csrf|' . $c, AUTH_SECRET), 0, 32);
}
function require_csrf(): void {
    $t = $_SERVER['HTTP_X_CSRF'] ?? ($_POST['_csrf'] ?? '');
    if (!hash_equals(csrf_token(), (string)$t)) fail('csrf', 403);
}

/* ---------- THE authorization choke-point ----------
   Returns ['role'=>'owner'|'editor'] if $userId may access $profileId at the
   required level, else sends 403 and exits. NOTHING reads/writes profile data
   without passing through here. */
function require_profile(int $profileId, string $minRole = 'editor'): array {
    $u = require_user();
    $st = pdo()->prepare('SELECT role FROM profile_members WHERE profile_id=? AND user_id=? LIMIT 1');
    $st->execute([$profileId, (int)$u['id']]);
    $row = $st->fetch();
    if (!$row) fail('forbidden', 403);
    if ($minRole === 'owner' && $row['role'] !== 'owner') fail('forbidden', 403);
    return ['role' => $row['role'], 'user' => $u];
}

/* profiles the current user is a member of (server-derived; client never trusted) */
function my_profiles(int $userId): array {
    $st = pdo()->prepare(
        'SELECT p.*, pm.role FROM profiles p
         JOIN profile_members pm ON pm.profile_id = p.id
         WHERE pm.user_id = ? ORDER BY p.created_at ASC');
    $st->execute([$userId]);
    return $st->fetchAll();
}
