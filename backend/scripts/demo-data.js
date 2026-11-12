// ข้อมูลตัวอย่างย้อนหลัง สำหรับดูหน้าวิเคราะห์ระหว่างพัฒนา — ไม่ใช่ข้อมูลจริง
//   npm run db:demo                 เพิ่มรถตัวอย่างย้อนหลัง 30 วัน (สถานะ "ออกแล้ว" ทั้งหมด ไม่กระทบคิววันนี้)
//   npm run db:demo -- --remove     ลบข้อมูลตัวอย่างออกทั้งหมด
// ข้อมูลตัวอย่างแยกได้ชัด: คนขับเบอร์ขึ้นต้น 0990000 · ปลายทางชื่อขึ้นต้น "ตัวอย่าง: " (ปิดใช้งาน คนขับเลือกไม่ได้)
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const PHONE_PREFIX = '0990000';
const DEST_PREFIX = 'ตัวอย่าง: ';
const DAYS = 30;

const conn = await mysql.createConnection({ ...env.db, charset: 'utf8mb4', timezone: '+07:00' });
await conn.query("SET time_zone = '+07:00'");

async function remove() {
  const like = PHONE_PREFIX + '%';
  await conn.query('DELETE e FROM queue_event e JOIN queue q ON q.id = e.queue_id WHERE q.phone LIKE ?', [like]);
  const [q] = await conn.query('DELETE FROM queue WHERE phone LIKE ?', [like]);
  const [d] = await conn.query('DELETE FROM driver WHERE phone LIKE ?', [like]);
  const [ds] = await conn.query('DELETE FROM destination WHERE destination LIKE ? AND id NOT IN (SELECT destination_id FROM queue)', [DEST_PREFIX + '%']);
  for (const t of ['queue', 'queue_event', 'driver', 'destination']) await conn.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
  console.log(`✔ ลบข้อมูลตัวอย่าง: คิว ${q.affectedRows}, คนขับ ${d.affectedRows}, ปลายทาง ${ds.affectedRows}`);
}

