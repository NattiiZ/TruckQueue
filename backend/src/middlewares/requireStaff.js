// ด่านตรวจสิทธิ์ของ API ฝั่งพนักงาน (/api/staff/*)
// TODO: ยังไม่มีระบบ login ตอนนี้ปล่อยผ่านทุกคำขอ — ต้องทำก่อนเปิดใช้งานจริง
//       เช่น ตรวจ session / JWT แล้วใส่ req.user = { id, role }
export function requireStaff(req, res, next) {
  next();
}
