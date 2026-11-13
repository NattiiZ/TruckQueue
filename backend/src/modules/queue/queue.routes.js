import { Router } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import * as ctrl from './queue.controller.js';

// ---- ฝั่งคนขับ: /api/queues ----
export const queueRoutes = Router()
  .post('/', asyncHandler(ctrl.register))               // ลงทะเบียนรับคิว
  .get('/:id', asyncHandler(ctrl.getForDriver))          // ดูสถานะคิว (?token=)
  .post('/:id/cancel', asyncHandler(ctrl.cancelByDriver))  // ยกเลิกคิวเอง
  .post('/:id/push', asyncHandler(ctrl.subscribePush))     // สมัครรับแจ้งเตือนถึงคิว (Web Push)
  .post('/:id/ack', asyncHandler(ctrl.acknowledge));       // กด "รับทราบ" ว่าถึงคิวแล้ว

// ---- ฝั่งพนักงาน: /api/staff/queues ----
// POST /api/staff/queues/:id/start|finish|exit|skip|cancel  (ลำดับขั้นดูที่ queue.status.js)
export const queueStaffRoutes = Router()
  .post('/:id/:step(start|finish|exit|skip|cancel)', asyncHandler(ctrl.applyStep));
