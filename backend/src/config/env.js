// ค่าตั้งค่าที่ต่างกันในแต่ละเครื่อง (เครื่อง dev / เครื่อง server) อ่านจาก backend/.env
// .env ไม่ขึ้น git: แต่ละเครื่องมีของตัวเอง ดูตัวอย่างที่ backend/.env.example
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// อ่าน backend/.env เสมอ ไม่ว่าจะสั่งรันจากโฟลเดอร์ไหน
const ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));
if (fs.existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE });
else console.warn(' - ไม่พบ backend/.env · คัดลอก backend/.env.example เป็น .env แล้วใส่ค่าของเครื่องนี้');


export const env =
{
  port: Number(process.env.PORT || 3000),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),   // ที่อยู่ https ที่เปิดให้คนขับใช้ (ถ้ามี)
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'truckqueue_db',
  },
  // Web Push (สร้างด้วย npm run push:keys) · ไม่มีกุญแจ = ปิดการส่งแจ้งเตือนแบบ push ไว้ ระบบอื่นใช้ได้ปกติ
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || process.env.PUBLIC_URL || 'mailto:admin@truckq.local',
  },
};