async function add() {
  const [[exists]] = await conn.query('SELECT COUNT(*) n FROM queue WHERE phone LIKE ?', [PHONE_PREFIX + '%']);
  if (exists.n) { console.log('มีข้อมูลตัวอย่างอยู่แล้ว · ลบก่อนด้วย npm run db:demo -- --remove'); return; }

  let seed = 20261112; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / 0.707; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pickW = (items) => { let r = rnd() * items.reduce((a, x) => a + x.w, 0); for (const x of items) { r -= x.w; if (r <= 0) return x; } return items[0]; };

  const [companies] = await conn.query('SELECT id FROM company WHERE is_active = 1');
  const [docks] = await conn.query('SELECT id, std_minutes FROM dock WHERE is_active = 1 ORDER BY sort_order, id');
  if (!companies.length || !docks.length) throw new Error('ต้องมีบริษัทและจุดรับสินค้าอย่างน้อยอย่างละ 1');

  // ปลายทางตัวอย่าง (is_active = 0 → ไม่ขึ้นในหน้าคนขับ)
  const destNames = [['DC ขอนแก่น', 5], ['DC ลำพูน', 3], ['DC ชลบุรี', 4], ['DC สุราษฎร์ธานี', 2], ['DC นครราชสีมา', 2]];
  for (const [n] of destNames) await conn.query('INSERT IGNORE INTO destination (destination, is_active) VALUES (?, 0)', [DEST_PREFIX + n]);
  const [destRows] = await conn.query('SELECT id, destination FROM destination WHERE destination LIKE ?', [DEST_PREFIX + '%']);
  const [[unspec]] = await conn.query("SELECT id FROM destination WHERE destination = 'ไม่ระบุ'");
  const dests = destRows.map((r) => ({ id: r.id, w: destNames.find(([n]) => DEST_PREFIX + n === r.destination)[1] }));
  if (unspec) dests.push({ id: unspec.id, w: 1 });

  // คนขับตัวอย่าง 24 คน
  const FIRST = ['สมชาย', 'ประยุทธ', 'วิชัย', 'บุญมี', 'ธนากร', 'ชาตรี', 'กิตติ', 'เอกชัย', 'พงษ์ศักดิ์', 'ณัฐพล', 'สุรชัย', 'อำนาจ'];
  const LAST = ['ใจดี', 'แก้วมณี', 'ทองคำ', 'ศรีสุข', 'มีสุข', 'บุญเรือง', 'ศักดิ์ดี', 'ทรัพย์มาก'];
  const drivers = [];
  for (let i = 1; i <= 24; i++) {
    const phone = PHONE_PREFIX + String(i).padStart(3, '0');
    const company = pick(companies).id;
    const [ins] = await conn.query('INSERT INTO driver (first_name, last_name, company, phone) VALUES (?, ?, ?, ?)', [pick(FIRST), pick(LAST), company, phone]);
    const [[row]] = await conn.query('SELECT first_name, last_name FROM driver WHERE id = ?', [ins.insertId]);
    drivers.push({ id: ins.insertId, phone, company, ...row, slow: rnd() < 0.2 });   // บางคนมาช้าหลังถูกเรียกบ่อย
  }

  const dockSpeed = docks.map((_, i) => [1.0, 1.15, 0.9, 1.05][i % 4]);   // แต่ละจุดเร็วช้าไม่เท่ากัน
  const MIN = 60000, rows = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let d = DAYS; d >= 1; d--) {
    const day0 = new Date(today.getTime() - d * 86400000);
    const dow = day0.getDay();
    if (dow === 0) continue;                                   // อาทิตย์ปิด
    const n = (dow === 6 ? 7 : dow === 1 ? 18 : 14) + Math.floor(rnd() * 7);   // จันทร์รถเยอะ เสาร์น้อย
    const arrivals = [];
    for (let i = 0; i < n; i++) {
      const peak = rnd() < 0.6 ? 9.5 * 60 : 13.5 * 60;
      arrivals.push(day0.getTime() + Math.min(16.8 * 60, Math.max(7.2 * 60, peak + gauss() * 55)) * MIN);
    }
    arrivals.sort((a, b) => a - b);
    const free = docks.map(() => day0.getTime() + 8 * 60 * MIN);
    const dateStr = `${day0.getFullYear()}-${String(day0.getMonth() + 1).padStart(2, '0')}-${String(day0.getDate()).padStart(2, '0')}`;
    for (const reg of arrivals) {
      let k = 0; free.forEach((f, j) => { if (f < free[k]) k = j; });
      const drv = pick(drivers);
      const called = Math.max(reg, free[k]);
      const toDock = (drv.slow && rnd() < 0.6 ? 12 + rnd() * 14 : 2 + rnd() * 7) * MIN;
      const start = called + toDock;
      const load = Math.max(10, docks[k].std_minutes * dockSpeed[k] + gauss() * docks[k].std_minutes * 0.2) * MIN;
      const finish = start + load;
      const exit = finish + (3 + rnd() * 9) * MIN;
      free[k] = finish + 3 * MIN;
      rows.push([dateStr, crypto.randomBytes(16).toString('hex'), drv.id, drv.first_name, drv.last_name, drv.phone, drv.company,
        `${70 + Math.floor(rnd() * 3)}-${1000 + Math.floor(rnd() * 9000)}`, `${71 + Math.floor(rnd() * 2)}-${1000 + Math.floor(rnd() * 9000)}`,
        pickW(dests).id, docks[k].id, 'exited', new Date(reg), new Date(reg), new Date(called), new Date(start), new Date(finish), new Date(exit)]);
    }
  }

  await conn.query(
    `INSERT INTO queue (queue_date, access_token, driver_id, first_name, last_name, phone, company_id, plate_no, trailer_plate,
                        destination_id, dock_id, status, sort_order, registered_at, called_at, loading_started_at, loading_finished_at, exited_at)
     VALUES ?`, [rows]);
  await conn.query("UPDATE queue SET queue_no = LPAD(id, 4, '0') WHERE queue_no IS NULL");
  console.log(`✔ เพิ่มรถตัวอย่าง ${rows.length} คัน ย้อนหลัง ${DAYS} วัน · ลบได้ด้วย npm run db:demo -- --remove`);
}

try {
  process.argv.includes('--remove') ? await remove() : await add();
} finally {
  await conn.end();
}
