// จุดรับสินค้า (ตาราง dock) · รถทุกคันเข้าได้ทุกจุด ตามลำดับคิว
import { pool } from '../../config/database.js';

export async function listActive(db = pool) {
  const [rows] = await db.query('SELECT id, dock_name, std_minutes FROM dock WHERE is_active = 1 ORDER BY sort_order, id');
  return rows;
}
