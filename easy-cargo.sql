-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 14 Agu 2026 pada 09.19
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `easy-cargo`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `container_types`
--

CREATE TABLE `container_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `length_cm` decimal(10,2) NOT NULL,
  `width_cm` decimal(10,2) NOT NULL,
  `height_cm` decimal(10,2) NOT NULL,
  `max_payload_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tare_weight_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_custom` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `container_types`
--

INSERT INTO `container_types` (`id`, `code`, `name`, `length_cm`, `width_cm`, `height_cm`, `max_payload_kg`, `tare_weight_kg`, `is_system`, `is_custom`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'CONT20', 'Container 20\'', 580.00, 235.20, 238.50, 28180.00, 2300.00, 1, 0, NULL, '2026-08-03 13:52:19', '2026-08-03 13:52:19'),
(2, 'CONT40', 'Container 40\'', 1203.20, 235.20, 238.50, 28800.00, 3800.00, 1, 0, NULL, '2026-08-03 13:52:19', '2026-08-03 13:52:19'),
(3, 'CONT40HC', 'Container 40\' HC (Safe)', 1200.00, 233.00, 268.20, 28560.00, 3900.00, 1, 0, NULL, '2026-08-03 13:52:19', '2026-08-03 13:52:19');

-- --------------------------------------------------------

--
-- Struktur dari tabel `layouts`
--

CREATE TABLE `layouts` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `container_type_id` int(10) UNSIGNED NOT NULL,
  `odoo_sale_order_id` int(11) DEFAULT NULL,
  `status` enum('draft','confirmed','archived') NOT NULL DEFAULT 'draft',
  `total_weight_kg` decimal(12,3) NOT NULL DEFAULT 0.000,
  `used_volume_cm3` decimal(20,2) NOT NULL DEFAULT 0.00,
  `item_count` int(11) NOT NULL DEFAULT 0,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `layouts`
--

INSERT INTO `layouts` (`id`, `name`, `container_type_id`, `odoo_sale_order_id`, `status`, `total_weight_kg`, `used_volume_cm3`, `item_count`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Layout 8/3/2026, 2:25:59 PM', 2, NULL, 'confirmed', 0.000, 0.00, 0, 1, '2026-08-03 07:25:59', '2026-08-03 07:27:33');

-- --------------------------------------------------------

--
-- Struktur dari tabel `layout_history`
--

CREATE TABLE `layout_history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `layout_id` int(10) UNSIGNED NOT NULL,
  `snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`snapshot`)),
  `action_type` varchar(50) NOT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `layout_items`
--

CREATE TABLE `layout_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `layout_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `instance_no` int(11) NOT NULL DEFAULT 1,
  `pos_x` decimal(10,3) NOT NULL DEFAULT 0.000,
  `pos_y` decimal(10,3) NOT NULL DEFAULT 0.000,
  `pos_z` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rot_x` smallint(6) NOT NULL DEFAULT 0,
  `rot_y` smallint(6) NOT NULL DEFAULT 0,
  `rot_z` smallint(6) NOT NULL DEFAULT 0,
  `stack_level` int(11) NOT NULL DEFAULT 0,
  `is_valid` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `odoo_sync_logs`
--

