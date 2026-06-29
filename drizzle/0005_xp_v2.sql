-- XP v2.0: unlimited lifetime accumulation, tiers, Solitaire, security

ALTER TABLE ambassador_applications
  MODIFY COLUMN litellm_key VARCHAR(256) NULL,
  ADD COLUMN lifetime_xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN xp_tier ENUM('starter','active','champion','elite') NOT NULL DEFAULT 'starter',
  ADD COLUMN is_solitaire TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN fraud_flag TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN claim_pending TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN account_age_days INT NULL;

-- Async AI video jobs: queued state + start frame / duration / resolution
ALTER TABLE ai_video_jobs
  ADD COLUMN start_frame_url TEXT NULL,
  ADD COLUMN duration INT NULL,
  ADD COLUMN resolution VARCHAR(16) NULL,
  MODIFY COLUMN status ENUM('queued','processing','complete','failed') NOT NULL DEFAULT 'queued';

-- Program configuration and milestone latches (e.g. solitaire_closed)
CREATE TABLE IF NOT EXISTS program_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(128) NOT NULL UNIQUE,
  value TEXT NULL,
  closed_at TIMESTAMP NULL,
  community_total_at_close BIGINT NULL,
  solitaire_count INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
