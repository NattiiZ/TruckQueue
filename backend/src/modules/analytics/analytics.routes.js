import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as analyticsService from './analytics.service.js';

// ---- ฝั่งพนักงาน: /api/staff ----
// GET /api/staff/analytics?days=1|7|30|90[&date=YYYY-MM-DD]   (date = ดูวันเดียว)
export const analyticsStaffRoutes = Router()
  .get('/analytics', asyncHandler(async (req, res) => res.json(await analyticsService.overview(Number(req.query.days), req.query.date))));
