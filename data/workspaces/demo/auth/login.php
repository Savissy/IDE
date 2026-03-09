<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/middleware.php';
require_guest();

$errors = [];
$email = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $email = mb_strtolower(post_string('email', 190));
    $password = (string) ($_POST['password'] ?? '');
    $token = (string) ($_POST['csrf_token'] ?? '');

    if (!verify_csrf_token($token)) {
        $errors[] = 'Invalid CSRF token. Please refresh and try again.';
    }

    if (!validate_email($email)) {
        $errors[] = 'Invalid credentials.';
    }

    if (is_rate_limited('login', $email ?: client_ip(), LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW)) {
        $errors[] = 'Too many login attempts. Please wait and try again.';
    }

    if (!$errors) {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, email, password_hash, status FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string) $user['password_hash'])) {
            $errors[] = 'Invalid credentials.';
            log_security_event('login_failed', null, ['email' => $email]);
        } elseif ($user['status'] !== 'active') {
            $errors[] = 'Account is not active. Please contact support.';
            log_security_event('login_blocked_status', (int) $user['id']);
        } else {
            clear_rate_limit('login', $email);
            session_regenerate_safe();
            $_SESSION['user_id'] = (int) $user['id'];
            $_SESSION['user_email'] = (string) $user['email'];
            $_SESSION['authenticated_at'] = time();

            $updateStmt = $pdo->prepare('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = :id');
            $updateStmt->execute([':id' => (int) $user['id']]);

            log_security_event('login_success', (int) $user['id']);

            $redirectTarget = $_SESSION['after_login_redirect'] ?? DEFAULT_REDIRECT_AFTER_LOGIN;
            unset($_SESSION['after_login_redirect']);
            redirect($redirectTarget);
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - <?= e(APP_NAME) ?></title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; margin: 0; }
    .container { max-width: 420px; margin: 40px auto; padding: 24px; background: #1e293b; border-radius: 12px; }
    input, button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: 1px solid #334155; }
    button { background: #dc2626; color: #fff; border: none; cursor: pointer; font-weight: bold; }
    .error { color: #fca5a5; margin: 8px 0; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
<div class="container">
  <h1>Login</h1>

  <?php foreach ($errors as $error): ?>
    <div class="error">• <?= e($error) ?></div>
  <?php endforeach; ?>

  <form method="post" action="/auth/login.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
    <label>Email</label>
    <input type="email" name="email" required maxlength="190" value="<?= e($email) ?>">

    <label>Password</label>
    <input type="password" name="password" required>

    <button type="submit">Login</button>
  </form>

  <p>No account? <a href="/auth/register.php">Register now</a></p>
</div>
</body>
</html>
