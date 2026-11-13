-- Migration 007 (2026-11-13)
-- Web Push: แจ้งเตือน "ถึงคิวแล้ว" ถึงมือถือคนขับแม้ปิดเบราว์เซอร์
-- 1) queue.driver_ack_at = เวลาที่คนขับกด "รับทราบ" การเรียกครั้งล่าสุด (เรียกใหม่ = ล้างเป็น NULL)
-- 2) push_subscription = ที่อยู่สำหรับส่งแจ้งเตือนไปยังมือถือที่ถือคิวนั้น (1 คิว : 1 เครื่อง)

ALTER TABLE queue ADD COLUMN IF NOT EXISTS driver_ack_at DATETIME(3) NULL AFTER called_at;

CREATE TABLE IF NOT EXISTS push_subscription (
  queue_id    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  endpoint    VARCHAR(1000)   NOT NULL,
  p256dh      VARCHAR(200)    NOT NULL,
  auth        VARCHAR(100)    NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_push_queue FOREIGN KEY (queue_id) REFERENCES queue(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
