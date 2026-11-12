// error ที่ตั้งใจส่งกลับให้ผู้ใช้ (เช่น กรอกข้อมูลไม่ครบ, คิวซ้ำ) พร้อม HTTP status
// โยนจาก service ได้เลย errorHandler จะแปลงเป็น JSON { error, code } ให้
export class AppError extends Error {
  constructor(message, status = 400, code = undefined) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
