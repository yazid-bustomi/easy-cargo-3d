<?php
// Database configuration for easy-cargo
$db_host = 'localhost';
$db_user = 'root'; // Sesuaikan jika menggunakan user lain di XAMPP
$db_pass = '';     // Sesuaikan jika ada password
$db_name = 'easy-cargo';

// Create connection
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Set charset
$conn->set_charset("utf8mb4");

// Fungsi helper jika diperlukan di file PHP lain
function getConnection()
{
    global $conn;
    return $conn;
}
