// log ทุกคำขอ: ดูได้ว่าเครื่องไหนเรียกอะไร (ช่วยหาสาเหตุเวลามือถือเปิดไม่ได้)
export function requestLogger(req, res, next) {
  const t = new Date().toLocaleTimeString('th-TH');
  res.on('finish', () => console.log(`${t} ${req.ip.replace('::ffff:', '')} ${req.method} ${req.originalUrl} → ${res.statusCode}`));
  next();
}
