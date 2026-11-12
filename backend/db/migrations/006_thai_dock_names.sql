-- Migration 006 (2026-11-12)
-- เปลี่ยนชื่อจุดรับสินค้าเป็นภาษาไทย: 'Dock 1' → 'จุดรับสินค้า 1' (เฉพาะชื่อที่ยังเป็นแบบเดิม)

UPDATE dock SET dock_name = CONCAT('จุดรับสินค้า ', TRIM(SUBSTRING(dock_name, 5))) WHERE dock_name LIKE 'Dock %';
