-- AI Studio spend budget table — N2.
-- Atomically tracks per-month dollar usage for text + image generation
-- so the existing video-second cap pattern extends to all paid modalities.
CREATE TABLE IF NOT EXISTS `ai_spend_month` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `application_id` int NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `modality` varchar(8) NOT NULL,
  `dollars_used` float NOT NULL DEFAULT 0,
  `dollars_cap` float NOT NULL,
  `updated_at` bigint NOT NULL,
  UNIQUE KEY `uk_app_month_modality` (`application_id`, `year`, `month`, `modality`),
  KEY `ix_app_month` (`application_id`, `year`, `month`)
);
