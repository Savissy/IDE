# Defi-Dapp

## Backend Authentication + Customer Profile Integration (PHP 8.2 + MySQL)

This repo keeps the existing Cardano dApp logic/UI files (`index.html`, `main.html`, `app.js`, `mint.js`) intact, and adds a production-ready PHP auth/profile backend around them.

## A) Step-by-step integration plan

### 1) Proposed minimal layout (already applied)
- `/index.html` → existing public marketing homepage (unchanged visual/layout).
- `/main.html` → existing dApp UI shell with wallet connect and actions (unchanged content).
- `/app.js`, `/mint.js` → existing offchain/browser logic (unchanged).
- `/src` → backend core (`config.php`, `db.php`, `helpers.php`, `middleware.php`).
- `/auth` → auth endpoints/pages (`register.php`, `login.php`, `logout.php`).
- `/profile.php` → customer profile KYC-lite form.
- `/launch.php` → post-login gate (ensures auth + profile complete, then redirects to dApp).
- `/app.php` → protected dApp entry (server-side guard, then serves `main.html`).
- `/db/migrations/001_auth_and_profiles.sql` → DB schema migration.
- `/.htaccess` → Apache rewrite/headers to force guarded access.

### 2) Routing approach
- Marketing homepage stays public at `/` (`index.html`).
- Existing Launch buttons already point to `/launch.php`.
- `/launch.php` checks:
  1. User session exists.
  2. Customer profile exists.
  3. Redirects to `/app.php`.
- `/app.php` enforces authentication server-side, then serves existing `main.html` without altering dApp content.
- Direct `/main.html` access is redirected to `/launch.php` through `.htaccess`.

### 3) Where to place existing HTML/JS files
- Keep current files in repo/web root:
  - `index.html`
  - `main.html`
  - `app.js`
  - `mint.js`
- No dApp UI redesign or onchain/offchain flow rewrites are required.

## B) Database schema/migration

Use `db/migrations/001_auth_and_profiles.sql`.

Includes:
- `users`: id, email, password_hash, email_verified_at, created_at, updated_at, last_login_at, status.
- `customer_profiles`: user FK + KYC-lite contact fields.
- `auth_rate_limits`: basic login throttling.
- `security_events`: minimal security/auth audit events.

## C) Backend code map

### Core backend
- `src/config.php` → app/db/session constants.
- `src/db.php` → PDO connection (exceptions + prepared statement-safe defaults).
- `src/helpers.php` → secure session bootstrapping, CSRF, escaping, redirects, validation helpers, rate limiting, logging.
- `src/middleware.php` → `require_auth()` and `require_guest()` guards.

### Auth + profile
- `auth/register.php` → secure registration (`password_hash`), CSRF, validation.
- `auth/login.php` → login (`password_verify`), session regeneration, rate limiting.
- `auth/logout.php` → destroys session and cookie.
- `profile.php` → create/update customer profile right after registration.

### Protected app access
- `launch.php` → checks auth + profile completion; routes to `/app.php`.
- `app.php` → protected gateway that serves the existing `main.html`.

## D) Frontend integration details (minimal/no redesign)

Implemented Option 2 style guard:
1. Keep `main.html` unchanged.
2. Serve dApp only through `app.php` after middleware check.
3. Block direct static `main.html` access via Apache rewrite to `/launch.php`.

This keeps the existing dApp content/layout unchanged while enforcing login server-side.

## E) Security checklist

Implemented:
- Password hashing via `password_hash()` and verification via `password_verify()`.
- CSRF protection for register/login/profile forms.
- Input validation for email, password strength, required profile fields.
- SQL injection protection with PDO prepared statements.
- Session protections:
  - HttpOnly cookies
  - configurable Secure flag
  - SameSite policy
  - strict mode + session ID regeneration on login/register
- Basic rate limiting for login attempts using DB-backed counters.
- Minimal security logging via `security_events` table.

Operational recommendations:
- Set `SESSION_SECURE_COOKIE=true` in HTTPS production.
- Rotate DB credentials and run least-privilege DB user.
- Add fail2ban/WAF at edge for stronger abuse protection.
- Add email verification + password reset token table later (schema is reset-ready via users/events model).

## F) Local setup and deployment

### 1) Configure environment constants
Edit `src/config.php`:
- `APP_URL`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `SESSION_SECURE_COOKIE` (`true` in HTTPS)

### 2) Create database + run migration
```bash
mysql -u root -p -e "CREATE DATABASE defi_dapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p defi_dapp < db/migrations/001_auth_and_profiles.sql
```

### 3) Run locally
```bash
php -S 0.0.0.0:8000
```
Open `http://localhost:8000`.

### 4) Test flow
1. Visit `/auth/register.php` and create account.
2. Complete `/profile.php` customer data.
3. Login at `/auth/login.php`.
4. Click Launch App on homepage (`/index.html`) → `/launch.php` → `/app.php` → existing dApp UI in `main.html`.
5. Wallet connection still happens client-side in existing JS after login gate.

### 5) Apache shared hosting notes
- Keep `.htaccess` enabled (`AllowOverride All`).
- Ensure PHP 8.2+ and PDO MySQL extension installed.

### 6) Nginx equivalent guard snippet
```nginx
location = /main.html {
    return 302 /launch.php;
}

location / {
    try_files $uri $uri/ /index.html;
}

location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
}
```

## Notes on wallet connection coexistence
- Login/profile state is handled server-side with PHP sessions.
- Wallet connect and onchain actions remain in existing frontend flow (`main.html` + `app.js`).
- Wallet address is not used as identity proof; optional storage field exists in profile schema for future linking.
