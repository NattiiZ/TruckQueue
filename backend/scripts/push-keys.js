// สร้างกุญแจ VAPID สำหรับ Web Push (ส่งแจ้งเตือนถึงมือถือคนขับแม้ปิดเบราว์เซอร์)
// ใช้: npm run push:keys  → เพิ่ม VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ลงใน .env ให้เอง (ถ้ายังไม่มี)
// สร้างครั้งเดียวพอ: ถ้าเปลี่ยนกุญแจ มือถือที่สมัครรับแจ้งเตือนไว้แล้วจะรับไม่ได้จนกว่าจะเปิดหน้าคนขับใหม่
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVAPIDKeys } from 'web-push';

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env');
const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';

if (/^VAPID_PUBLIC_KEY=.+/m.test(current)) {
  console.log('✔ มีกุญแจ VAPID ใน .env อยู่แล้ว ไม่ได้สร้างใหม่');
} else {
  const { publicKey, privateKey } = generateVAPIDKeys();
  const block = [
    '',
    '# Web Push: กุญแจสำหรับส่งแจ้งเตือน "ถึงคิวแล้ว" (สร้างด้วย npm run push:keys · ห้ามเผยแพร่ PRIVATE)',
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    'VAPID_SUBJECT=mailto:admin@truckq.local',
    '',
  ].join('\n');
  fs.appendFileSync(envFile, (current.endsWith('\n') || !current ? '' : '\n') + block);
  console.log('✔ เพิ่มกุญแจ VAPID ลงใน .env แล้ว · รีสตาร์ตเซิร์ฟเวอร์เพื่อใช้งาน');
}
