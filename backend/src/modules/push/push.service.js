// Web Push: ส่งแจ้งเตือน "ถึงคิวแล้ว" ไปที่มือถือคนขับ (เด้งได้แม้ปิดเบราว์เซอร์ไปแล้ว)
// ขั้นตอน: หน้าคนขับสมัครรับแจ้งเตือน → เก็บไว้ในตาราง push_subscription
//          → พนักงานกดเรียกคิว → ส่งแจ้งเตือน และส่งซ้ำทุก 30 วินาทีจนกว่าคนขับจะกด "รับทราบ"
// ต้องมีกุญแจ VAPID ใน .env (npm run push:keys) และหน้าเว็บต้องเปิดผ่าน https (หรือ localhost)
import * as webpush from 'web-push';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const REMIND_EVERY_MS = 30 * 1000;   // ส่งซ้ำทุก 30 วินาที
const REMIND_TIMES = 10;             // สูงสุด 10 ครั้ง (~5 นาที) หลังจากนั้นให้พนักงานโทรตามแทน

const enabled = Boolean(env.vapid.publicKey && env.vapid.privateKey);
if (enabled) webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
else console.warn(' - Web Push ปิดอยู่: ยังไม่มีกุญแจ VAPID (รัน npm run push:keys)');

/** กุญแจสาธารณะที่หน้าเว็บใช้สมัครรับแจ้งเตือน (null = ปิดอยู่) */
export const publicKey = () => (enabled ? env.vapid.publicKey : null);

/** บันทึกที่อยู่รับแจ้งเตือนของคิวนี้ (สมัครซ้ำ = แทนที่ของเดิม) */
export async function save(queueId, sub) {
  const endpoint = String(sub?.endpoint || '');
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  if (!endpoint.startsWith('https://') || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) {
    throw new AppError('ข้อมูลการรับแจ้งเตือนไม่ถูกต้อง');
  }
  await pool.query(
    `INSERT INTO push_subscription (queue_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE endpoint = VALUES(endpoint), p256dh = VALUES(p256dh), auth = VALUES(auth), created_at = NOW(3)`,
    [queueId, endpoint, p256dh, auth]);
}

/** เริ่มส่งแจ้งเตือนว่าคิวนี้ถูกเรียกแล้ว (เรียกหลังพนักงานกด "เรียกคิวถัดไป") · ทำงานเบื้องหลัง ไม่ต้องรอ */
export function notifyCalled(queueId) {
  if (!enabled) return;
  let sent = 0;
  let calledAt = null;   // จำเวลาเรียกครั้งนี้ไว้ ถ้าถูกข้ามแล้วเรียกใหม่ รอบเก่าจะหยุดเอง
  const run = async () => {
    try {
      const row = await sendCalled(queueId, calledAt);
      if (!row) return;
      calledAt = row.called_at;
      if (++sent < REMIND_TIMES) setTimeout(run, REMIND_EVERY_MS);
    } catch (err) {
      console.error(`Web Push คิว ${queueId}:`, err.message);
    }
  };
  run();
}

/**
 * พนักงานกด ข้าม / ยกเลิก / เริ่มโหลด ระหว่างที่คนขับยังไม่กดรับทราบ
 * → ส่ง push ให้ service worker ปิดแจ้งเตือนที่ค้าง และหยุดเสียงไซเรนในหน้าเว็บที่ค้างอยู่เบื้องหลัง
 * (Chrome บน Android หยุดโค้ดของหน้าเว็บตอนออกจากเบราว์เซอร์ แต่เสียงยังเล่นต่อ หน้าเว็บจึงปิดเสียงเองไม่ได้)
 */
export function notifyEnded(queueId, step) {
  if (!enabled || !['skip', 'cancel', 'start'].includes(step)) return;
  sendEnded(queueId, step).catch((err) => console.error(`Web Push คิว ${queueId}:`, err.message));
}

async function sendEnded(queueId, step) {
  const [[row]] = await pool.query(
    `SELECT q.id, q.queue_no, q.driver_ack_at, s.endpoint, s.p256dh, s.auth
       FROM push_subscription s JOIN queue q ON q.id = s.queue_id
      WHERE s.queue_id = ?`, [queueId]);
  if (!row || row.driver_ack_at) return;   // รับทราบแล้ว = ไม่มีเสียงค้าง ไม่ต้องส่ง
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify({ type: 'ended', step, queue_id: row.id, queue_no: row.queue_no }),
      { TTL: 120, urgency: 'high' });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) await pool.query('DELETE FROM push_subscription WHERE queue_id = ?', [queueId]);
    else console.error(`Web Push คิว ${row.queue_no}: ส่งไม่สำเร็จ (${err.statusCode || err.message})`);
  }
}

/** ส่ง 1 ครั้ง · คืนข้อมูลคิวถ้ายังต้องเตือนต่อ, คืน null ถ้าไม่ต้องส่งแล้ว */
async function sendCalled(queueId, calledAt) {
  const [[row]] = await pool.query(
    `SELECT q.id, q.queue_no, q.access_token, q.status, q.called_at, q.driver_ack_at, d.dock_name,
            s.endpoint, s.p256dh, s.auth
       FROM push_subscription s
       JOIN queue q ON q.id = s.queue_id
       LEFT JOIN dock d ON d.id = q.dock_id
      WHERE s.queue_id = ?`, [queueId]);

  if (!row || row.status !== 'called' || row.driver_ack_at) return null;   // ไม่ได้สมัคร / ไม่ได้อยู่สถานะเรียก / รับทราบแล้ว
  if (calledAt && new Date(row.called_at).getTime() !== new Date(calledAt).getTime()) return null;   // เป็นการเรียกรอบใหม่แล้ว

  // ข้อมูลในแจ้งเตือนถูกเข้ารหัสถึงมือถือเครื่องนั้นเครื่องเดียว จึงใส่ token ได้
  // (ให้กด "รับทราบ" จากแจ้งเตือนได้แม้ไม่ได้เปิดหน้าเว็บอยู่)
  const payload = JSON.stringify({
    type: 'called', queue_id: row.id, token: row.access_token,
    queue_no: row.queue_no, dock_name: row.dock_name,
  });
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      payload,
      { TTL: 120, urgency: 'high' });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {   // มือถือยกเลิกรับแจ้งเตือนแล้ว
      await pool.query('DELETE FROM push_subscription WHERE queue_id = ?', [queueId]);
      return null;
    }
    console.error(`Web Push คิว ${row.queue_no}: ส่งไม่สำเร็จ (${err.statusCode || err.message})`);
  }
  return row;
}
