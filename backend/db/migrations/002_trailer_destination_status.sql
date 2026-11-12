-- Migration 002 (2026-11-12)
-- รันแล้วบน truckcue_db · รันซ้ำไม่ได้ · ดู db/migrations/README.md
-- 1) ทะเบียนพ่วง 1, พ่วง 2 และปลายทาง
-- 2) สถานะคิวครบ: waiting รอคิว → called กำลังเรียก → loading กำลังเข้าโหลด → done โหลดเสร็จ → exited ออกแล้ว · cancelled ยกเลิก
-- 3) เลขคิวรันต่อเนื่อง ไม่เริ่มใหม่ทุกวัน (ใช้ id ของคิว เช่น 0001, 0002, ...) จึงไม่ต้องใช้ daily_counter แล้ว

ALTER TABLE queue
  ADD COLUMN trailer1_plate VARCHAR(30)  NULL AFTER plate_no,          -- ทะเบียนพ่วง 1
  ADD COLUMN trailer2_plate VARCHAR(30)  NULL AFTER trailer1_plate,    -- ทะเบียนพ่วง 2
  ADD COLUMN destination    VARCHAR(150) NULL AFTER trailer2_plate,    -- ปลายทาง
  ADD COLUMN exited_at      DATETIME(3)  NULL AFTER loading_finished_at,
  MODIFY status ENUM('waiting','called','loading','done','exited','cancelled') NOT NULL DEFAULT 'waiting',
  MODIFY queue_no VARCHAR(10) NULL,
  DROP INDEX uq_queue_day_no;

-- เลขคิวเดิมเปลี่ยนเป็นรูปแบบใหม่ (เลขเดียวกับ id)
UPDATE queue SET queue_no = LPAD(id, 4, '0');

ALTER TABLE queue
  ADD UNIQUE KEY uq_queue_no (queue_no),
  ADD KEY idx_queue_status (status, sort_order),
  ADD KEY idx_queue_destination (destination);

ALTER TABLE queue_event
  MODIFY action ENUM('register','call','recall','start','finish','exit','skip','cancel','edit') NOT NULL;

DROP TABLE IF EXISTS daily_counter;
