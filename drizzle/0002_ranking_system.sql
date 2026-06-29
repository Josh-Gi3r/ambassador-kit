-- Add gamified ranking and scoring columns to ambassador_applications
ALTER TABLE `ambassador_applications`
  ADD COLUMN `level` int NOT NULL DEFAULT 0,
  ADD COLUMN `evangelistCandidate` int NOT NULL DEFAULT 0,
  ADD COLUMN `xContentScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `xEngagementScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `xConsistencyScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `communityContribScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `tgActivityScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `adminOverrideScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `totalScore` float NOT NULL DEFAULT 0,
  ADD COLUMN `scoreTrend` int NOT NULL DEFAULT 0,
  ADD COLUMN `weeklyScores` json,
  ADD COLUMN `badges` json,
  ADD COLUMN `scoreUpdatedAt` timestamp;
