-- AI Studio v5 migration
-- Model registry, generation log, and monthly video-second spend tracking

CREATE TABLE IF NOT EXISTS `ai_models` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tier` varchar(16) NOT NULL,
  `modality` varchar(8) NOT NULL,
  `name` varchar(128) NOT NULL,
  `provider` varchar(32) NOT NULL,
  `price_per_unit` float NOT NULL,
  `price_basis` varchar(32) NOT NULL,
  `why` varchar(255) NOT NULL DEFAULT '',
  `routing_id` varchar(255) NOT NULL DEFAULT '',
  `is_active` int NOT NULL DEFAULT 1,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS `ai_generation_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `application_id` int NOT NULL,
  `model_id` int NOT NULL,
  `modality` varchar(8) NOT NULL,
  `provider` varchar(32) NOT NULL,
  `prompt` text NOT NULL,
  `output_url` text,
  `output_text` text,
  `video_seconds` float,
  `cost_usd` float NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `error_message` text,
  `created_at` bigint NOT NULL,
  `completed_at` bigint,
  INDEX `idx_gen_app` (`application_id`),
  INDEX `idx_gen_created` (`created_at`)
);

CREATE TABLE IF NOT EXISTS `ai_video_spend` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `application_id` int NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `seconds_used` float NOT NULL DEFAULT 0,
  `cap_seconds` int NOT NULL,
  `alert_80_sent` int NOT NULL DEFAULT 0,
  `alert_95_sent` int NOT NULL DEFAULT 0,
  `alert_100_sent` int NOT NULL DEFAULT 0,
  `updated_at` bigint NOT NULL,
  UNIQUE KEY `uq_spend_month` (`application_id`, `year`, `month`)
);