CREATE TABLE `odoo_sync_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `sync_type` enum('product','sale_order') NOT NULL,
  `direction` enum('pull','push') NOT NULL,
  `status` enum('success','failed') NOT NULL,
  `message` text DEFAULT NULL,
  `record_count` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `products`
--

CREATE TABLE `products` (
  `id` int(10) UNSIGNED NOT NULL,
  `group_id` int(10) UNSIGNED DEFAULT NULL,
  `sku` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `length_cm` decimal(10,2) NOT NULL,
  `width_cm` decimal(10,2) NOT NULL,
  `height_cm` decimal(10,2) NOT NULL,
  `weight_kg` decimal(10,3) NOT NULL DEFAULT 0.000,
  `qty` int(11) NOT NULL DEFAULT 0,
  `this_side_up` tinyint(1) NOT NULL DEFAULT 0,
  `rotation_allowed` tinyint(1) NOT NULL DEFAULT 1,
  `stackable` tinyint(1) NOT NULL DEFAULT 1,
  `max_stack` int(11) NOT NULL DEFAULT 1,
  `color_hex` varchar(9) NOT NULL DEFAULT '#F59E0B',
  `notes` text DEFAULT NULL,
  `odoo_product_id` int(11) DEFAULT NULL,
  `odoo_sale_order_id` int(11) DEFAULT NULL,
  `odoo_last_sync_at` datetime DEFAULT NULL,
  `source` enum('manual','odoo') NOT NULL DEFAULT 'manual',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `products`
--

INSERT INTO `products` (`id`, `group_id`, `sku`, `name`, `length_cm`, `width_cm`, `height_cm`, `weight_kg`, `qty`, `this_side_up`, `rotation_allowed`, `stackable`, `max_stack`, `color_hex`, `notes`, `odoo_product_id`, `odoo_sale_order_id`, `odoo_last_sync_at`, `source`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'BOX-001', 'Standard Carton 60x40x40', 60.00, 40.00, 40.00, 5.000, 10, 0, 1, 1, 5, '#F59E0B', NULL, NULL, NULL, NULL, 'manual', 1, NULL, '2026-08-03 07:11:38', '2026-08-03 07:11:38'),
(2, 1, 'BOX-002', 'Large Carton 120x80x60', 120.00, 80.00, 60.00, 15.000, 5, 1, 0, 1, 3, '#EF4444', NULL, NULL, NULL, NULL, 'manual', 1, NULL, '2026-08-03 07:11:38', '2026-08-03 07:11:38'),
(3, 1, 'BOX-003', 'Small Carton 30x20x20', 30.00, 20.00, 20.00, 1.500, 50, 0, 1, 1, 10, '#10B981', NULL, NULL, NULL, NULL, 'manual', 1, NULL, '2026-08-03 07:11:38', '2026-08-03 07:11:38');

-- --------------------------------------------------------

--
-- Struktur dari tabel `product_groups`
--

CREATE TABLE `product_groups` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `color_hex` varchar(9) NOT NULL DEFAULT '#3B82F6',
  `is_collapsed` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `product_groups`
--

INSERT INTO `product_groups` (`id`, `name`, `color_hex`, `is_collapsed`, `sort_order`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'General Products', '#3B82F6', 0, 1, NULL, '2026-08-03 07:11:38', '2026-08-03 07:11:38');

-- --------------------------------------------------------

--
-- Struktur dari tabel `projects`
--

CREATE TABLE `projects` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `container_code` varchar(50) NOT NULL DEFAULT '',
  `container_name` varchar(150) NOT NULL DEFAULT '',
  `container_length` decimal(10,2) NOT NULL DEFAULT 0.00,
  `container_width` decimal(10,2) NOT NULL DEFAULT 0.00,
  `container_height` decimal(10,2) NOT NULL DEFAULT 0.00,
  `container_max_payload_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `container_tare_weight_kg` decimal(12,2) NOT NULL DEFAULT 0.00,
  `container_is_system` tinyint(1) NOT NULL DEFAULT 0,
  `products_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`products_json`)),
  `layout_items_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`layout_items_json`)),
  `item_count` int(11) NOT NULL DEFAULT 0,
  `total_weight_kg` decimal(12,3) NOT NULL DEFAULT 0.000,
  `volume_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `revoked` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','planner','viewer') NOT NULL DEFAULT 'planner',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Admin', 'admin@easycargo.local', '$2a$10$HIGSY2fM/XoNS71z4jDtCe6jQHrv1XQJ9NVmi1IarLRDxbuCpXzq6', 'admin', 1, '2026-08-03 07:11:38', '2026-08-03 07:11:38');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indeks untuk tabel `container_types`
--
ALTER TABLE `container_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `created_by` (`created_by`);

--
-- Indeks untuk tabel `layouts`
--
ALTER TABLE `layouts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `container_type_id` (`container_type_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indeks untuk tabel `layout_history`
--
ALTER TABLE `layout_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `layout_id` (`layout_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indeks untuk tabel `layout_items`
--
ALTER TABLE `layout_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_layout_items_layout` (`layout_id`),
  ADD KEY `idx_layout_items_product` (`product_id`),
  ADD KEY `layout_items_layout_id` (`layout_id`),
  ADD KEY `layout_items_product_id` (`product_id`);

--
-- Indeks untuk tabel `odoo_sync_logs`
--
ALTER TABLE `odoo_sync_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_products_group` (`group_id`),
  ADD KEY `idx_products_odoo` (`odoo_product_id`),
  ADD KEY `products_group_id` (`group_id`),
  ADD KEY `products_odoo_product_id` (`odoo_product_id`);

--
-- Indeks untuk tabel `product_groups`
--
ALTER TABLE `product_groups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indeks untuk tabel `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `container_types`
--
ALTER TABLE `container_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT untuk tabel `layouts`
--
ALTER TABLE `layouts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT untuk tabel `layout_history`
--
ALTER TABLE `layout_history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `layout_items`
--
ALTER TABLE `layout_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `odoo_sync_logs`
--
ALTER TABLE `odoo_sync_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `products`
--
ALTER TABLE `products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT untuk tabel `product_groups`
--
ALTER TABLE `product_groups`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT untuk tabel `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `container_types`
--
ALTER TABLE `container_types`
  ADD CONSTRAINT `container_types_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `layouts`
--
ALTER TABLE `layouts`
  ADD CONSTRAINT `layouts_ibfk_1` FOREIGN KEY (`container_type_id`) REFERENCES `container_types` (`id`),
  ADD CONSTRAINT `layouts_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `layout_history`
--
ALTER TABLE `layout_history`
  ADD CONSTRAINT `layout_history_ibfk_1` FOREIGN KEY (`layout_id`) REFERENCES `layouts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `layout_history_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `layout_items`
--
ALTER TABLE `layout_items`
  ADD CONSTRAINT `layout_items_ibfk_1` FOREIGN KEY (`layout_id`) REFERENCES `layouts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `layout_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `product_groups` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `products_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `product_groups`
--
ALTER TABLE `product_groups`
  ADD CONSTRAINT `product_groups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
