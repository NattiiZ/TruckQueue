-- TruckQ database schema (MariaDB 10.5+) · ใช้ติดตั้งเครื่องใหม่: npm run db:setup
-- โครงสร้างล่าสุด = truckcue_db หลังรัน db/migrations ครบทุกไฟล์
-- เวลาทั้งหมดเป็นเวลาไทย (+07:00) เพราะทุก connection ตั้ง time_zone = '+07:00'

CREATE TABLE IF NOT EXISTS company (
  id            BIGINT(20)   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name  VARCHAR(100) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_company_name (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- คนขับ 1 คน 1 แถว · ใช้เติมชื่อ นามสกุล บริษัทจากเบอร์ (ไม่เก็บทะเบียน เพราะกรอกเองทุกครั้ง)
-- status: active = รับคิวได้, inactive = ออกจากงาน/ปิดสิทธิ์
CREATE TABLE IF NOT EXISTS driver (
  id             BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  company        BIGINT(20)   NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_visit_at  DATETIME     NULL,
  UNIQUE KEY uq_driver_phone (phone),
  KEY company_fk (company),
  CONSTRAINT company_fk FOREIGN KEY (company) REFERENCES company(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ปลายทาง (ให้คนขับเลือกจากรายการ)
CREATE TABLE IF NOT EXISTS destination (
  id           BIGINT(20)   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  destination  VARCHAR(100) NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_destination (destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- จุดรับสินค้า (ชื่อภาษาไทย เช่น จุดรับสินค้า 1) · std_minutes = เวลาโหลดมาตรฐานต่อคัน
CREATE TABLE IF NOT EXISTS dock (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  dock_name    VARCHAR(50) NOT NULL,
  std_minutes  SMALLINT    NOT NULL DEFAULT 40,
  is_active    TINYINT(1)  NOT NULL DEFAULT 1,
  sort_order   SMALLINT    NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- คิว 1 แถว = รถ 1 คัน 1 รอบ · ชื่อ เบอร์ บริษัท ทะเบียน เก็บค่า ณ วันที่มา
-- เลขคิวรันต่อเนื่อง ไม่เริ่มใหม่ทุกวัน (= id เติม 0 ให้ครบ 4 หลัก)
-- สถานะ: waiting รอคิว → called กำลังเรียก → loading กำลังเข้าโหลด → done โหลดเสร็จ → exited ออกแล้ว · cancelled ยกเลิก
CREATE TABLE IF NOT EXISTS queue (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  queue_date           DATE         NOT NULL,
  queue_no             VARCHAR(10)  NULL,
  access_token         CHAR(32)     NOT NULL,
  driver_id            BIGINT UNSIGNED NOT NULL,
  first_name           VARCHAR(100) NOT NULL,
  last_name            VARCHAR(100) NOT NULL,
  phone                VARCHAR(20)  NOT NULL,
  company_id           BIGINT(20)   NOT NULL,
  plate_no             VARCHAR(30)  NOT NULL,      -- ทะเบียนหัว (รูปแบบ 70-1234)
  trailer_plate        VARCHAR(30)  NOT NULL,      -- ทะเบียนหาง (รูปแบบ 70-1234)
  destination_id       BIGINT(20)   NOT NULL,      -- ปลายทาง → destination.id (มีตัวเลือก 'ไม่ระบุ')
  dock_id              INT          NULL,
  status               ENUM('waiting','called','loading','done','exited','cancelled') NOT NULL DEFAULT 'waiting',
  sort_order           DATETIME(3)  NOT NULL,
  skip_count           SMALLINT     NOT NULL DEFAULT 0,
  registered_at        DATETIME(3)  NOT NULL,
  called_at            DATETIME(3)  NULL,
  loading_started_at   DATETIME(3)  NULL,
  loading_finished_at  DATETIME(3)  NULL,
  exited_at            DATETIME(3)  NULL,
  note                 VARCHAR(255) NULL,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_queue_no (queue_no),
  KEY idx_queue_day_status (queue_date, status, sort_order),
  KEY idx_queue_status (status, sort_order),
  KEY idx_queue_destination (destination_id, queue_date),
  KEY idx_queue_dock_day (dock_id, queue_date),
  KEY idx_queue_company_day (company_id, queue_date),
  CONSTRAINT fk_queue_driver  FOREIGN KEY (driver_id)  REFERENCES driver(id),
  CONSTRAINT fk_queue_company FOREIGN KEY (company_id) REFERENCES company(id),
  CONSTRAINT fk_queue_dock    FOREIGN KEY (dock_id)    REFERENCES dock(id),
  CONSTRAINT fk_queue_destination FOREIGN KEY (destination_id) REFERENCES destination(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS queue_event (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  queue_id    BIGINT UNSIGNED NOT NULL,
  action      ENUM('register','call','recall','start','finish','exit','skip','cancel','edit') NOT NULL,
  dock_id     INT          NULL,
  user_id     INT          NULL,
  meta        TEXT         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_event_queue (queue_id),
  CONSTRAINT fk_event_queue FOREIGN KEY (queue_id) REFERENCES queue(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
