-- ต่อยอดจาก truckcue_db เดิม (company, driver) ให้เก็บข้อมูลคิวได้
-- รันแล้วบน truckcue_db · รันซ้ำไม่ได้ · ดู db/migrations/README.md

-- ตั้งชื่อตารางเป็นเอกพจน์ตามของเดิม (company, driver)

USE truckcue_db;

/* ---------- 1) แก้ตารางเดิมเล็กน้อย ---------- */

-- ชื่อบริษัทห้ามซ้ำ
ALTER TABLE company
  ADD UNIQUE KEY uq_company_name (company_name),
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER company_name;

-- driver = ข้อมูลประจำตัวคนขับ 1 คน 1 แถว (ใช้เติมชื่อ นามสกุล บริษัท จากเบอร์)
-- * phone ต้องไม่ซ้ำ ไม่งั้นค้นจากเบอร์แล้วเจอหลายคน
-- * company DEFAULT 0 ใช้ไม่ได้ เพราะไม่มีบริษัท id 0 (ติด FK) จึงเอา default ออก
-- * status = เปิดให้คนนี้รับคิวได้ไหม: active = ใช้งานได้, inactive = ออกจากงาน/ปิดสิทธิ์ (ไม่ใช่สถานะคิว)
ALTER TABLE driver
  MODIFY company BIGINT(20) NOT NULL,
  MODIFY status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  ADD UNIQUE KEY uq_driver_phone (phone),
  ADD COLUMN last_visit_at DATETIME NULL AFTER created_at;

/* ---------- 2) ตารางใหม่ ---------- */

-- จุดรับสินค้า
CREATE TABLE dock (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  dock_name    VARCHAR(50) NOT NULL,
  std_minutes  SMALLINT    NOT NULL DEFAULT 40,   -- เวลามาตรฐาน (ค่าตั้งต้น รอคำนวณจากข้อมูลจริง)
  is_active    TINYINT(1)  NOT NULL DEFAULT 1,
  sort_order   SMALLINT    NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตัวนับเลขคิวรายวัน (A001, A002 ... เริ่มใหม่ทุกวัน)
CREATE TABLE daily_counter (
  queue_date  DATE PRIMARY KEY,
  last_no     INT  NOT NULL
) ENGINE=InnoDB;

-- คิว: 1 แถว = รถ 1 คัน 1 รอบที่มารับของ (ตารางหลักของระบบ)
CREATE TABLE queue (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  queue_date           DATE         NOT NULL,
  queue_no             VARCHAR(10)  NOT NULL,
  access_token         CHAR(32)     NOT NULL,         -- ให้คนขับดูคิวของตัวเองได้คนเดียว
  driver_id            BIGINT UNSIGNED NOT NULL,      -- → driver.id
  -- เก็บค่า ณ วันที่มา (ชื่อ เบอร์ บริษัทเปลี่ยนได้ แต่รายงานย้อนหลังต้องตรงกับวันนั้น)
  first_name           VARCHAR(100) NOT NULL,
  last_name            VARCHAR(100) NOT NULL,
  phone                VARCHAR(20)  NOT NULL,
  company_id           BIGINT(20)   NOT NULL,         -- → company.id
  plate_no             VARCHAR(30)  NOT NULL,         -- กรอกเองทุกครั้ง
  dock_id              INT          NULL,             -- ใส่ตอนเรียกคิว
  status               ENUM('waiting','called','loading','done','cancelled') NOT NULL DEFAULT 'waiting',
  sort_order           DATETIME(3)  NOT NULL,         -- ลำดับคิว (ข้ามคิว = เลื่อนไปท้าย)
  skip_count           SMALLINT     NOT NULL DEFAULT 0,
  registered_at        DATETIME(3)  NOT NULL,         -- ลงทะเบียน
  called_at            DATETIME(3)  NULL,             -- เรียกคิว
  loading_started_at   DATETIME(3)  NULL,             -- เริ่มโหลด
  loading_finished_at  DATETIME(3)  NULL,             -- โหลดเสร็จ
  note                 VARCHAR(255) NULL,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_queue_day_no (queue_date, queue_no),
  KEY idx_queue_day_status (queue_date, status, sort_order),
  KEY idx_queue_dock_day (dock_id, queue_date),
  KEY idx_queue_company_day (company_id, queue_date),
  CONSTRAINT fk_queue_driver  FOREIGN KEY (driver_id)  REFERENCES driver(id),
  CONSTRAINT fk_queue_company FOREIGN KEY (company_id) REFERENCES company(id),
  CONSTRAINT fk_queue_dock    FOREIGN KEY (dock_id)    REFERENCES dock(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ประวัติทุกการกด: ใครทำอะไร ตอนไหน (user_id NULL = คนขับทำเอง)
CREATE TABLE queue_event (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  queue_id    BIGINT UNSIGNED NOT NULL,
  action      ENUM('register','call','recall','start','finish','skip','cancel','edit') NOT NULL,
  dock_id     INT          NULL,
  user_id     INT          NULL,
  meta        TEXT         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_event_queue (queue_id),
  CONSTRAINT fk_event_queue FOREIGN KEY (queue_id) REFERENCES queue(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ---------- 3) ข้อมูลตั้งต้น ---------- */
INSERT INTO dock (dock_name, std_minutes, sort_order) VALUES
  ('Dock 1', 35, 1), ('Dock 2', 50, 2), ('Dock 3', 25, 3);
