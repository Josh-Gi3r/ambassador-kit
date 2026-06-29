-- Build Bible v1.2: per-action XP ledger, requalifying tiers, founding tier.
-- NOTE: lifetime_xp already exists from migration 0005 (XP v2.0) and is
-- REUSED as the cached SUM(xp_events.xp_amount). It is NOT re-added here.

ALTER TABLE ambassador_applications
  ADD COLUMN xp_30day INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN xp_90day INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN current_tier ENUM('initiate','active','champion','elite') NOT NULL DEFAULT 'initiate',
  ADD COLUMN tier_step_down_at TIMESTAMP NULL,
  ADD COLUMN is_founding TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN evangelist_granted_at TIMESTAMP NULL,
  ADD COLUMN evangelist_step_back_at TIMESTAMP NULL;

-- The append-only XP event ledger. Lifetime XP is SUM(xp_amount).
CREATE TABLE IF NOT EXISTS xp_events (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  application_id  INT NOT NULL,
  event_type      VARCHAR(64) NOT NULL,
  xp_amount       INT NOT NULL,
  source          VARCHAR(32) NOT NULL,
  source_ref      VARCHAR(256) NULL,
  awarded_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dedupe (event_type, source_ref),
  INDEX idx_app_time (application_id, awarded_at)
);

-- Founding-tier config + closure latch (single row).
CREATE TABLE IF NOT EXISTS founding_config (
  id                   INT PRIMARY KEY DEFAULT 1,
  collective_threshold BIGINT NOT NULL DEFAULT 5000000,
  seat_cap             INT    NOT NULL DEFAULT 100,
  individual_floor     INT    NOT NULL DEFAULT 2000,
  closed_at            TIMESTAMP NULL,
  seats_filled         INT NOT NULL DEFAULT 0
);
INSERT INTO founding_config (id) VALUES (1)
  ON DUPLICATE KEY UPDATE id = id;
