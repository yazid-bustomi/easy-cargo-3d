-- =====================================================================
-- Easy Cargo 3D — Projects Table (Save & Auto-Save)
-- Run this in phpMyAdmin after creating the database
-- =====================================================================
CREATE DATABASE IF NOT EXISTS `easy-cargo`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `easy-cargo`;

CREATE TABLE IF NOT EXISTS `projects` (
  `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`              VARCHAR(255) NOT NULL,
  -- Container config
  `container_code`    VARCHAR(50) NOT NULL DEFAULT '',
  `container_name`    VARCHAR(150) NOT NULL DEFAULT '',
  `container_length`  DECIMAL(10,2) NOT NULL DEFAULT 0,
  `container_width`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `container_height`  DECIMAL(10,2) NOT NULL DEFAULT 0,
  `container_max_payload_kg` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `container_tare_weight_kg` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `container_is_system` TINYINT(1) NOT NULL DEFAULT 0,
  -- Snapshot data (full Zustand state as JSON)
  `products_json`     JSON NOT NULL,
  `layout_items_json` JSON NOT NULL,
  -- Stats (denormalized for quick listing)
  `item_count`        INT NOT NULL DEFAULT 0,
  `total_weight_kg`   DECIMAL(12,3) NOT NULL DEFAULT 0,
  `volume_percent`    DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Timestamps
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
