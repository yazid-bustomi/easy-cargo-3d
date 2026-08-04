-- =====================================================================
-- Container Loading Planner 3D — Database Schema (MySQL 8.0+)
-- =====================================================================
CREATE DATABASE IF NOT EXISTS container_planner
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE container_planner;

-- ---------------------------------------------------------------------
-- USERS & AUTH
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','planner','viewer') NOT NULL DEFAULT 'planner',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked     TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- CONTAINER TYPES (master: 20', 40', 40'HC + custom)
-- ---------------------------------------------------------------------
CREATE TABLE container_types (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(50) NOT NULL UNIQUE,          -- e.g. CONT20, CONT40, CONT40HC, CUSTOM-xxx
  name            VARCHAR(150) NOT NULL,                -- e.g. "Container 20'"
  length_cm       DECIMAL(10,2) NOT NULL,
  width_cm        DECIMAL(10,2) NOT NULL,
  height_cm       DECIMAL(10,2) NOT NULL,
  max_payload_kg  DECIMAL(12,2) NOT NULL DEFAULT 0,      -- max weight capacity
  tare_weight_kg  DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_system       TINYINT(1) NOT NULL DEFAULT 0,         -- 1 = built-in (20/40/40HC), cannot delete
  is_custom       TINYINT(1) NOT NULL DEFAULT 0,
  created_by      INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Seed the 3 built-in container sizes (values from spec)
INSERT INTO container_types
  (code, name, length_cm, width_cm, height_cm, max_payload_kg, tare_weight_kg, is_system, is_custom)
VALUES
  ('CONT20',   "Container 20'",          580.0,  235.2, 238.5, 28180, 2300, 1, 0),
  ('CONT40',   "Container 40'",          1203.2, 235.2, 238.5, 28800, 3800, 1, 0),
  ('CONT40HC', "Container 40' HC (Safe)",1200.0, 233.0, 268.2, 28560, 3900, 1, 0);

-- ---------------------------------------------------------------------
-- PRODUCT GROUPS (color-coded groups shown on planning page)
-- ---------------------------------------------------------------------
CREATE TABLE product_groups (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  color_hex   VARCHAR(9) NOT NULL DEFAULT '#3B82F6',
  is_collapsed TINYINT(1) NOT NULL DEFAULT 0,
  sort_order  INT NOT NULL DEFAULT 0,
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PRODUCTS (master product, optionally synced from Odoo)
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id           INT UNSIGNED NULL,
  sku                VARCHAR(100) NOT NULL UNIQUE,
  name               VARCHAR(255) NOT NULL,
  length_cm          DECIMAL(10,2) NOT NULL,
  width_cm           DECIMAL(10,2) NOT NULL,
  height_cm          DECIMAL(10,2) NOT NULL,
  weight_kg          DECIMAL(10,3) NOT NULL DEFAULT 0,
  qty                INT NOT NULL DEFAULT 0,
  this_side_up       TINYINT(1) NOT NULL DEFAULT 0,
  rotation_allowed   TINYINT(1) NOT NULL DEFAULT 1,   -- allowed to rotate on horizontal plane
  stackable          TINYINT(1) NOT NULL DEFAULT 1,
  max_stack          INT NOT NULL DEFAULT 1,          -- max items stacked on top of this one
  color_hex          VARCHAR(9) NOT NULL DEFAULT '#F59E0B',
  notes              TEXT NULL,
  -- Odoo integration fields
  odoo_product_id    INT NULL,
  odoo_sale_order_id INT NULL,
  odoo_last_sync_at  DATETIME NULL,
  source             ENUM('manual','odoo') NOT NULL DEFAULT 'manual',
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  created_by         INT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES product_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_products_group (group_id),
  INDEX idx_products_odoo (odoo_product_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- LAYOUTS (a saved "planning session" for one container)
-- ---------------------------------------------------------------------
CREATE TABLE layouts (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  container_type_id INT UNSIGNED NOT NULL,
  odoo_sale_order_id INT NULL,
  status            ENUM('draft','confirmed','archived') NOT NULL DEFAULT 'draft',
  total_weight_kg   DECIMAL(12,3) NOT NULL DEFAULT 0,
  used_volume_cm3   DECIMAL(20,2) NOT NULL DEFAULT 0,
  item_count        INT NOT NULL DEFAULT 0,
  created_by        INT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (container_type_id) REFERENCES container_types(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- LAYOUT ITEMS (each placed product instance: position + rotation)
-- ---------------------------------------------------------------------
CREATE TABLE layout_items (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  layout_id     INT UNSIGNED NOT NULL,
  product_id    INT UNSIGNED NOT NULL,
  instance_no   INT NOT NULL DEFAULT 1,      -- which unit of the product's qty (1..qty)
  pos_x         DECIMAL(10,3) NOT NULL DEFAULT 0,   -- cm, from container origin (corner)
  pos_y         DECIMAL(10,3) NOT NULL DEFAULT 0,   -- height axis
  pos_z         DECIMAL(10,3) NOT NULL DEFAULT 0,
  rot_x         SMALLINT NOT NULL DEFAULT 0,        -- degrees, 0/90/180/270
  rot_y         SMALLINT NOT NULL DEFAULT 0,
  rot_z         SMALLINT NOT NULL DEFAULT 0,
  stack_level   INT NOT NULL DEFAULT 0,             -- 0 = on floor
  is_valid      TINYINT(1) NOT NULL DEFAULT 1,      -- passed collision/boundary validation
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_layout_items_layout (layout_id),
  INDEX idx_layout_items_product (product_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- LAYOUT HISTORY (undo/redo persisted snapshots, optional server-side)
-- ---------------------------------------------------------------------
CREATE TABLE layout_history (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  layout_id   INT UNSIGNED NOT NULL,
  snapshot    JSON NOT NULL,          -- full serialized layout_items state
  action_type VARCHAR(50) NOT NULL,   -- auto_insert, move, rotate, delete, reset, import...
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- AUDIT LOG (simple activity trail)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   INT UNSIGNED NULL,
  action      VARCHAR(50) NOT NULL,
  details     JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- ODOO SYNC LOG (future integration bookkeeping)
-- ---------------------------------------------------------------------
CREATE TABLE odoo_sync_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_type    ENUM('product','sale_order') NOT NULL,
  direction    ENUM('pull','push') NOT NULL,
  status       ENUM('success','failed') NOT NULL,
  message      TEXT NULL,
  record_count INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default admin user is created by backend seeder (see backend/src/utils/seed.js)
-- so the password is properly bcrypt-hashed rather than hardcoded here.