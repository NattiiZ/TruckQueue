-- Migration 005 (2026-11-12)
-- บังคับกรอกทุกช่อง: ทะเบียนตัวพ่วงและปลายทางห้ามว่าง
-- ปลายทางมีตัวเลือก "ไม่ระบุ" เป็นแถวจริงในตาราง destination (เลือกได้เมื่อไม่รู้ปลายทาง)

INSERT IGNORE INTO destination (destination) VALUES ('ไม่ระบุ');

-- คิวเก่าที่ไม่ได้เลือกปลายทาง → ไม่ระบุ (ทำก่อนบังคับ NOT NULL)
UPDATE queue SET destination_id = (SELECT id FROM destination WHERE destination = 'ไม่ระบุ') WHERE destination_id IS NULL;
UPDATE queue SET trailer_plate = '' WHERE trailer_plate IS NULL;

ALTER TABLE queue
  MODIFY trailer_plate  VARCHAR(30) NOT NULL,   -- ทะเบียนตัวพ่วง
  MODIFY destination_id BIGINT(20)  NOT NULL;   -- ปลายทาง → destination.id
