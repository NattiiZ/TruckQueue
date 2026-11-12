import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as companyService from './company.service.js';

// GET /api/companies  รายชื่อบริษัทขนส่งที่เปิดใช้งาน
export const companyRoutes = Router()
  .get('/', asyncHandler(async (req, res) => res.json(await companyService.listActive())));
