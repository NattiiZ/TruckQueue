import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as queueService from '../queue/queue.service.js';

// ---- ฝั่งพนักงาน: /api/staff ----
// GET  /api/staff/board                  สถานะทุกจุดรับสินค้า + คิวที่รอ + คิวที่โหลดเสร็จรอออก
// POST /api/staff/docks/:id/call-next    เรียกคิวถัดไปเข้าจุดรับสินค้านี้
export const dockStaffRoutes = Router()
  .get('/board', asyncHandler(async (req, res) => res.json(await queueService.board())))
  .post('/docks/:id/call-next', asyncHandler(async (req, res) => {
    res.json(await queueService.callNext(Number(req.params.id) || 0));
  }));
