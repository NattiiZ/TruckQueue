// การเชื่อมต่อ MariaDB (connection pool) และตัวช่วยทำทรานแซกชัน
import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  ...env.db,
  charset: 'utf8mb4',
  timezone: '+07:00',          // อ่าน/เขียน DATETIME เป็นเวลาไทย
  waitForConnections: true,
  connectionLimit: 10,
});

// ทุก connection: เวลาไทย (NOW() / CURDATE()) และโหมด strict
// strict = ข้อมูลผิดประเภทหรือช่องบังคับว่าง จะ error ทันที แทนที่ MariaDB จะแอบแปลงเป็น '' หรือ 0
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+07:00', sql_mode = CONCAT_WS(',', NULLIF(@@sql_mode, ''), 'STRICT_TRANS_TABLES')");
});

/** รันหลายคำสั่งในทรานแซกชันเดียว ถ้ามี error (รวมถึง AppError) จะ rollback ทั้งหมด */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
