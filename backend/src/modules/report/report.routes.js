import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as reportService from './report.service.js';

// ---- ฝั่งพนักงาน: /api/staff ----
// GET /api/staff/dashboard   ภาพรวมวันนี้ (จำนวนรถ, เวลาเฉลี่ย, แยกจุดรับสินค้า, รายชั่วโมง)
export const reportStaffRoutes = Router()
  .get('/dashboard', asyncHandler(async (req, res) => res.json(await reportService.today())));
