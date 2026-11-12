// ประมาณเวลาที่แต่ละคิวจะถูกเรียก (baseline)
// วิธี: ดูว่าแต่ละจุดรับสินค้าจะว่างเมื่อไร จากเวลาโหลดเฉลี่ยวันนี้ของจุดนั้น (ถ้ายังไม่มีใช้เวลามาตรฐาน)
//       + เวลาที่คนขับใช้เข้าจุดรับสินค้าหลังถูกเรียก แล้วไล่ลงคิวทีละคันตามลำดับ
// ภายหลังแทนด้วยโมเดล ML ที่เทรนจากข้อมูลย้อนหลังได้ โดยคงรูปแบบผลลัพธ์เดิม { ahead, callAt }
import { pool } from '../../config/database.js';
import { listActive as listDocks } from '../dock/dock.service.js';

const MIN = 60000;

export async function estimates(db = pool) {
  const docks = await listDocks(db);
  const [waiting] = await db.query("SELECT id FROM queue WHERE status = 'waiting' ORDER BY sort_order");
  const ahead = {}, callAt = {};
  waiting.forEach((w, i) => { ahead[w.id] = i; });
  if (!docks.length) return { ahead, callAt };

  const [active] = await db.query(
    "SELECT dock_id, status, called_at, loading_started_at FROM queue WHERE status IN ('called','loading')");
  const [loads] = await db.query(
    `SELECT dock_id, AVG(TIMESTAMPDIFF(SECOND, loading_started_at, loading_finished_at)) / 60 AS m
       FROM queue WHERE queue_date = CURDATE() AND loading_finished_at IS NOT NULL GROUP BY dock_id`);
  const [[resp]] = await db.query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, called_at, loading_started_at)) / 60 AS m
       FROM queue WHERE queue_date = CURDATE() AND loading_started_at IS NOT NULL`);

  const now = Date.now();
  const respMin = resp?.m != null ? Number(resp.m) : 5;
  const loadOf = (dockId) => {
    const row = loads.find((l) => l.dock_id === dockId);
    return row?.m != null ? Number(row.m) : docks.find((d) => d.id === dockId).std_minutes;
  };

  const free = docks.map((d) => {
    const q = active.find((a) => a.dock_id === d.id);
    const load = loadOf(d.id);
    if (!q) return now;
    if (q.status === 'called') return now + (Math.max(1, respMin - (now - q.called_at) / MIN) + load) * MIN;
    return now + Math.max(3, load - (now - q.loading_started_at) / MIN) * MIN;
  });

  waiting.forEach((w) => {
    let k = 0;
    free.forEach((f, j) => { if (f < free[k]) k = j; });
    callAt[w.id] = new Date(free[k]).toISOString();
    free[k] += (respMin + loadOf(docks[k].id)) * MIN;
  });
  return { ahead, callAt };
}
