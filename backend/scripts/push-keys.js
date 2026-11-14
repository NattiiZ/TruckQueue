// สร้างกุญแจ VAPID สำหรับ Web Push (ส่งแจ้งเตือนถึงมือถือคนขับแม้ปิดเบราว์เซอร์)
// ใช้: npm run push:keys  → ใส่ VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ลงใน backend/.env ให้เอง (ถ้ายังไม่มี)
// สร้างครั้งเดียวพอ: ถ้าเปลี่ยนกุญแจ มือถือที่สมัครรับแจ้งเตือนไว้แล้วจะรับไม่ได้จนกว่าจะเปิดหน้าคนขับใหม่
// ถ้าเครื่อง dev กับ server ใช้ฐานข้อมูลเดียวกัน ให้สร้างที่ server แล้วคัดลอกกุญแจไปใส่ .env ของ dev
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateVAPIDKeys } from 'web-push';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';

if (/^VAPID_PUBLIC_KEY=.+/m.test(text)) {
  console.log('✔ มีกุญแจ VAPID ใน .env อยู่แล้ว ไม่ได้สร้างใหม่');
  process.exit(0);
}

const keys = generateVAPIDKeys();
const set = (name, value) => {
  const line = new RegExp(`^${name}=.*$`, 'm');
  text = line.test(text) ? text.replace(line, `${name}=${value}`) : `${text.replace(/\n*$/, '\n')}${name}=${value}\n`;
};
set('VAPID_PUBLIC_KEY', keys.publicKey);
set('VAPID_PRIVATE_KEY', keys.privateKey);
fs.writeFileSync(envFile, text);
console.log('✔ ใส่กุญแจ VAPID ลงใน backend/.env แล้ว · รีสตาร์ตเซิร์ฟเวอร์เพื่อใช้งาน');
