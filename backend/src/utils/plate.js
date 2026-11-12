// ทะเบียนรถบรรทุก: เลขหมวด 2 หลัก - เลขทะเบียน 1–4 หลัก เช่น 70-1234 (ไม่รวมจังหวัด)
// หน้าเว็บใช้กติกาเดียวกันที่ frontend/shared/plate.js ถ้าแก้ที่นี่ต้องแก้ที่นั่นด้วย

export const PLATE_PATTERN = /^\d{2}-\d{1,4}$/;
export const PLATE_EXAMPLE = '70-1234';

/** จัดรูปให้เป็นแบบเดียวกัน: '701234' / '70 1234' / '70-1234' → '70-1234' */
export function normalizePlate(input) {
  const s = String(input ?? '').replace(/[\s-]/g, '');
  return /^\d{3,6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : s;
}

export const isValidPlate = (plate) => PLATE_PATTERN.test(plate);
