-- AI Studio: per-ambassador LiteLLM key + denormalized AI tier
ALTER TABLE ambassador_applications
  ADD COLUMN litellm_key VARCHAR(128) NULL,
  ADD COLUMN litellm_key_issued_at TIMESTAMP NULL,
  ADD COLUMN ai_tier ENUM('none','starter','active','elite') NOT NULL DEFAULT 'none';

-- Async AI video generation jobs
CREATE TABLE IF NOT EXISTS ai_video_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicationId INT NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_job_id VARCHAR(256) NULL,
  model VARCHAR(128) NOT NULL,
  prompt TEXT NOT NULL,
  status ENUM('processing','complete','failed') NOT NULL DEFAULT 'processing',
  result_url TEXT NULL,
  error_message TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (applicationId) REFERENCES ambassador_applications(id) ON DELETE CASCADE
);
