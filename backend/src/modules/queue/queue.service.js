// คิว (ตาราง queue + queue_event) — งานหลักของระบบ
// เลขคิวรันต่อเนื่อง ไม่เริ่มใหม่ทุกวัน (= id เติม 0 ให้ครบ 4 หลัก)
import { pool, tx } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { newToken, sameToken } from '../../utils/helpers.js';
import * as companyService from '../company/company.service.js';
import * as destinationService from '../destination/destination.service.js';
import * as driverService from '../driver/driver.service.js';
import { listActive as listDocks } from '../dock/dock.service.js';
import { estimates } from './queue.estimate.js';
import { STATUS_TH, STAFF_STEPS, LATE_MINUTES } from './queue.status.js';

const logEvent = (conn, queueId, action, dockId = null, meta = null) =>
  conn.query('INSERT INTO queue_event (queue_id, action, dock_id, meta) VALUES (?, ?, ?, ?)',
    [queueId, action, dockId, meta ? JSON.stringify(meta) : null]);

/* ---------- ฝั่งคนขับ ---------- */

/** ลงทะเบียนรับคิว → { id, token, queue_no } */
export async function register({ phone, firstName, lastName, companyId, plate, trailer, destinationId, source = 'driver' }) {
  return tx(async (c) => {
    await companyService.assertActive(c, companyId);
    await destinationService.assertActive(c, destinationId);

    // ทะเบียนหัวเดียวกันมีคิวที่ยังไม่จบได้คิวเดียว (ทะเบียนถูกจัดรูปเป็น 70-1234 แล้วที่ controller)
    const [[dup]] = await c.query(
      `SELECT queue_no FROM queue WHERE plate_no = ? AND status IN ('waiting','called','loading') FOR UPDATE`, [plate]);
    if (dup) throw new AppError(`ทะเบียนนี้มีคิว ${dup.queue_no} ที่ยังไม่เสร็จอยู่แล้ว`, 409);

    const driverId = await driverService.upsertForQueue(c, { phone, firstName, lastName, companyId });

    const token = newToken();
    const [ins] = await c.query(
      `INSERT INTO queue (queue_date, access_token, driver_id, first_name, last_name, phone, company_id,
                          plate_no, trailer_plate, destination_id, status, sort_order, registered_at)
       VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(3), NOW(3))`,
      [token, driverId, firstName, lastName, phone, companyId, plate, trailer, destinationId]);
    const queueNo = String(ins.insertId).padStart(4, '0');
    await c.query('UPDATE queue SET queue_no = ? WHERE id = ?', [queueNo, ins.insertId]);
    await logEvent(c, ins.insertId, 'register', null, { source });   // source: driver = คนขับจองเอง, staff = พนักงานจองให้
    return { id: ins.insertId, token, queue_no: queueNo };
  });
}

/** สถานะคิวของคนขับ (ต้องมี token ที่ได้ตอนลงทะเบียน) */
export async function getForDriver(id, token) {
  const [[q]] = await pool.query(
    `SELECT q.id, q.queue_no, q.access_token, q.first_name, q.last_name,
            q.plate_no, q.trailer_plate, ds.destination, q.status,
            q.registered_at, q.called_at, q.loading_started_at, q.loading_finished_at, q.exited_at,
            c.company_name, d.dock_name
       FROM queue q
       JOIN company c ON c.id = q.company_id
       LEFT JOIN dock d ON d.id = q.dock_id
       LEFT JOIN destination ds ON ds.id = q.destination_id
      WHERE q.id = ?`, [id]);
  if (!q || !sameToken(q.access_token, token)) throw new AppError('ไม่พบคิวนี้', 404);

  const { access_token, ...out } = q;
  if (q.status === 'waiting') {
    const est = await estimates();
    out.ahead = est.ahead[q.id] ?? 0;
    out.estimated_call_at = est.callAt[q.id] ?? null;
  }
  return out;
}

/** คนขับยกเลิกคิวเอง (ได้เฉพาะตอนยังรอคิว) */
export async function cancelByDriver(id, token) {
  await tx(async (c) => {
    const [[q]] = await c.query('SELECT status, access_token FROM queue WHERE id = ? FOR UPDATE', [id]);
    if (!q || !sameToken(q.access_token, token)) throw new AppError('ไม่พบคิวนี้', 404);
    if (q.status !== 'waiting') throw new AppError('ยกเลิกได้เฉพาะคิวที่ยังไม่ถูกเรียก', 409);
    await c.query("UPDATE queue SET status = 'cancelled' WHERE id = ?", [id]);
    await logEvent(c, id, 'cancel');
  });
}

