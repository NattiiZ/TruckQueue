// รวมเส้นทาง API ทั้งหมดไว้ที่เดียว: ดูไฟล์นี้ไฟล์เดียวก็รู้ว่าระบบมี API อะไรบ้าง
import { Router } from 'express';
import { pool } from '../config/database.js';
import { asyncHandler } from '../utils/helpers.js';
import { requireStaff } from '../middlewares/requireStaff.js';
import { companyRoutes } from '../modules/company/company.routes.js';
import { destinationRoutes } from '../modules/destination/destination.routes.js';
import { driverRoutes, driverStaffRoutes } from '../modules/driver/driver.routes.js';
import { queueRoutes, queueStaffRoutes } from '../modules/queue/queue.routes.js';
import { dockStaffRoutes } from '../modules/dock/dock.routes.js';
import { reportStaffRoutes } from '../modules/report/report.routes.js';
import { analyticsStaffRoutes } from '../modules/analytics/analytics.routes.js';

export const apiRoutes = Router();

apiRoutes.get('/health', asyncHandler(async (req, res) => {
  const [[row]] = await pool.query('SELECT NOW() AS now, DATABASE() AS db');
  res.json({ ok: true, db: row.db, db_time: row.now });
}));

// ---- ฝั่งคนขับ (ไม่ต้อง login) ----
apiRoutes.use('/companies', companyRoutes);         // GET  รายชื่อบริษัทขนส่ง
apiRoutes.use('/destinations', destinationRoutes);  // GET  รายการปลายทาง
apiRoutes.use('/drivers', driverRoutes);            // GET  /lookup?phone=
apiRoutes.use('/queues', queueRoutes);              // POST ลงทะเบียน · GET สถานะ · POST /:id/cancel

// ---- ฝั่งพนักงาน (ผ่าน requireStaff ก่อนทุกเส้น) ----
const staff = Router();
staff.use(requireStaff);
staff.use('/', dockStaffRoutes);            // GET /board · POST /docks/:id/call-next
staff.use('/', reportStaffRoutes);          // GET /dashboard
staff.use('/', analyticsStaffRoutes);       // GET /analytics?days=
staff.use('/queues', queueStaffRoutes);     // POST /queues/:id/start|finish|exit|skip|cancel
staff.use('/drivers', driverStaffRoutes);   // PATCH /drivers/:id/status
apiRoutes.use('/staff', staff);
