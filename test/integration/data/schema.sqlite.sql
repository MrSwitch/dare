-- SQLite schema for dare integration tests

CREATE TABLE `users` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `uuid` BLOB DEFAULT NULL,
  `username` TEXT NOT NULL,
  `first_name` TEXT DEFAULT NULL,
  `last_name` TEXT DEFAULT NULL,
  `secret` TEXT DEFAULT NULL,
  `settings` TEXT DEFAULT NULL,
  `country_id` INTEGER DEFAULT NULL,
  UNIQUE(`username`),
  FOREIGN KEY (`country_id`) REFERENCES `country` (`id`)
);

CREATE TABLE users_email (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER NOT NULL,
  `email` TEXT NOT NULL,
  UNIQUE(`email`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

CREATE TABLE `teams` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` TEXT NOT NULL,
  `description` TEXT NULL,
  UNIQUE(`name`)
);

CREATE TABLE `userTeams` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER NOT NULL,
  `team_id` INTEGER NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)
);

CREATE TABLE `country` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `code` TEXT NOT NULL,
  `created_time` INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Stub content table for test compatibility
CREATE TABLE `content` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `title` TEXT
);

-- Stub userContent table for test compatibility
CREATE TABLE `userContent` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` INTEGER,
  `content_id` INTEGER,
  `status` TEXT,
  `domain_id` INTEGER,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`content_id`) REFERENCES `content` (`id`)
);

-- Create indexes
CREATE INDEX `idx_users_country_id` ON `users` (`country_id`);
CREATE INDEX `idx_users_email_user_id` ON `users_email` (`user_id`);
CREATE INDEX `idx_userTeams_user_id` ON `userTeams` (`user_id`);
CREATE INDEX `idx_userTeams_team_id` ON `userTeams` (`team_id`);