/* ---------- ฝั่งพนักงาน ---------- */

const BOARD_COLS = `q.id, q.queue_no, q.first_name, q.last_name, q.phone, c.company_name,
                    q.plate_no, q.trailer_plate, ds.destination, q.dock_id, q.status,
                    q.registered_at, q.called_at, q.loading_started_at, q.loading_finished_at`;
const BOARD_FROM = `FROM queue q JOIN company c ON c.id = q.company_id LEFT JOIN destination ds ON ds.id = q.destination_id`;

/** สถานะทุกจุดรับสินค้า + คิวที่รอ (พร้อมเวลาที่คาดว่าจะเรียก) + คิวที่โหลดเสร็จรอบันทึกออก */
export async function board() {
  const docks = await listDocks();
  const [active] = await pool.query(`SELECT ${BOARD_COLS} ${BOARD_FROM} WHERE q.status IN ('called','loading')`);
  const [waiting] = await pool.query(`SELECT ${BOARD_COLS} ${BOARD_FROM} WHERE q.status = 'waiting' ORDER BY q.sort_order`);
  const [done] = await pool.query(`SELECT ${BOARD_COLS} ${BOARD_FROM} WHERE q.status = 'done' ORDER BY q.loading_finished_at`);
  const est = await estimates();
  return {
    server_time: new Date().toISOString(),   // ให้หน้าจอปรับนาฬิกาให้ตรงกับเซิร์ฟเวอร์ (ตัวจับเวลาจะได้ไม่เพี้ยน)
    late_minutes: LATE_MINUTES,
    docks: docks.map((d) => ({ ...d, current: active.find((a) => a.dock_id === d.id) || null })),
    waiting: waiting.map((w) => ({ ...w, estimated_call_at: est.callAt[w.id] ?? null })),
    done,
  };
}

/**
 * เรียกคิวถัดไปเข้าจุดรับสินค้า (จุดนั้นต้องว่าง)
 * รถทุกคันเข้าได้ทุกจุด: จุดไหนว่างก่อนก็เรียกคันที่รอนานสุดตามลำดับคิว
 */
export async function callNext(dockId) {
  return tx(async (c) => {
    const [[dock]] = await c.query('SELECT id FROM dock WHERE id = ? AND is_active = 1 FOR UPDATE', [dockId]);
    if (!dock) throw new AppError('ไม่พบจุดรับสินค้านี้', 404);
    const [[busy]] = await c.query("SELECT queue_no FROM queue WHERE dock_id = ? AND status IN ('called','loading')", [dockId]);
    if (busy) throw new AppError(`จุดรับสินค้านี้ยังมีคิว ${busy.queue_no} อยู่`, 409);
    const [[next]] = await c.query("SELECT id, queue_no FROM queue WHERE status = 'waiting' ORDER BY sort_order LIMIT 1 FOR UPDATE");
    if (!next) throw new AppError('ไม่มีรถรอคิว', 409);
    await c.query("UPDATE queue SET status = 'called', dock_id = ?, called_at = NOW(3) WHERE id = ?", [dockId, next.id]);
    await logEvent(c, next.id, 'call', dockId);
    return { ok: true, queue_id: next.id, queue_no: next.queue_no };
  });
}

/** เปลี่ยนสถานะตามขั้นใน STAFF_STEPS (start / finish / exit / skip / cancel) */
export async function applyStep(id, stepName) {
  const step = STAFF_STEPS[stepName];
  if (!step) throw new AppError('ไม่รู้จักขั้นตอนนี้', 404);
  await tx(async (c) => {
    const [[q]] = await c.query('SELECT status, dock_id FROM queue WHERE id = ? FOR UPDATE', [id]);
    if (!q) throw new AppError('ไม่พบคิวนี้', 404);
    if (!step.from.includes(q.status)) throw new AppError(`ทำไม่ได้ คิวนี้อยู่ในสถานะ "${STATUS_TH[q.status]}"`, 409);
    await c.query(`UPDATE queue SET ${step.set} WHERE id = ?`, [id]);
    await logEvent(c, id, stepName, q.dock_id);
  });
}
