-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.11.16-MariaDB - MariaDB Server
-- Server OS:                    Win64
-- HeidiSQL Version:             12.22.0.7382
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for truckqueue_db
DROP DATABASE IF EXISTS `truckqueue_db`;
CREATE DATABASE IF NOT EXISTS `truckqueue_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `truckqueue_db`;

-- Dumping structure for table truckqueue_db.company
DROP TABLE IF EXISTS `company`;
CREATE TABLE IF NOT EXISTS `company` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_name` (`company_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table truckqueue_db.company: ~3 rows (approximately)
DELETE FROM `company`;
INSERT INTO `company` (`id`, `company_name`, `is_active`) VALUES
	(1, 'TT', 1),
	(2, 'PET', 1),
	(3, 'NK', 1);

-- Dumping structure for table truckqueue_db.destination
DROP TABLE IF EXISTS `destination`;
CREATE TABLE IF NOT EXISTS `destination` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `destination` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_destination` (`destination`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table truckqueue_db.destination: ~4 rows (approximately)
DELETE FROM `destination`;
INSERT INTO `destination` (`id`, `destination`, `is_active`) VALUES
	(1, 'ไม่ระบุ', 1),
	(2, 'VR', 1),
	(3, 'TW', 1),
	(4, 'SBK', 1);

-- Dumping structure for table truckqueue_db.dock
DROP TABLE IF EXISTS `dock`;
CREATE TABLE IF NOT EXISTS `dock` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dock_name` varchar(50) NOT NULL,
  `std_minutes` smallint(6) NOT NULL DEFAULT 40,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table truckqueue_db.dock: ~3 rows (approximately)
DELETE FROM `dock`;
INSERT INTO `dock` (`id`, `dock_name`, `std_minutes`, `is_active`, `sort_order`) VALUES
	(1, 'จุดรับสินค้า 1', 35, 1, 1),
	(2, 'จุดรับสินค้า 2', 50, 1, 2),
	(3, 'จุดรับสินค้า 3', 25, 1, 3);

-- Dumping structure for table truckqueue_db.driver
DROP TABLE IF EXISTS `driver`;
CREATE TABLE IF NOT EXISTS `driver` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `company` bigint(20) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_visit_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_driver_phone` (`phone`),
  KEY `company_fk` (`company`),
  CONSTRAINT `company_fk` FOREIGN KEY (`company`) REFERENCES `company` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table truckqueue_db.driver: ~1 rows (approximately)
DELETE FROM `driver`;
INSERT INTO `driver` (`id`, `first_name`, `last_name`, `company`, `phone`, `status`, `created_at`, `last_visit_at`) VALUES
	(1, 'ณัฐวุฒิ', 'ประสงค์', 3, '0637809503', 'active', '2026-11-12 06:55:09', '2026-11-12 16:10:45');

-- Dumping structure for table truckqueue_db.queue
DROP TABLE IF EXISTS `queue`;
CREATE TABLE IF NOT EXISTS `queue` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue_date` date NOT NULL,
  `queue_no` varchar(10) DEFAULT NULL,
  `access_token` char(32) NOT NULL,
  `driver_id` bigint(20) unsigned NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `company_id` bigint(20) NOT NULL,
  `plate_no` varchar(30) NOT NULL,
  `trailer_plate` varchar(30) NOT NULL,
  `destination_id` bigint(20) NOT NULL,
  `dock_id` int(11) DEFAULT NULL,
  `status` enum('waiting','called','loading','done','exited','cancelled') NOT NULL DEFAULT 'waiting',
  `sort_order` datetime(3) NOT NULL,
  `skip_count` smallint(6) NOT NULL DEFAULT 0,
  `registered_at` datetime(3) NOT NULL,
  `called_at` datetime(3) DEFAULT NULL,
  `loading_started_at` datetime(3) DEFAULT NULL,
  `loading_finished_at` datetime(3) DEFAULT NULL,
  `exited_at` datetime(3) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_queue_no` (`queue_no`),
  KEY `idx_queue_day_status` (`queue_date`,`status`,`sort_order`),
  KEY `idx_queue_dock_day` (`dock_id`,`queue_date`),
  KEY `idx_queue_company_day` (`company_id`,`queue_date`),
  KEY `fk_queue_driver` (`driver_id`),
  KEY `idx_queue_status` (`status`,`sort_order`),
  KEY `idx_queue_destination` (`destination_id`,`queue_date`),
  CONSTRAINT `fk_queue_company` FOREIGN KEY (`company_id`) REFERENCES `company` (`id`),
  CONSTRAINT `fk_queue_destination` FOREIGN KEY (`destination_id`) REFERENCES `destination` (`id`),
  CONSTRAINT `fk_queue_dock` FOREIGN KEY (`dock_id`) REFERENCES `dock` (`id`),
  CONSTRAINT `fk_queue_driver` FOREIGN KEY (`driver_id`) REFERENCES `driver` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table truckqueue_db.queue: ~5 rows (approximately)
DELETE FROM `queue`;
INSERT INTO `queue` (`id`, `queue_date`, `queue_no`, `access_token`, `driver_id`, `first_name`, `last_name`, `phone`, `company_id`, `plate_no`, `trailer_plate`, `destination_id`, `dock_id`, `status`, `sort_order`, `skip_count`, `registered_at`, `called_at`, `loading_started_at`, `loading_finished_at`, `exited_at`, `note`, `updated_at`) VALUES
	(1, '2026-11-12', '0001', '83057b821586896046569141dec76a51', 1, 'ณัฐวุฒิ', 'ประสงค์', '0637809503', 3, '71-0000', '70-1111', 1, 1, 'exited', '2026-11-12 13:55:09.710', 0, '2026-11-12 13:55:09.710', '2026-11-12 13:55:40.499', '2026-11-12 13:58:23.498', '2026-11-12 13:58:28.834', '2026-11-12 13:59:02.319', NULL, '2026-11-12 13:59:02'),
	(2, '2026-11-12', '0002', '82b30cb6de511be316f25729cf27bf03', 1, 'ณัฐวุฒิ', 'ประสงค์', '0637809503', 3, '70', '70', 2, 1, 'exited', '2026-11-12 14:31:12.008', 0, '2026-11-12 14:31:12.008', '2026-11-12 14:41:40.876', '2026-11-12 14:45:11.641', '2026-11-12 14:45:13.609', '2026-11-12 15:21:30.971', NULL, '2026-11-12 15:21:30'),
	(3, '2026-11-12', '0003', '76e9cd3148610dc7f60c7f7b7f41523f', 1, 'ณัฐวุฒิ', 'ประสงค์', '0637809503', 3, '80', '80', 1, 1, 'exited', '2026-11-12 14:46:49.084', 0, '2026-11-12 14:46:49.084', '2026-11-12 15:00:58.774', '2026-11-12 15:01:01.570', '2026-11-12 15:01:09.594', '2026-11-12 15:21:31.627', NULL, '2026-11-12 15:21:31'),
	(4, '2026-11-12', '0004', 'e4f2e1f2cc11bd7ce34e2282e24ad6f1', 1, 'ณัฐวุฒิ', 'ประสงค์', '0637809503', 3, '70-1234', '70-4321', 1, NULL, 'cancelled', '2026-11-12 16:10:13.935', 0, '2026-11-12 16:10:13.935', NULL, NULL, NULL, NULL, NULL, '2026-11-12 16:10:21'),
	(5, '2026-11-12', '0005', 'fbfc01195d9829a7c7540bc9caaa308f', 1, 'ณัฐวุฒิ', 'ประสงค์', '0637809503', 3, '40-1234', '70-1234', 2, 1, 'exited', '2026-11-12 16:10:45.663', 0, '2026-11-12 16:10:45.663', '2026-11-12 16:11:01.564', '2026-11-12 16:11:51.941', '2026-11-12 16:29:08.822', '2026-11-12 16:29:10.653', NULL, '2026-11-12 16:29:10');

-- Dumping structure for table truckqueue_db.queue_event
DROP TABLE IF EXISTS `queue_event`;
CREATE TABLE IF NOT EXISTS `queue_event` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue_id` bigint(20) unsigned NOT NULL,
  `action` enum('register','call','recall','start','finish','exit','skip','cancel','edit') NOT NULL,
  `dock_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `meta` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `idx_event_queue` (`queue_id`),
  CONSTRAINT `fk_event_queue` FOREIGN KEY (`queue_id`) REFERENCES `queue` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table truckqueue_db.queue_event: ~22 rows (approximately)
DELETE FROM `queue_event`;
INSERT INTO `queue_event` (`id`, `queue_id`, `action`, `dock_id`, `user_id`, `meta`, `created_at`) VALUES
	(1, 1, 'register', NULL, NULL, '{"source":"driver"}', '2026-11-12 13:55:09.711'),
	(2, 1, 'call', 1, NULL, NULL, '2026-11-12 13:55:40.500'),
	(3, 1, 'start', 1, NULL, NULL, '2026-11-12 13:58:23.499'),
	(4, 1, 'finish', 1, NULL, NULL, '2026-11-12 13:58:28.834'),
	(5, 1, 'exit', 1, NULL, NULL, '2026-11-12 13:59:02.319'),
	(6, 2, 'register', NULL, NULL, '{"source":"driver"}', '2026-11-12 14:31:12.009'),
	(7, 2, 'call', 1, NULL, NULL, '2026-11-12 14:41:40.876'),
	(8, 2, 'start', 1, NULL, NULL, '2026-11-12 14:45:11.641'),
	(9, 2, 'finish', 1, NULL, NULL, '2026-11-12 14:45:13.609'),
	(10, 3, 'register', NULL, NULL, '{"source":"staff"}', '2026-11-12 14:46:49.084'),
	(11, 3, 'call', 1, NULL, NULL, '2026-11-12 15:00:58.774'),
	(12, 3, 'start', 1, NULL, NULL, '2026-11-12 15:01:01.571'),
	(13, 3, 'finish', 1, NULL, NULL, '2026-11-12 15:01:09.594'),
	(14, 2, 'exit', 1, NULL, NULL, '2026-11-12 15:21:30.971'),
	(15, 3, 'exit', 1, NULL, NULL, '2026-11-12 15:21:31.627'),
	(16, 4, 'register', NULL, NULL, '{"source":"driver"}', '2026-11-12 16:10:13.936'),
	(17, 4, 'cancel', NULL, NULL, NULL, '2026-11-12 16:10:21.882'),
	(18, 5, 'register', NULL, NULL, '{"source":"driver"}', '2026-11-12 16:10:45.664'),
	(19, 5, 'call', 1, NULL, NULL, '2026-11-12 16:11:01.565'),
	(20, 5, 'start', 1, NULL, NULL, '2026-11-12 16:11:51.941'),
	(21, 5, 'finish', 1, NULL, NULL, '2026-11-12 16:29:08.823'),
	(22, 5, 'exit', 1, NULL, NULL, '2026-11-12 16:29:10.653');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
