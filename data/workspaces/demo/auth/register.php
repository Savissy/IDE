<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/middleware.php';
require_guest();

$errors = [];
$email = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $email = mb_strtolower(post_string('email', 190));
    $password = (string) ($_POST['password'] ?? '');
    $passwordConfirm = (string) ($_POST['password_confirm'] ?? '');
    $token = (string) ($_POST['csrf_token'] ?? '');

    if (!verify_csrf_token($token)) {
        $errors[] = 'Invalid CSRF token. Please refresh and try again.';
    }

    if (!validate_email($email)) {
        $errors[] = 'Please provide a valid email address.';
    }

    if (strlen($password) < 12) {
        $errors[] = 'Password must be at least 12 characters.';
    }

    if (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/\d/', $password)) {
        $errors[] = 'Password must include upper-case, lower-case, and a number.';
    }

    if ($password !== $passwordConfirm) {
        $errors[] = 'Password confirmation does not match.';
    }

    if (!$errors) {
        $pdo = db();

        $existingStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $existingStmt->execute([':email' => $email]);
        if ($existingStmt->fetch()) {
            $errors[] = 'An account with this email already exists.';
        } else {
            $insertStmt = $pdo->prepare(
                'INSERT INTO users (email, password_hash, status, created_at, updated_at) VALUES (:email, :password_hash, :status, NOW(), NOW())'
            );
            $insertStmt->execute([
                ':email' => $email,
                ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
                ':status' => 'active',
            ]);

            $userId = (int) $pdo->lastInsertId();

            session_regenerate_safe();
            $_SESSION['user_id'] = $userId;
            $_SESSION['user_email'] = $email;
            $_SESSION['authenticated_at'] = time();

            log_security_event('registration_success', $userId, ['email' => $email]);
            redirect('/profile.php');
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register - <?= e(APP_NAME) ?></title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; margin: 0; }
    .container { max-width: 480px; margin: 40px auto; padding: 24px; background: #1e293b; border-radius: 12px; }
    input, button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: 1px solid #334155; }
    button { background: #059669; color: #fff; border: none; cursor: pointer; font-weight: bold; }
    .error { color: #fca5a5; margin: 8px 0; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
<div class="container">
  <h1>Create account</h1>
  <p>Register with email/password, then complete your customer profile before launching the dApp.</p>

  <?php foreach ($errors as $error): ?>
    <div class="error">• <?= e($error) ?></div>
  <?php endforeach; ?>

  <form method="post" action="/auth/register.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
    <label>Email</label>
    <input type="email" name="email" required maxlength="190" value="<?= e($email) ?>">

    <label>Password</label>
    <input type="password" name="password" required minlength="12">

    <label>Confirm password</label>
    <input type="password" name="password_confirm" required minlength="12">

    <button type="submit">Register</button>
  </form>

  <p>Already registered? <a href="/auth/login.php">Log in</a></p>
</div>
</body>
</html>
