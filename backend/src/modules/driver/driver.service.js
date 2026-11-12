// คนขับ (ตาราง driver) · 1 คน 1 แถว · status: active = รับคิวได้, inactive = ออกจากงาน/ปิดสิทธิ์
import { pool } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export const INACTIVE_MSG = 'เบอร์นี้ถูกปิดการใช้งาน กรุณาติดต่อเจ้าหน้าที่';
export const DRIVER_STATUSES = ['active', 'inactive'];

/** กรอกเบอร์ → ข้อมูลไว้เติมฟอร์ม (ถ้าปิดสิทธิ์ ไม่ส่งชื่อกลับ) */
export async function lookupByPhone(phone) {
  const [[d]] = await pool.query(
    'SELECT first_name, last_name, company AS company_id, status FROM driver WHERE phone = ?', [phone]);
  if (!d) return { found: false };
  if (d.status !== 'active') return { found: true, inactive: true, message: INACTIVE_MSG };
  return { found: true, inactive: false, first_name: d.first_name, last_name: d.last_name, company_id: d.company_id };
}

/**
 * ใช้ตอนรับคิว (ในทรานแซกชัน):
 * เบอร์ใหม่ = เพิ่มแถว, เบอร์เดิม = อัปเดตชื่อ นามสกุล บริษัทเป็นค่าล่าสุด, คนที่ปิดสิทธิ์ = ไม่ให้รับคิว
 * คืนค่า driver.id
 */
export async function upsertForQueue(conn, { phone, firstName, lastName, companyId }) {
  const [[existing]] = await conn.query('SELECT id, status FROM driver WHERE phone = ? FOR UPDATE', [phone]);
  if (existing && existing.status !== 'active') throw new AppError(INACTIVE_MSG, 403, 'driver_inactive');
  if (existing) {
    await conn.query('UPDATE driver SET first_name = ?, last_name = ?, company = ?, last_visit_at = NOW() WHERE id = ?',
      [firstName, lastName, companyId, existing.id]);
    return existing.id;
  }
  const [ins] = await conn.query(
    'INSERT INTO driver (first_name, last_name, company, phone, last_visit_at) VALUES (?, ?, ?, ?, NOW())',
    [firstName, lastName, companyId, phone]);
  return ins.insertId;
}

/** เปิด/ปิดสิทธิ์รับคิว (พนักงาน) */
export async function setStatus(driverId, status) {
  const [r] = await pool.query('UPDATE driver SET status = ? WHERE id = ?', [status, driverId]);
  if (!r.affectedRows) throw new AppError('ไม่พบคนขับ', 404);
}
