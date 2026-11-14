// Service worker ของหน้าคนขับ: ทำงานเบื้องหลังได้แม้ปิดหน้าเว็บหรือปิดเบราว์เซอร์ไปแล้ว
// - push: server ส่ง "ถึงคิวแล้ว" มา → เด้งแจ้งเตือน (server ส่งซ้ำทุก 30 วินาทีจนกว่าจะกดรับทราบ)
// - แตะ "รับทราบ" → แจ้ง server ให้หยุดส่งซ้ำ + หยุดเสียงในหน้าเว็บ (ถ้าเปิดอยู่)
// - แตะที่ตัวแจ้งเตือน → เปิด/สลับกลับมาที่หน้าคนขับ
const TAG = 'truckq-called';
const VIBRATE = [160, 40, 160, 40, 160, 40, 700, 400, 160, 40, 160, 40, 160, 40, 700];   // ตรงกับจังหวะในหน้าเว็บ เล่น 2 รอบ

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const openPages = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true });

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch (err) { /* ข้อมูลผิดรูปแบบ */ }
  if (d.type !== 'called') return;
  e.waitUntil((async () => {
    (await openPages()).forEach((p) => p.postMessage({ type: 'called' }));   // หน้าเว็บที่เปิดอยู่ เช็กสถานะทันที
    await self.registration.showNotification(`ถึงคิว ${d.queue_no} แล้ว`, {
      body: `กรุณานำรถเข้า ${d.dock_name || 'จุดรับสินค้า'} · กด "รับทราบ" เมื่อกำลังนำรถเข้า`,
      tag: TAG, renotify: true, requireInteraction: true, vibrate: VIBRATE,
      actions: [{ action: 'ack', title: 'รับทราบ' }],
      data: { queue_id: d.queue_id, token: d.token },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async () => {
    const pages = await openPages();
    if (e.action === 'ack') {
      pages.forEach((p) => p.postMessage({ type: 'ack' }));
      if (data.queue_id && data.token) {
        await fetch(`/api/queues/${data.queue_id}/ack`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: data.token }),
        }).catch(() => { });
      }
      return;
    }
    const page = pages.find((p) => new URL(p.url).pathname.startsWith('/driver/'));
    if (page) return page.focus();
    return self.clients.openWindow('/driver/');
  })());
});
