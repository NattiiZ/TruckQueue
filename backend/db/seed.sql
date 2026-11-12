-- ข้อมูลตั้งต้นสำหรับติดตั้งเครื่องใหม่ (รันซ้ำได้ ไม่สร้างซ้ำ)
INSERT IGNORE INTO company (id, company_name) VALUES
  (1, 'บริษัทขนส่งตัวอย่าง 1'),
  (2, 'บริษัทขนส่งตัวอย่าง 2');

INSERT IGNORE INTO destination (id, destination) VALUES
  (1, 'ปลายทางตัวอย่าง 1'),
  (2, 'ปลายทางตัวอย่าง 2'),
  (3, 'ไม่ระบุ');

INSERT IGNORE INTO dock (id, dock_name, std_minutes, sort_order) VALUES
  (1, 'จุดรับสินค้า 1', 35, 1),
  (2, 'จุดรับสินค้า 2', 50, 2),
  (3, 'จุดรับสินค้า 3', 25, 3);
