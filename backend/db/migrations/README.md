# Migrations

ประวัติการแก้โครงสร้างฐานข้อมูล `truckcue_db` เรียงตามเลข **รันแล้วทั้งหมดบนเครื่องนี้ (2026-11-13, 001–007)**

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `001_queue_tables.sql` | ต่อจาก company/driver เดิม: phone ห้ามซ้ำ, driver.status = active/inactive, เพิ่ม dock, queue, queue_event |
| `002_trailer_destination_status.sql` | สถานะคิวครบ 6 แบบ, เลขคิวรันต่อเนื่อง, เวลาออก (exited_at) |
| `003_single_trailer.sql` | ทะเบียนเหลือ 2 ช่อง: หัว (plate_no) + หาง (trailer_plate) |
| `004_destination_table.sql` | ปลายทางใช้ตาราง destination, คิวเก็บ destination_id |
| `005_required_fields.sql` | บังคับกรอกทะเบียนหางและปลายทาง, เพิ่มปลายทาง "ไม่ระบุ" |
| `006_thai_dock_names.sql` | ชื่อจุดรับสินค้าเป็นภาษาไทย (Dock 1 → จุดรับสินค้า 1) |
| `007_web_push.sql` | Web Push: queue.driver_ack_at (คนขับกดรับทราบ) + ตาราง push_subscription |

- **เครื่องใหม่** ไม่ต้องรันไฟล์ในนี้ ใช้ `npm run db:setup` (`db/schema.sql` = โครงสร้างล่าสุดครบแล้ว)
- **แก้โครงสร้างครั้งต่อไป**: สร้างไฟล์ `008_....sql` แล้วรัน `npm run db:run -- db/migrations/008_....sql` และแก้ `db/schema.sql` ให้ตรงกันด้วย
