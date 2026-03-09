CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  status ENUM('active','pending','suspended') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status (status),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  country VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  company VARCHAR(120) NULL,
  id_type VARCHAR(40) NULL,
  id_number VARCHAR(120) NULL,
  date_of_birth DATE NULL,
  wallet_address VARCHAR(120) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY idx_profiles_country_city (country, city),
  KEY idx_profiles_wallet_address (wallet_address),
  CONSTRAINT fk_customer_profiles_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  identifier_hash CHAR(64) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  window_start DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_auth_rate_limit (action, ip_address, identifier_hash),
  KEY idx_auth_rate_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL,
  KEY idx_security_events_user_created (user_id, created_at),
  KEY idx_security_events_event_created (event_type, created_at),
  CONSTRAINT fk_security_events_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
