// วิเคราะห์ข้อมูล (หน้า "วิเคราะห์แบบละเอียด") · ช่วง 1 วัน (วันนี้/วันที่เลือก) หรือย้อนหลัง 7/30/90 วัน
//   1) ปริมาณรถตามช่วงเวลา      — นับรถที่มาถึงตาม วัน × ชั่วโมง (0–23 น.)
//   2) สัดส่วนตามปลายทาง        — จำนวนคันต่อปลายทาง
//   3) ระยะเวลาแต่ละขั้นตอน      — รอคิว → เข้าจุดรับสินค้า → โหลด → รอออก (เฉพาะคันที่ออกแล้ว)
//   + การ์ดสรุป: รถที่ออกแล้ว, โหลดเกินมาตรฐาน · บริษัทขนส่ง · จำนวนรถที่ออกรายวัน
import { pool } from '../../config/database.js';

const PERIODS = [1, 7, 30, 90];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (v == null ? null : Number(v));

export async function overview(daysInput, dateInput) {
  const date = DATE_RE.test(dateInput || '') ? dateInput : null;     // เลือกวันเดียว (ส่งมาพร้อม days=1)
  const days = date ? 1 : PERIODS.includes(daysInput) ? daysInput : 30;
  const end = date ? 'CAST(? AS DATE)' : 'CURDATE()';
  const endP = date ? [date] : [];
  const range = `q.queue_date BETWEEN ${end} - INTERVAL ? DAY AND ${end}`;
  const p = [...endP, days - 1, ...endP];

  const [[sum]] = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT q.queue_date) AS op_days, COUNT(q.exited_at) AS exited,
            DATE_FORMAT(${end} - INTERVAL ? DAY, '%Y-%m-%d') AS from_date, DATE_FORMAT(${end}, '%Y-%m-%d') AS to_date
       FROM queue q WHERE ${range} AND q.status <> 'cancelled'`, [...endP, days - 1, ...endP, ...p]);

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

  // รถที่ออกจากคลังแล้ว: โหลดเกินเวลามาตรฐานของจุดนั้นกี่คัน
  const [[over]] = await pool.query(
    `SELECT COUNT(*) AS n FROM queue q JOIN dock d ON d.id = q.dock_id
      WHERE ${range} AND q.exited_at IS NOT NULL
        AND TIMESTAMPDIFF(SECOND, q.loading_started_at, q.loading_finished_at) > d.std_minutes * 60`, p);

  // จำนวนรถที่ออกแล้วรายวัน (กราฟแนวโน้ม + วันที่รถมากที่สุด)
  const [daily] = await pool.query(
    `SELECT DATE_FORMAT(q.queue_date, '%Y-%m-%d') AS d, COUNT(*) AS n
       FROM queue q WHERE ${range} AND q.exited_at IS NOT NULL
      GROUP BY q.queue_date ORDER BY q.queue_date`, p);

  const [companies] = await pool.query(
    `SELECT c.company_name AS name, COUNT(*) AS n
       FROM queue q JOIN company c ON c.id = q.company_id
      WHERE ${range} AND q.status <> 'cancelled'
      GROUP BY c.id, c.company_name ORDER BY n DESC`, p);

  return {
    days,
    from: sum.from_date,
    to: sum.to_date,
    total: num(sum.total),
    op_days: num(sum.op_days),
    exited: num(sum.exited),
    peak: peak.map((r) => ({ wd: num(r.wd), hour: num(r.hour), n: num(r.n) })),
    weekday_days: wdDays.map((r) => ({ wd: num(r.wd), days: num(r.days) })),
    over_std: num(over.n),
    daily: daily.map((r) => ({ date: r.d, n: num(r.n) })),
    destinations: destinations.map((r) => ({ name: r.name, n: num(r.n) })),
    companies: companies.map((r) => ({ name: r.name, n: num(r.n) })),
    stages: stages.map((r) => ({
      dock_id: r.dock_id, dock_name: r.dock_name, n: num(r.n),
      wait: num(r.wait), to_dock: num(r.to_dock), loading: num(r.loading), exit_wait: num(r.exit_wait),
    })),
  };
}
