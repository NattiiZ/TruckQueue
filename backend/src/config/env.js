import 'dotenv/config';


export const env = 
{
  port: Number(process.env.PORT || 3000),
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
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@truckq.local',
  },
};
