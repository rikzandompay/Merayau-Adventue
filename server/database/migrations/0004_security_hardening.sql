ALTER TABLE `admins` ADD COLUMN `token_version` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `role`;

CREATE TABLE IF NOT EXISTS `security_audit_logs` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `event_type` VARCHAR(80) NOT NULL,
  `severity` ENUM('info', 'warn', 'critical') NOT NULL DEFAULT 'info',
  `admin_id` INT NULL,
  `actor_email` VARCHAR(160) NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `target_type` VARCHAR(60) NULL,
  `target_id` VARCHAR(64) NULL,
  `metadata_json` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_security_audit_created` (`created_at`),
  INDEX `idx_security_audit_event_created` (`event_type`, `created_at`),
  INDEX `idx_security_audit_severity_created` (`severity`, `created_at`),
  CONSTRAINT `fk_security_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL
);

