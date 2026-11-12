// ปลายทาง (ตาราง destination)
import { pool } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

/** ชื่อของตัวเลือก "ไม่ระบุ" (แถวจริงในตาราง destination) */
export const UNSPECIFIED = 'ไม่ระบุ';

/** รายการปลายทาง เรียงตามชื่อ โดยให้ "ไม่ระบุ" อยู่ท้ายสุด */
export async function listActive() {
  const [rows] = await pool.query(
    'SELECT id, destination FROM destination WHERE is_active = 1 ORDER BY destination = ?, destination', [UNSPECIFIED]);
  return rows;
}

/** ใช้ในทรานแซกชัน: ปลายทางต้องมีอยู่และยังเปิดใช้งาน */
export async function assertActive(conn, destinationId) {
  const [[row]] = await conn.query('SELECT id FROM destination WHERE id = ? AND is_active = 1', [destinationId]);
  if (!row) throw new AppError('ไม่พบปลายทางที่เลือก กรุณาเลือกใหม่');
}
