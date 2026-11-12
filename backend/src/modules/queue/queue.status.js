// สถานะคิวและการเปลี่ยนสถานะ (state machine) — แก้ลำดับขั้นของงานได้ที่ไฟล์นี้ที่เดียว
//
//   waiting รอคิว ──call──▶ called กำลังเรียก ──start──▶ loading กำลังเข้าโหลด ──finish──▶ done โหลดเสร็จ ──exit──▶ exited ออกแล้ว
//      ▲                       │
//      └────────skip───────────┘          waiting / called ──cancel──▶ cancelled ยกเลิก

export const STATUS_TH = {
  waiting: 'รอคิว',
  called: 'กำลังเรียก',
  loading: 'กำลังเข้าโหลด',
  done: 'โหลดเสร็จ',
  exited: 'ออกแล้ว',
  cancelled: 'ยกเลิก',
};

/** เรียกแล้วเกินกี่นาทีถึงขึ้นแดงว่ารถมาช้า (ไม่ข้ามคิวอัตโนมัติ พนักงานตัดสินใจเอง) */
export const LATE_MINUTES = 10;

/**
 * ขั้นที่พนักงานกดได้: from = สถานะที่อนุญาตให้กด, set = คอลัมน์ที่อัปเดต (ค่าคงที่ ไม่รับจากผู้ใช้)
 * (call เป็นกรณีพิเศษเพราะต้องเลือกคิวถัดไปและจุดรับสินค้า จึงอยู่ใน queue.service.callNext)
 */
export const STAFF_STEPS = {
  start:  { from: ['called'],            set: "status = 'loading', loading_started_at = NOW(3)" },
  finish: { from: ['loading'],           set: "status = 'done', loading_finished_at = NOW(3)" },
  exit:   { from: ['done'],              set: "status = 'exited', exited_at = NOW(3)" },
  skip:   { from: ['called'],            set: "status = 'waiting', dock_id = NULL, called_at = NULL, sort_order = NOW(3), skip_count = skip_count + 1" },
  cancel: { from: ['waiting', 'called'], set: "status = 'cancelled'" },
};
