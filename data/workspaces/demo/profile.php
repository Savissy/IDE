<?php

declare(strict_types=1);

require_once __DIR__ . '/src/middleware.php';
require_auth();

$pdo = db();
$userId = current_user_id();
$errors = [];
$success = false;

$stmt = $pdo->prepare('SELECT * FROM customer_profiles WHERE user_id = :user_id LIMIT 1');
$stmt->execute([':user_id' => $userId]);
$profile = $stmt->fetch() ?: [];

$fields = [
    'full_name' => (string) ($profile['full_name'] ?? ''),
    'phone' => (string) ($profile['phone'] ?? ''),
    'country' => (string) ($profile['country'] ?? ''),
    'city' => (string) ($profile['city'] ?? ''),
    'address_line1' => (string) ($profile['address_line1'] ?? ''),
    'address_line2' => (string) ($profile['address_line2'] ?? ''),
    'company' => (string) ($profile['company'] ?? ''),
    'id_type' => (string) ($profile['id_type'] ?? ''),
    'id_number' => (string) ($profile['id_number'] ?? ''),
    'date_of_birth' => (string) ($profile['date_of_birth'] ?? ''),
];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $token = (string) ($_POST['csrf_token'] ?? '');
    if (!verify_csrf_token($token)) {
        $errors[] = 'Invalid CSRF token.';
    }

    foreach ($fields as $key => $_) {
        $fields[$key] = post_string($key, $key === 'address_line2' || $key === 'company' || $key === 'id_number' ? 255 : 120);
    }

    if ($fields['full_name'] === '') {
        $errors[] = 'Full name is required.';
    }
    if ($fields['phone'] === '') {
        $errors[] = 'Phone number is required.';
    }
    if ($fields['country'] === '') {
        $errors[] = 'Country is required.';
    }
    if ($fields['city'] === '') {
        $errors[] = 'City is required.';
    }
    if ($fields['address_line1'] === '') {
        $errors[] = 'Address line 1 is required.';
    }

    if ($fields['date_of_birth'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fields['date_of_birth'])) {
        $errors[] = 'Date of birth must use YYYY-MM-DD format.';
    }

    if (!$errors) {
        $upsert = $pdo->prepare(
            'INSERT INTO customer_profiles (user_id, full_name, phone, country, city, address_line1, address_line2, company, id_type, id_number, date_of_birth, created_at, updated_at)
             VALUES (:user_id, :full_name, :phone, :country, :city, :address_line1, :address_line2, :company, :id_type, :id_number, :date_of_birth, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                full_name = VALUES(full_name),
                phone = VALUES(phone),
                country = VALUES(country),
                city = VALUES(city),
                address_line1 = VALUES(address_line1),
                address_line2 = VALUES(address_line2),
                company = VALUES(company),
                id_type = VALUES(id_type),
                id_number = VALUES(id_number),
                date_of_birth = VALUES(date_of_birth),
                updated_at = NOW()'
        );
        $upsert->execute([
            ':user_id' => $userId,
            ':full_name' => $fields['full_name'],
            ':phone' => $fields['phone'],
            ':country' => $fields['country'],
            ':city' => $fields['city'],
            ':address_line1' => $fields['address_line1'],
            ':address_line2' => $fields['address_line2'] ?: null,
            ':company' => $fields['company'] ?: null,
            ':id_type' => $fields['id_type'] ?: null,
            ':id_number' => $fields['id_number'] ?: null,
            ':date_of_birth' => $fields['date_of_birth'] ?: null,
        ]);

        log_security_event('profile_updated', $userId);
        $success = true;
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Customer Profile - <?= e(APP_NAME) ?></title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; margin: 0; }
    .container { max-width: 760px; margin: 30px auto; background: #fff; padding: 24px; border-radius: 10px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .full { grid-column: span 2; }
    input, button { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
    button { background: #059669; border: none; color: #fff; font-weight: 700; }
    .error { color: #b91c1c; }
    .success { color: #065f46; }
    @media (max-width: 680px) { .grid { grid-template-columns: 1fr; } .full { grid-column: span 1; } }
  </style>
</head>
<body>
<div class="container">
  <h1>Customer Profile (KYC-lite)</h1>
  <p>Please complete this to proceed to the dApp.</p>

  <?php if ($success): ?><p class="success">Profile saved. <a href="/launch.php">Launch dApp</a></p><?php endif; ?>
  <?php foreach ($errors as $error): ?><p class="error">• <?= e($error) ?></p><?php endforeach; ?>

  <form method="post" action="/profile.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
    <div class="grid">
      <div class="full"><label>Full name</label><input name="full_name" required value="<?= e($fields['full_name']) ?>"></div>
      <div><label>Phone</label><input name="phone" required value="<?= e($fields['phone']) ?>"></div>
      <div><label>Country</label><input name="country" required value="<?= e($fields['country']) ?>"></div>
      <div><label>City</label><input name="city" required value="<?= e($fields['city']) ?>"></div>
      <div class="full"><label>Address line 1</label><input name="address_line1" required value="<?= e($fields['address_line1']) ?>"></div>
      <div class="full"><label>Address line 2 (optional)</label><input name="address_line2" value="<?= e($fields['address_line2']) ?>"></div>
      <div><label>Company (optional)</label><input name="company" value="<?= e($fields['company']) ?>"></div>
      <div><label>ID type (optional)</label><input name="id_type" value="<?= e($fields['id_type']) ?>"></div>
      <div><label>ID number (optional)</label><input name="id_number" value="<?= e($fields['id_number']) ?>"></div>
      <div><label>Date of birth (optional, YYYY-MM-DD)</label><input name="date_of_birth" value="<?= e($fields['date_of_birth']) ?>"></div>
      <div class="full"><button type="submit">Save profile</button></div>
    </div>
  </form>

  <p><a href="/auth/logout.php">Logout</a></p>
</div>
</body>
</html>
