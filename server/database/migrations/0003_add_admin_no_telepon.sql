ALTER TABLE `admins` ADD COLUMN `no_telepon` varchar(30) DEFAULT NULL AFTER `email`;
UPDATE `admins` SET `no_telepon` = '6285156549003' WHERE `no_telepon` IS NULL;

