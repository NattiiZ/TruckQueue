// รับคำขอ HTTP → ตรวจ/จัดรูปข้อมูล → เรียก queue.service → ส่ง JSON กลับ
import { AppError } from '../../utils/AppError.js';
import { clean, digits } from '../../utils/helpers.js';
import { normalizePlate, isValidPlate, PLATE_EXAMPLE } from '../../utils/plate.js';
import * as queueService from './queue.service.js';

/** POST /api/queues  { phone, first_name, last_name, company_id, plate_no, trailer_plate, destination_id } — บังคับทุกช่อง */
export async function register(req, res) {
  const b = req.body;
  const input = {
    phone: digits(b.phone),
    firstName: clean(b.first_name),
    lastName: clean(b.last_name),
    companyId: Number(b.company_id),
    plate: normalizePlate(b.plate_no),          // ทะเบียนหัว
    trailer: normalizePlate(b.trailer_plate),   // ทะเบียนหาง
    destinationId: Number(b.destination_id) || 0,  // ปลายทาง (ถ้าไม่รู้ให้เลือก "ไม่ระบุ")
    source: b.source === 'staff' ? 'staff' : 'driver', // คนขับจองเอง หรือพนักงานจองให้ที่เคาน์เตอร์
  };
  if (input.phone.length < 9 || input.phone.length > 10) throw new AppError('กรุณากรอกเบอร์โทรให้ถูกต้อง');
  if (!input.firstName) throw new AppError('กรุณากรอกชื่อ');
  if (!input.lastName) throw new AppError('กรุณากรอกนามสกุล');
  if (input.firstName.length > 100 || input.lastName.length > 100) throw new AppError('ชื่อหรือนามสกุลยาวเกินไป');
  if (!input.companyId) throw new AppError('กรุณาเลือกบริษัทขนส่ง');
  if (!isValidPlate(input.plate)) throw new AppError(`กรุณากรอกทะเบียนหัวให้ถูกรูปแบบ เช่น ${PLATE_EXAMPLE}`);
  if (!isValidPlate(input.trailer)) throw new AppError(`กรุณากรอกทะเบียนหางให้ถูกรูปแบบ เช่น ${PLATE_EXAMPLE}`);
  if (!input.destinationId) throw new AppError('กรุณาเลือกปลายทาง (ถ้าไม่ทราบ เลือก "ไม่ระบุ")');

  res.status(201).json(await queueService.register(input));
}

/** GET /api/queues/:id?token= */
export async function getForDriver(req, res) {
  res.json(await queueService.getForDriver(Number(req.params.id) || 0, String(req.query.token || '')));
}

/** POST /api/queues/:id/cancel  { token } */
export async function cancelByDriver(req, res) {
  await queueService.cancelByDriver(Number(req.params.id) || 0, String(req.body.token || ''));
  res.json({ ok: true });
}

/** POST /api/staff/queues/:id/:step  (start | finish | exit | skip | cancel) */
export async function applyStep(req, res) {
  await queueService.applyStep(Number(req.params.id) || 0, req.params.step);
  res.json({ ok: true });
}
