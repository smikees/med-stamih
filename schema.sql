-- med.stamih.com "Alongside" — schema (MySQL 8 / MariaDB, InnoDB, utf8mb4).
-- Idempotent (IF NOT EXISTS). Run via install.php?key=... or phpMyAdmin.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) DEFAULT NULL,
  avatar      VARCHAR(512) DEFAULT NULL,
  google_sub  VARCHAR(64)  DEFAULT NULL,
  pass_hash   VARCHAR(255) DEFAULT NULL,          -- null = Google-only account
  is_admin    TINYINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY k_google (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  relation    VARCHAR(120) DEFAULT NULL,
  tint        VARCHAR(32)  DEFAULT NULL,          -- a color-ramp css var name
  avatar_url  VARCHAR(512) DEFAULT NULL,
  timezone    VARCHAR(64)  NOT NULL DEFAULT 'Europe/Bucharest',
  created_by  INT          DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY k_creator (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- account <-> profile sharing (many-to-many)
CREATE TABLE IF NOT EXISTS profile_members (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT NOT NULL,
  user_id     INT NOT NULL,
  role        ENUM('owner','editor') NOT NULL DEFAULT 'editor',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pm (profile_id, user_id),
  KEY k_user (user_id),
  CONSTRAINT fk_pm_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT NOT NULL,
  type        ENUM('pill','activity') NOT NULL DEFAULT 'pill',
  name        VARCHAR(200) NOT NULL,
  count       INT NOT NULL DEFAULT 1,
  grp         ENUM('morning','noon','evening','bedtime') NOT NULL DEFAULT 'morning',
  time_min    INT NOT NULL DEFAULT 480,           -- minutes since midnight
  purpose     VARCHAR(200) DEFAULT NULL,
  note        VARCHAR(300) DEFAULT NULL,
  photo_url   VARCHAR(512) DEFAULT NULL,
  freq        ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily',
  days        VARCHAR(32)  DEFAULT NULL,          -- JSON array of weekday ints 0-6
  dom         INT DEFAULT NULL,                   -- day-of-month 1-31
  end_mode    ENUM('never','date','count') NOT NULL DEFAULT 'never',
  end_date    DATE DEFAULT NULL,
  end_count   INT  DEFAULT NULL,
  start_date  DATE NOT NULL,
  active      TINYINT NOT NULL DEFAULT 1,
  created_by  INT DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY k_profile (profile_id),
  CONSTRAINT fk_item_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  profile_id     INT NOT NULL,
  item_id        INT NOT NULL,
  d              DATE NOT NULL,                    -- the scheduled day
  status         ENUM('taken','skipped') NOT NULL,
  taken_min      INT DEFAULT NULL,                 -- recorded intake time (mins since midnight)
  at_epoch       BIGINT DEFAULT NULL,             -- when the log was written (ms)
  actor_user_id  INT DEFAULT NULL,               -- who logged it (audit); null = via messaging
  note           VARCHAR(300) DEFAULT NULL,       -- e.g. blood-pressure reading
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_log (profile_id, item_id, d),
  KEY k_profile_date (profile_id, d),
  CONSTRAINT fk_log_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS day_notes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  profile_id     INT NOT NULL,
  d              DATE NOT NULL,
  note           TEXT,
  actor_user_id  INT DEFAULT NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daynote (profile_id, d),
  CONSTRAINT fk_dn_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS channels (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT NOT NULL,
  kind        ENUM('telegram','whatsapp','webpush') NOT NULL,
  address     VARCHAR(512) NOT NULL,               -- chat_id / phone / push subscription
  label       VARCHAR(120) DEFAULT NULL,
  verified    TINYINT NOT NULL DEFAULT 0,
  link_token  VARCHAR(64) DEFAULT NULL,            -- one-time token for deep-link linking
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY k_profile (profile_id),
  KEY k_addr (kind, address(191)),
  CONSTRAINT fk_ch_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notif_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  profile_id      INT NOT NULL,
  item_id         INT DEFAULT NULL,
  d               DATE NOT NULL,
  channel_id      INT DEFAULT NULL,
  kind            ENUM('due','overdue','summary') NOT NULL,
  sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  provider_msg_id VARCHAR(128) DEFAULT NULL,
  response        ENUM('taken','skipped') DEFAULT NULL,
  UNIQUE KEY uq_notif (profile_id, item_id, d, kind),
  KEY k_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 'snooze' recorded on the due row when the user taps Amână (idempotent to re-run).
ALTER TABLE notif_log MODIFY response ENUM('taken','skipped','snooze') DEFAULT NULL;
