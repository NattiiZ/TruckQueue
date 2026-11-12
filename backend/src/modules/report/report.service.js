// สรุปตัวเลข (Dashboard) — คำนวณจากเวลาที่บันทึกในตาราง queue
//   รอคิว = called_at − registered_at · เวลาโหลด = loading_finished_at − loading_started_at
import { pool } from '../../config/database.js';
import { listActive as listDocks } from '../dock/dock.service.js';

const n = (v) => (v == null ? null : Number(v));

/** ภาพรวมวันนี้ */
export async function today() {
  const docks = await listDocks();

  const [[c]] = await pool.query(`
    SELECT COUNT(*) AS registered,
           SUM(status = 'waiting') AS waiting, SUM(status = 'called') AS called, SUM(status = 'loading') AS loading,
           SUM(status = 'done') AS done, SUM(status = 'exited') AS exited, SUM(status = 'cancelled') AS cancelled,
           AVG(CASE WHEN called_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, registered_at, called_at) END) / 60 AS avg_wait_min,
           AVG(CASE WHEN loading_finished_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, loading_started_at, loading_finished_at) END) / 60 AS avg_load_min
      FROM queue WHERE queue_date = CURDATE()`);

  const [[oldest]] = await pool.query("SELECT MIN(registered_at) AS at FROM queue WHERE status = 'waiting'");

  const [perDock] = await pool.query(`
    SELECT q.dock_id, COUNT(*) AS n,
           AVG(TIMESTAMPDIFF(SECOND, q.loading_started_at, q.loading_finished_at)) / 60 AS avg_load_min,
           SUM(TIMESTAMPDIFF(SECOND, q.loading_started_at, q.loading_finished_at) / 60 > d.std_minutes) AS over_std
      FROM queue q JOIN dock d ON d.id = q.dock_id
     WHERE q.queue_date = CURDATE() AND q.loading_finished_at IS NOT NULL
     GROUP BY q.dock_id`);

  // รถที่มาถึงแต่ละชั่วโมง แยกตามจุดรับสินค้า (dock_id = null คือยังรอคิว)
  const [hourly] = await pool.query(`
    SELECT HOUR(registered_at) AS hour, dock_id, COUNT(*) AS n
      FROM queue WHERE queue_date = CURDATE() AND status <> 'cancelled'
     GROUP BY HOUR(registered_at), dock_id`);

  return {
    server_time: new Date().toISOString(),
    counts: {
      registered: n(c.registered), waiting: n(c.waiting) || 0, called: n(c.called) || 0, loading: n(c.loading) || 0,
      done: n(c.done) || 0, exited: n(c.exited) || 0, cancelled: n(c.cancelled) || 0,
    },
    avg_wait_min: n(c.avg_wait_min),
    avg_load_min: n(c.avg_load_min),
    oldest_waiting_at: oldest.at,
    docks: docks.map((d) => {
      const s = perDock.find((p) => p.dock_id === d.id);
      return { ...d, loaded: s ? n(s.n) : 0, avg_load_min: s ? n(s.avg_load_min) : null, over_std: s ? n(s.over_std) : 0 };
    }),
    hourly: hourly.map((h) => ({ hour: n(h.hour), dock_id: h.dock_id, n: n(h.n) })),
  };
}
