-- Add avatar and display handle to ambassador_applications
ALTER TABLE ambassador_applications
  ADD COLUMN avatarUrl TEXT NULL,
  ADD COLUMN displayHandle VARCHAR(255) NULL;

-- Journal entries table for personal planning and accountability
CREATE TABLE IF NOT EXISTS journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicationId INT NOT NULL,
  entryType ENUM('plan','journal') NOT NULL DEFAULT 'journal',
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (applicationId) REFERENCES ambassador_applications(id) ON DELETE CASCADE
);
