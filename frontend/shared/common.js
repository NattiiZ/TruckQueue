// โค้ดที่ทุกหน้าใช้ร่วมกัน (หน้าคนขับ หน้าพนักงาน หน้าวิเคราะห์) · เรียกใช้ผ่าน window.TQ
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digits = (s) => String(s ?? '').replace(/\D/g, '');
  const hhmm = (t) => (t ? new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '–');

  /** localStorage ที่ไม่ error แม้เบราว์เซอร์บล็อกไว้ */
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } },
  };

  /** เรียก API (หน้าเว็บกับ API อยู่เซิร์ฟเวอร์เดียวกัน) · error มี .status หรือ .network */
  async function api(path, options = {}) {
    let res;
    try { res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options }); }
    catch (e) { throw Object.assign(new Error('เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'), { network: true }); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'ระบบขัดข้อง ลองใหม่อีกครั้ง'), { status: res.status });
    return data;
  }

  /* ---------- ทะเบียนรถ: เลขหมวด 2 หลัก - เลขทะเบียน 1–4 หลัก เช่น 70-1234 ----------
     กติกาเดียวกับ backend/src/utils/plate.js ถ้าแก้ที่นี่ต้องแก้ที่นั่นด้วย */
  const PLATE_PATTERN = /^\d{2}-\d{1,4}$/;
  const plate = {
    example: '70-1234',
    /** ใส่ขีดให้เองระหว่างพิมพ์: '701234' → '70-1234' */
    format: (s) => { const d = digits(s).slice(0, 6); return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d; },
    isValid: (s) => PLATE_PATTERN.test(s),
    /** แสดงทะเบียนหัวกับหางคู่กัน: '70-1234 | 71-5678' */
    pair: (q) => [q.plate_no, q.trailer_plate].filter(Boolean).join(' | '),
    /** ผูกกับช่องกรอก: แป้นตัวเลข + ใส่ขีดให้อัตโนมัติ */
    bind: (input) => {
      input.inputMode = 'numeric';
      input.maxLength = 7;
      input.placeholder = plate.example;
      input.addEventListener('input', () => { input.value = plate.format(input.value); });
    },
  };

  window.TQ = { esc, digits, hhmm, store, api, plate };
})();
