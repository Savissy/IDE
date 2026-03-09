<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

start_secure_session();

function require_auth(): void
{
    if (!is_logged_in()) {
        $_SESSION['after_login_redirect'] = $_SERVER['REQUEST_URI'] ?? DEFAULT_REDIRECT_AFTER_LOGIN;
        redirect('/auth/login.php');
    }
}

function require_guest(): void
{
    if (is_logged_in()) {
        redirect(DEFAULT_REDIRECT_AFTER_LOGIN);
    }
}
