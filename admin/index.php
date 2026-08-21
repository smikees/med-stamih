<?php
/* admin/index.php — protected console for the account owner:
   create local (non-Google) family logins, create profiles, and share them.
   Access limited to users with is_admin=1. */
require_once __DIR__ . '/../db.php';
$me = current_user();
if (!$me) { header('Location: ' . APP_URL . '/'); exit; }
if (empty($me['admin'])) { http_response_code(403); exit('Admins only.'); }

$pdo = pdo();
$msg = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!hash_equals(csrf_token(), (string)($_POST['_csrf'] ?? ''))) { http_response_code(403); exit('csrf'); }
    $act = $_POST['action'] ?? '';
    try {
        if ($act === 'create_user') {
            $email = strtolower(trim($_POST['email'] ?? ''));
            $name  = trim($_POST['name'] ?? '');
            $pass  = (string)($_POST['password'] ?? '');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) throw new Exception('Valid email + password (6+ chars) required.');
            $hash = password_hash($pass, PASSWORD_BCRYPT);
            $pdo->prepare('INSERT INTO users (email,name,pass_hash) VALUES (?,?,?)
                           ON DUPLICATE KEY UPDATE name=VALUES(name), pass_hash=VALUES(pass_hash)')
                ->execute([$email, $name, $hash]);
            $msg = "Saved local login for $email.";
        } elseif ($act === 'create_profile') {
            $name = trim($_POST['pname'] ?? '');
            $rel  = trim($_POST['relation'] ?? '');
            $tz   = trim($_POST['timezone'] ?? 'Europe/Bucharest');
            if ($name === '') throw new Exception('Profile name required.');
            $pdo->prepare('INSERT INTO profiles (name,relation,timezone,created_by) VALUES (?,?,?,?)')
                ->execute([$name, $rel, $tz, (int)$me['id']]);
            $pid = (int)$pdo->lastInsertId();
            $pdo->prepare('INSERT INTO profile_members (profile_id,user_id,role) VALUES (?,?,"owner")')
                ->execute([$pid, (int)$me['id']]);
            $msg = "Created profile “$name” (you are owner).";
        } elseif ($act === 'share') {
            $pid   = (int)($_POST['profile_id'] ?? 0);
            $email = strtolower(trim($_POST['share_email'] ?? ''));
            $role  = ($_POST['role'] ?? 'editor') === 'owner' ? 'owner' : 'editor';
            // only an owner of that profile may share it
            $chk = $pdo->prepare('SELECT 1 FROM profile_members WHERE profile_id=? AND user_id=? AND role="owner"');
            $chk->execute([$pid, (int)$me['id']]);
            if (!$chk->fetch()) throw new Exception('You are not an owner of that profile.');
            $u = $pdo->prepare('SELECT id FROM users WHERE email=?'); $u->execute([$email]); $urow = $u->fetch();
            if (!$urow) throw new Exception("No account with email $email yet — create the login first.");
            $pdo->prepare('INSERT IGNORE INTO profile_members (profile_id,user_id,role) VALUES (?,?,?)')
                ->execute([$pid, (int)$urow['id'], $role]);
            $msg = "Shared profile #$pid with $email ($role).";
        }
    } catch (Throwable $e) { $msg = 'Error: ' . $e->getMessage(); }
}

