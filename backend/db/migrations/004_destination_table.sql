-- Migration 004 (2026-11-12)
-- รันแล้วบน truckcue_db · รันซ้ำไม่ได้ · ดู db/migrations/README.md
-- ใช้ตาราง destination ที่สร้างไว้แล้ว (id, destination) เป็นรายการปลายทางให้คนขับเลือก
-- queue.destination (ข้อความ) → queue.destination_id (อ้างอิง destination.id)

-- ตารางเดิม: เพิ่มเลข id อัตโนมัติ, ชื่อปลายทางห้ามซ้ำ, is_active ไว้ปิดปลายทางที่เลิกใช้ (เหมือน company)
ALTER TABLE destination
  MODIFY id BIGINT(20) NOT NULL AUTO_INCREMENT,
  MODIFY destination VARCHAR(100) NOT NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD UNIQUE KEY uq_destination (destination);

-- ข้อมูลตัวอย่าง (แก้ชื่อหรือเพิ่มได้ในตาราง destination)
INSERT IGNORE INTO destination (destination) VALUES ('ปลายทางตัวอย่าง 1'), ('ปลายทางตัวอย่าง 2');

-- คิวอ้างอิงปลายทางด้วย id (ตอนนี้ยังไม่มีคิวไหนกรอกปลายทาง จึงลบคอลัมน์ข้อความเดิมได้เลย)
ALTER TABLE queue
  DROP INDEX idx_queue_destination,
  DROP COLUMN destination,
  ADD COLUMN destination_id BIGINT(20) NULL AFTER trailer_plate,
  ADD KEY idx_queue_destination (destination_id, queue_date),
  ADD CONSTRAINT fk_queue_destination FOREIGN KEY (destination_id) REFERENCES destination(id);
