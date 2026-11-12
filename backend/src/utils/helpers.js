import crypto from 'node:crypto';

/** ห่อ handler แบบ async ให้ error ไหลไปที่ errorHandler อัตโนมัติ */
export const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** เหลือแต่ตัวเลข เช่น '081-234-5678' → '0812345678' */
export const digits = (s) => String(s ?? '').replace(/\D/g, '');

/** ตัดช่องว่างหัวท้าย และยุบช่องว่างซ้อนเหลือช่องเดียว */
export const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

/** token สุ่มสำหรับให้คนขับดูคิวของตัวเอง */
export const newToken = () => crypto.randomBytes(16).toString('hex');

/** เทียบ token แบบใช้เวลาเท่ากันเสมอ (กันการเดา token จากเวลาตอบกลับ) */
export const sameToken = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
