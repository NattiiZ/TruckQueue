// บริษัทขนส่ง (ตาราง company)
import { pool } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

export async function listActive() {
  const [rows] = await pool.query('SELECT id, company_name FROM company WHERE is_active = 1 ORDER BY company_name');
  return rows;
}

/** ใช้ในทรานแซกชัน: บริษัทต้องมีอยู่และยังเปิดใช้งาน */
export async function assertActive(conn, companyId) {
  const [[row]] = await conn.query('SELECT id FROM company WHERE id = ? AND is_active = 1', [companyId]);
  if (!row) throw new AppError('กรุณาเลือกบริษัทขนส่ง');
}