$users = $pdo->query('SELECT id,email,name,is_admin,(pass_hash IS NOT NULL) AS local,(google_sub IS NOT NULL) AS google FROM users ORDER BY id')->fetchAll();
$myProfiles = $pdo->prepare('SELECT p.*, pm.role FROM profiles p JOIN profile_members pm ON pm.profile_id=p.id WHERE pm.user_id=? ORDER BY p.id');
$myProfiles->execute([(int)$me['id']]); $profiles = $myProfiles->fetchAll();
$csrf = htmlspecialchars(csrf_token());
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES); }
?><!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alongside · Admin</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#201e1d;background:#f5ead8}
 h1{font-size:1.4em}h2{font-size:1.05em;margin-top:28px}
 fieldset{border:1px solid #201e1d33;border-radius:14px;padding:14px 16px;margin:12px 0;background:#ebddc5}
 label{display:block;font-weight:600;margin:8px 0 3px}input,select{font:inherit;padding:8px 10px;border-radius:999px;border:1px solid #201e1d55;width:100%;box-sizing:border-box;background:#f9f4ed}
 button{font:inherit;font-weight:700;padding:9px 16px;border-radius:999px;border:0;background:#c67139;color:#fff;cursor:pointer;margin-top:10px}
 table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border-bottom:1px solid #201e1d22;padding:6px 8px;text-align:left;font-size:.92em}
 .msg{background:#e1eecc;border:1px solid #7a8a5e;border-radius:12px;padding:10px 12px;margin:12px 0}
 .row{display:flex;gap:12px}.row>div{flex:1}
 a{color:#8c491a}
</style></head><body>
<h1>Alongside · Admin</h1>
<p>Signed in as <b><?=h($me['email'])?></b> · <a href="<?=h(APP_URL)?>/">open app</a> · <a href="<?=h(APP_URL)?>/auth/logout.php">sign out</a></p>
<?php if($msg):?><div class="msg"><?=h($msg)?></div><?php endif;?>

<h2>1 · Create a family login (non-Google)</h2>
<form method="post"><fieldset>
 <input type="hidden" name="_csrf" value="<?=$csrf?>"><input type="hidden" name="action" value="create_user">
 <div class="row"><div><label>Email</label><input name="email" type="email" required placeholder="grandma@example.com"></div>
 <div><label>Name</label><input name="name" placeholder="Ruth"></div></div>
 <label>Temporary password (6+ chars)</label><input name="password" required minlength="6">
 <button>Create / update login</button>
</fieldset></form>

<h2>2 · Create a profile (patient)</h2>
<form method="post"><fieldset>
 <input type="hidden" name="_csrf" value="<?=$csrf?>"><input type="hidden" name="action" value="create_profile">
 <div class="row"><div><label>Name</label><input name="pname" required placeholder="Ruth"></div>
 <div><label>Relationship</label><input name="relation" placeholder="Grandmother"></div></div>
 <label>Timezone</label><input name="timezone" value="Europe/Bucharest">
 <button>Create profile</button>
</fieldset></form>

<h2>3 · Share a profile with a login</h2>
<form method="post"><fieldset>
 <input type="hidden" name="_csrf" value="<?=$csrf?>"><input type="hidden" name="action" value="share">
 <label>Profile</label><select name="profile_id"><?php foreach($profiles as $p):?><option value="<?=$p['id']?>"><?=h($p['name'])?> (#<?=$p['id']?>, <?=$p['role']?>)</option><?php endforeach;?></select>
 <div class="row"><div><label>Share with email</label><input name="share_email" type="email" required></div>
 <div><label>Role</label><select name="role"><option value="editor">editor</option><option value="owner">owner</option></select></div></div>
 <button>Share</button>
</fieldset></form>

<h2>Accounts</h2>
<table><tr><th>id</th><th>email</th><th>name</th><th>type</th><th>admin</th></tr>
<?php foreach($users as $u):?><tr><td><?=$u['id']?></td><td><?=h($u['email'])?></td><td><?=h($u['name'])?></td>
 <td><?=$u['google']?'Google ':''?><?=$u['local']?'local':''?></td><td><?=$u['is_admin']?'✓':''?></td></tr><?php endforeach;?>
</table>

<h2>Your profiles</h2>
<table><tr><th>id</th><th>name</th><th>relation</th><th>tz</th><th>role</th></tr>
<?php foreach($profiles as $p):?><tr><td><?=$p['id']?></td><td><?=h($p['name'])?></td><td><?=h($p['relation'])?></td><td><?=h($p['timezone'])?></td><td><?=$p['role']?></td></tr><?php endforeach;?>
</table>
</body></html>
