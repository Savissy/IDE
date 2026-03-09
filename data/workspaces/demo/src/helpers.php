<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name(SESSION_NAME);

    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path' => '/',
        'domain' => '',
        'secure' => SESSION_SECURE_COOKIE,
        'httponly' => true,
        'samesite' => SESSION_SAMESITE,
    ]);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', SESSION_SECURE_COOKIE ? '1' : '0');
    ini_set('session.cookie_samesite', SESSION_SAMESITE);

    session_start();
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $path): never
{
    header('Location: ' . $path);
    exit;
}

function current_user_id(): ?int
{
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function is_logged_in(): bool
{
    return current_user_id() !== null;
}

function csrf_token(): string
{
    if (empty($_SESSION[CSRF_TOKEN_KEY])) {
        $_SESSION[CSRF_TOKEN_KEY] = bin2hex(random_bytes(32));
    }

    return $_SESSION[CSRF_TOKEN_KEY];
}

function verify_csrf_token(?string $token): bool
{
    if (!$token || empty($_SESSION[CSRF_TOKEN_KEY])) {
        return false;
    }

    return hash_equals($_SESSION[CSRF_TOKEN_KEY], $token);
}

function post_string(string $key, int $maxLen = 255): string
{
    $value = trim((string) ($_POST[$key] ?? ''));
    if (mb_strlen($value) > $maxLen) {
        return mb_substr($value, 0, $maxLen);
    }

    return $value;
}

function validate_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== strtoupper($method)) {
        http_response_code(405);
        exit('Method Not Allowed');
    }
}

function session_regenerate_safe(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function is_rate_limited(string $action, string $identifier, int $maxAttempts, int $windowSeconds): bool
{
    $pdo = db();
    $ip = client_ip();
    $identifierHash = hash('sha256', mb_strtolower($identifier));

    $stmt = $pdo->prepare(
        'SELECT id, attempts, window_start FROM auth_rate_limits WHERE action = :action AND ip_address = :ip AND identifier_hash = :identifier_hash LIMIT 1'
    );
    $stmt->execute([
        ':action' => $action,
        ':ip' => $ip,
        ':identifier_hash' => $identifierHash,
    ]);
    $row = $stmt->fetch();

    $now = time();

    if (!$row) {
        $insert = $pdo->prepare(
            'INSERT INTO auth_rate_limits (action, ip_address, identifier_hash, attempts, window_start, created_at, updated_at) VALUES (:action, :ip, :identifier_hash, 1, NOW(), NOW(), NOW())'
        );
        $insert->execute([
            ':action' => $action,
            ':ip' => $ip,
            ':identifier_hash' => $identifierHash,
        ]);

        return false;
    }

    $windowStart = strtotime((string) $row['window_start']);
    $attempts = (int) $row['attempts'];

    if (($now - $windowStart) > $windowSeconds) {
        $reset = $pdo->prepare('UPDATE auth_rate_limits SET attempts = 1, window_start = NOW(), updated_at = NOW() WHERE id = :id');
        $reset->execute([':id' => (int) $row['id']]);
        return false;
    }

    if ($attempts >= $maxAttempts) {
        return true;
    }

    $increment = $pdo->prepare('UPDATE auth_rate_limits SET attempts = attempts + 1, updated_at = NOW() WHERE id = :id');
    $increment->execute([':id' => (int) $row['id']]);

    return false;
}

function clear_rate_limit(string $action, string $identifier): void
{
    $pdo = db();
    $stmt = $pdo->prepare('DELETE FROM auth_rate_limits WHERE action = :action AND ip_address = :ip AND identifier_hash = :identifier_hash');
    $stmt->execute([
        ':action' => $action,
        ':ip' => client_ip(),
        ':identifier_hash' => hash('sha256', mb_strtolower($identifier)),
    ]);
}

function log_security_event(string $eventType, ?int $userId, array $meta = []): void
{
    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO security_events (event_type, user_id, ip_address, user_agent, metadata_json, created_at) VALUES (:event_type, :user_id, :ip_address, :user_agent, :metadata_json, NOW())'
    );
    $stmt->execute([
        ':event_type' => $eventType,
        ':user_id' => $userId,
        ':ip_address' => client_ip(),
        ':user_agent' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'), 0, 500),
        ':metadata_json' => json_encode($meta, JSON_UNESCAPED_UNICODE),
    ]);
}
