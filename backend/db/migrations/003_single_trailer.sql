-- Migration 003 (2026-11-12)
-- รันแล้วบน truckcue_db · รันซ้ำไม่ได้ · ดู db/migrations/README.md
-- ทะเบียนเหลือ 2 ช่อง: plate_no = ทะเบียนตัวแม่, trailer_plate = ทะเบียนตัวพ่วง

ALTER TABLE queue
  CHANGE trailer1_plate trailer_plate VARCHAR(30) NULL,
  DROP COLUMN trailer2_plate;
