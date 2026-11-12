import { Router } from 'express';
import { asyncHandler, digits } from '../../utils/helpers.js';
import { AppError } from '../../utils/AppError.js';
import * as driverService from './driver.service.js';

// ---- ฝั่งคนขับ: /api/drivers ----
// GET /api/drivers/lookup?phone=  กรอกเบอร์ → เติมชื่อ นามสกุล บริษัท
export const driverRoutes = Router()
  .get('/lookup', asyncHandler(async (req, res) => {
    const phone = digits(req.query.phone);
    if (phone.length < 9 || phone.length > 10) throw new AppError('เบอร์โทรไม่ถูกต้อง');
    res.json(await driverService.lookupByPhone(phone));
  }));

// ---- ฝั่งพนักงาน: /api/staff/drivers ----
// PATCH /api/staff/drivers/:id/status  { status: 'active' | 'inactive' }
export const driverStaffRoutes = Router()
  .patch('/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!driverService.DRIVER_STATUSES.includes(status)) throw new AppError("status ต้องเป็น 'active' หรือ 'inactive'");
    await driverService.setStatus(Number(req.params.id) || 0, status);
    res.json({ ok: true, status });
  }));
