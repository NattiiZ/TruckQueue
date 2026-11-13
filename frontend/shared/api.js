// รวมการเรียก API ทุกเส้นไว้ที่ไฟล์นี้ไฟล์เดียว (ใช้ axios)
// หน้าเว็บเรียกผ่าน window.TQ.api เช่น  const list = await api.getCompanies();
// ดูรายการ API ฝั่ง backend ได้ที่ backend/src/routes/index.js
(() => {
  // หน้าเว็บกับ API อยู่เซิร์ฟเวอร์เดียวกัน จึงใช้ '/api' ได้เลย
  const base_url = '/api';

  /** แปลง error ของ axios เป็นข้อความภาษาไทย · error มี .status (ตอบกลับมาแต่ไม่สำเร็จ) หรือ .network (ต่อไม่ติด) */
  function toError(err) {
    if (!err.response) {
      return Object.assign(new Error('เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'), { network: true });
    }
    const message = err.response.data?.error || 'ระบบขัดข้อง ลองใหม่อีกครั้ง';
    return Object.assign(new Error(message), { status: err.response.status });
  }

  async function get(path, params) {
    try {
      const res = await axios.get(base_url + path, { params });
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  }

  async function post(path, body) {
    try {
      const res = await axios.post(base_url + path, body);
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  }

  const api = {
    /* ---------- ข้อมูลตั้งต้น ---------- */
    getCompanies: () => get('/companies'),                                 // รายชื่อบริษัทขนส่ง
    getDestinations: () => get('/destinations'),                           // รายการปลายทาง
    lookupDriver: (phone) => get('/drivers/lookup', { phone }),            // ค้นคนขับจากเบอร์โทร

    /* ---------- คิว (ฝั่งคนขับ) ---------- */
    createQueue: (data) => post('/queues', data),                          // ลงทะเบียนรับคิว
    getQueue: (id, token) => get(`/queues/${id}`, { token }),              // ดูสถานะคิว
    cancelQueue: (id, token) => post(`/queues/${id}/cancel`, { token }),   // คนขับยกเลิกคิวเอง
    ackQueue: (id, token) => post(`/queues/${id}/ack`, { token }),         // กด "รับทราบ" ว่าถึงคิวแล้ว

    /* ---------- แจ้งเตือนถึงมือถือ (Web Push) ---------- */
    getPushKey: () => get('/push/public-key'),                             // กุญแจสำหรับสมัครรับแจ้งเตือน
    subscribePush: (id, token, subscription) => post(`/queues/${id}/push`, { token, subscription }),

    /* ---------- ฝั่งพนักงาน ---------- */
    getBoard: () => get('/staff/board'),                                   // หน้าเรียกคิว
    getDashboard: () => get('/staff/dashboard'),                           // ภาพรวมวันนี้
    getAnalytics: (days) => get('/staff/analytics', { days }),             // หน้าวิเคราะห์ย้อนหลัง
    callNext: (dockId) => post(`/staff/docks/${dockId}/call-next`),        // เรียกคิวถัดไปเข้าจุดรับสินค้า
    // action: 'start' | 'finish' | 'exit' | 'skip' | 'cancel'
    updateQueueStatus: (id, action) => post(`/staff/queues/${id}/${action}`),
  };

  window.TQ.api = api;
})();
