// ล้างข้อมูลการใช้งาน (เริ่มใช้ระบบใหม่ / หลังทดสอบ) — ลบแล้วกู้คืนไม่ได้
//   npm run db:reset -- --yes              ลบคิวทั้งหมด + ประวัติการกด, เลขคิวเริ่มใหม่ที่ 0001
//   npm run db:reset -- --yes --drivers    ลบรายชื่อคนขับด้วย
// ไม่แตะข้อมูลตั้งค่า: company, destination, dock
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const args = process.argv.slice(2);
const withDrivers = args.includes('--drivers');
if (!args.includes('--yes')) {
  console.log('จะลบ: คิวทั้งหมด (queue) + ประวัติการกด (queue_event)' + (withDrivers ? ' + รายชื่อคนขับ (driver)' : ''));
  console.log('ลบแล้วกู้คืนไม่ได้ ถ้าแน่ใจให้รันใหม่พร้อม --yes เช่น  npm run db:reset -- --yes' + (withDrivers ? ' --drivers' : ''));
  process.exit(1);
}

const conn = await mysql.createConnection({ ...env.db, charset: 'utf8mb4' });
try {
  const count = async (t) => (await conn.query(`SELECT COUNT(*) AS n FROM ${t}`))[0][0].n;
  const before = { queue: await count('queue'), queue_event: await count('queue_event'), driver: await count('driver') };
  await conn.beginTransaction();
  await conn.query('DELETE FROM queue_event');
  await conn.query('DELETE FROM queue');
  if (withDrivers) await conn.query('DELETE FROM driver');
  await conn.commit();
  await conn.query('ALTER TABLE queue AUTO_INCREMENT = 1');        // เลขคิวเริ่มใหม่ที่ 0001
  await conn.query('ALTER TABLE queue_event AUTO_INCREMENT = 1');
  if (withDrivers) await conn.query('ALTER TABLE driver AUTO_INCREMENT = 1');
  console.log(`✔ ลบคิว ${before.queue} แถว, ประวัติ ${before.queue_event} แถว${withDrivers ? `, คนขับ ${before.driver} คน` : ` (เก็บรายชื่อคนขับ ${before.driver} คนไว้)`} · คิวถัดไปคือ 0001`);
} catch (e) {
  await conn.rollback().catch(() => {});
  throw e;
} finally {
  await conn.end();
}
