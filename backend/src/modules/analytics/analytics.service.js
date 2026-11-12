// วิเคราะห์ข้อมูลย้อนหลัง (หน้า "วิเคราะห์แบบละเอียด")
//   1) ช่วงเวลาที่รถเยอะ   — นับรถที่มาถึงตาม วัน × ชั่วโมง แล้วเฉลี่ยต่อวันทำการ
//   2) ส่งไปไหน           — จำนวนคันต่อปลายทาง
//   3) เวลาหายไปไหน       — เวลาเฉลี่ยแต่ละช่วง: รอคิว → เข้าจุดรับสินค้า → โหลด → รอออก (เฉพาะคันที่ออกแล้ว)
import { pool } from '../../config/database.js';

const PERIODS = [7, 30, 90];
const num = (v) => (v == null ? null : Number(v));

export async function overview(daysInput) {
  const days = PERIODS.includes(daysInput) ? daysInput : 30;
  const range = 'q.queue_date >= CURDATE() - INTERVAL ? DAY';
  const p = [days - 1];

  const [[sum]] = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT q.queue_date) AS op_days,
            DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d') AS from_date, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS to_date
       FROM queue q WHERE ${range} AND q.status <> 'cancelled'`, [days - 1, ...p]);

  // วัน (0 = จันทร์ … 6 = อาทิตย์) × ชั่วโมง
  const [peak] = await pool.query(
    `SELECT WEEKDAY(q.registered_at) AS wd, HOUR(q.registered_at) AS hour, COUNT(*) AS n
       FROM queue q WHERE ${range} AND q.status <> 'cancelled'
      GROUP BY WEEKDAY(q.registered_at), HOUR(q.registered_at)`, p);
  // แต่ละวันในสัปดาห์มีวันทำการกี่วัน (ใช้หารเป็นค่าเฉลี่ยต่อวัน)
  const [wdDays] = await pool.query(
    `SELECT WEEKDAY(q.queue_date) AS wd, COUNT(DISTINCT q.queue_date) AS days
       FROM queue q WHERE ${range} AND q.status <> 'cancelled' GROUP BY WEEKDAY(q.queue_date)`, p);

  const [destinations] = await pool.query(
    `SELECT COALESCE(ds.destination, 'ไม่ระบุ') AS name, COUNT(*) AS n
       FROM queue q LEFT JOIN destination ds ON ds.id = q.destination_id
      WHERE ${range} AND q.status <> 'cancelled'
      GROUP BY COALESCE(ds.destination, 'ไม่ระบุ') ORDER BY n DESC`, p);

  const [stages] = await pool.query(
    `SELECT q.dock_id, d.dock_name, COUNT(*) AS n,
            AVG(TIMESTAMPDIFF(SECOND, q.registered_at, q.called_at)) / 60          AS wait,
            AVG(TIMESTAMPDIFF(SECOND, q.called_at, q.loading_started_at)) / 60     AS to_dock,
            AVG(TIMESTAMPDIFF(SECOND, q.loading_started_at, q.loading_finished_at)) / 60 AS loading,
            AVG(TIMESTAMPDIFF(SECOND, q.loading_finished_at, q.exited_at)) / 60    AS exit_wait
       FROM queue q JOIN dock d ON d.id = q.dock_id
      WHERE ${range} AND q.exited_at IS NOT NULL
      GROUP BY q.dock_id, d.dock_name, d.sort_order ORDER BY d.sort_order, q.dock_id`, p);

  return {
    days,
    from: sum.from_date,
    to: sum.to_date,
    total: num(sum.total),
    op_days: num(sum.op_days),
    peak: peak.map((r) => ({ wd: num(r.wd), hour: num(r.hour), n: num(r.n) })),
    weekday_days: wdDays.map((r) => ({ wd: num(r.wd), days: num(r.days) })),
    destinations: destinations.map((r) => ({ name: r.name, n: num(r.n) })),
    stages: stages.map((r) => ({
      dock_id: r.dock_id, dock_name: r.dock_name, n: num(r.n),
      wait: num(r.wait), to_dock: num(r.to_dock), loading: num(r.loading), exit_wait: num(r.exit_wait),
    })),
  };
}
