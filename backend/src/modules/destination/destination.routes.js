import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as destinationService from './destination.service.js';

// GET /api/destinations  รายการปลายทางที่เปิดใช้งาน
export const destinationRoutes = Router()
  .get('/', asyncHandler(async (req, res) => res.json(await destinationService.listActive())));
