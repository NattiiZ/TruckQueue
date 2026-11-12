import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as analyticsService from './analytics.service.js';

// ---- ฝั่งพนักงาน: /api/staff ----
// GET /api/staff/analytics?days=7|30|90   ช่วงเวลาที่รถเยอะ · ส่งไปไหน · เวลาหายไปไหน
export const analyticsStaffRoutes = Router()
  .get('/analytics', asyncHandler(async (req, res) => res.json(await analyticsService.overview(Number(req.query.days)))));
