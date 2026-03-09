<?php

declare(strict_types=1);

require_once __DIR__ . '/src/middleware.php';
require_auth();

$pdo = db();
$stmt = $pdo->prepare('SELECT user_id FROM customer_profiles WHERE user_id = :user_id LIMIT 1');
$stmt->execute([':user_id' => current_user_id()]);
if (!$stmt->fetch()) {
    redirect('/profile.php');
}

header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');

readfile(__DIR__ . '/main.html');
