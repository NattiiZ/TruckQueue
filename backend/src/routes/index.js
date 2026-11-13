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
import * as pushService from '../modules/push/push.service.js';


export const apiRoutes = Router();


// ---- Dashboard health check ----
apiRoutes.get('/health', asyncHandler(async (req, res) => 
{
  const [[row]] = await pool.query('SELECT NOW() AS now, DATABASE() AS db');
  res.json({ ok: true, db: row.db, db_time: row.now });
}));


// ---- Driver ----
apiRoutes.use('/companies', companyRoutes);         // GET
apiRoutes.use('/destinations', destinationRoutes);  // GET
apiRoutes.use('/drivers', driverRoutes);            // GET  (/lookup?phone=)
apiRoutes.use('/queues', queueRoutes);              // POST (Register)  |  GET (Status)  |  POST (/:id/cancel|push|ack)
apiRoutes.get('/push/public-key', (req, res) => res.json({ publicKey: pushService.publicKey() }));  // GET (Web Push key)


// ---- Staff ----
const staff = Router();

staff.use(requireStaff);
staff.use('/', dockStaffRoutes);            // GET (/board)  |  POST (/docks/:id/call-next)
staff.use('/', reportStaffRoutes);          // GET (/dashboard)
staff.use('/', analyticsStaffRoutes);       // GET (/analytics?days=)
staff.use('/queues', queueStaffRoutes);     // POST (/queues/:id/start|finish|exit|skip|cancel)
staff.use('/drivers', driverStaffRoutes);   // PATCH (/drivers/:id/status)

apiRoutes.use('/staff', staff);
