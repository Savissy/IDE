<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/helpers.php';

start_secure_session();

$userId = current_user_id();
if ($userId !== null) {
    log_security_event('logout', $userId);
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
}

session_destroy();
redirect('/');
