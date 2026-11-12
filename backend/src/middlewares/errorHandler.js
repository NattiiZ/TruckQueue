import { AppError } from '../utils/AppError.js';

const DB_DOWN = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'];

/** API ที่ไม่มีอยู่ */
export function notFound(req, res) {
  res.status(404).json({ error: 'ไม่พบ API นี้' });
}

/** แปลง error ทุกแบบเป็น JSON ที่หน้าเว็บอ่านได้ */
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  console.error(err);
  if (DB_DOWN.includes(err.code)) return res.status(503).json({ error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });
  res.status(500).json({ error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
}
