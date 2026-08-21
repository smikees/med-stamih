<?php
/* media.php — item photos, access-checked. Raw files live under media/<pid>/ and
   are blocked from direct web access (media/.htaccess); everything is served here
   through require_profile(). Uploads are re-encoded to JPEG, which strips EXIF/GPS. */
require_once __DIR__ . '/db.php';
$me = require_user();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$base = __DIR__ . '/media';

/* ---- serve: GET ?item=<id> ---- */
if ($method === 'GET') {
    $iid = (int)($_GET['item'] ?? 0);
    $s = pdo()->prepare('SELECT profile_id, photo_url FROM items WHERE id=?'); $s->execute([$iid]); $it = $s->fetch();
    if (!$it || !$it['photo_url']) { http_response_code(404); exit; }
    require_profile((int)$it['profile_id']);                 // 403 if not a member
    $rel = $it['photo_url'];
    if (!preg_match('#^\d+/[A-Za-z0-9._-]+$#', $rel)) { http_response_code(404); exit; }
    $path = $base . '/' . $rel;
    if (!is_file($path)) { http_response_code(404); exit; }
    header('Content-Type: image/jpeg');
    header('Cache-Control: private, max-age=86400');
    header('Content-Length: ' . filesize($path));
    readfile($path); exit;
}

/* ---- upload: POST ?action=upload (multipart) ---- */
if ($method === 'POST' && ($_GET['action'] ?? '') === 'upload') {
    require_csrf();
    if (!extension_loaded('gd')) fail('no_image_support', 500);
    $pid = (int)($_POST['profile_id'] ?? 0);
    require_profile($pid, 'editor');
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail('no_file', 400);
    if ($_FILES['file']['size'] > 10 * 1024 * 1024) fail('too_big', 400);
    $data = file_get_contents($_FILES['file']['tmp_name']);
    $img = @imagecreatefromstring($data);
    if (!$img) fail('bad_image', 400);

    // auto-orient from EXIF (JPEG only) before we drop metadata
    if (function_exists('exif_read_data')) {
        $ex = @exif_read_data($_FILES['file']['tmp_name']);
        $o = $ex['Orientation'] ?? 0;
        if ($o == 3) $img = imagerotate($img, 180, 0);
        elseif ($o == 6) $img = imagerotate($img, -90, 0);
        elseif ($o == 8) $img = imagerotate($img, 90, 0);
    }
    $w = imagesx($img); $h = imagesy($img); $mx = max($w, $h);
    $scale = $mx > 1024 ? 1024 / $mx : 1.0;
    $nw = max(1, (int)round($w * $scale)); $nh = max(1, (int)round($h * $scale));
    $out = imagecreatetruecolor($nw, $nh);
    imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);

    $pdir = $base . '/' . $pid;
    if (!is_dir($pdir) && !mkdir($pdir, 0775, true) && !is_dir($pdir)) fail('mkdir_failed', 500);
    // block direct web access to uploaded files (served only through this script)
    $ht = $base . '/.htaccess';
    if (!is_file($ht)) @file_put_contents($ht, "Require all denied\nDeny from all\n");
    $name = bin2hex(random_bytes(8)) . '.jpg';
    if (!imagejpeg($out, $pdir . '/' . $name, 82)) fail('write_failed', 500);
    json_out(['photo_url' => $pid . '/' . $name]);
}

fail('bad_request', 400);
