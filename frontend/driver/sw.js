// Service worker ของหน้าคนขับ: ทำงานเบื้องหลังได้แม้ปิดหน้าเว็บหรือปิดเบราว์เซอร์ไปแล้ว
// - push: server ส่ง "ถึงคิวแล้ว" มา → เด้งแจ้งเตือน (server ส่งซ้ำทุก 30 วินาทีจนกว่าจะกดรับทราบ)
// - แตะ "รับทราบ" → แจ้ง server ให้หยุดส่งซ้ำ + หยุดเสียงในหน้าเว็บ (ถ้าเปิดอยู่)
// - แตะที่ตัวแจ้งเตือน → เปิด/สลับกลับมาที่หน้าคนขับ
const TAG = 'truckq-called';
const VIBRATE = [160, 40, 160, 40, 160, 40, 700, 400, 160, 40, 160, 40, 160, 40, 700];   // ตรงกับจังหวะในหน้าเว็บ เล่น 2 รอบ

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const INFO_TAG = 'truckq-info';
const openPages = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true });

// หยุดเสียงไซเรนในหน้าคนขับ: Chrome บน Android หยุดโค้ดของหน้าที่อยู่เบื้องหลัง แต่เสียงยังเล่นต่อ
// หน้าที่ซ่อนอยู่จึงสั่งด้วยข้อความไม่ได้ ต้องโหลดหน้าใหม่ (เสียงหยุด และกลับเข้ามาจะเห็นสถานะล่าสุด)
async function silencePages(msg) {
  for (const p of await openPages()) {
    if (!new URL(p.url).pathname.startsWith('/driver/')) continue;
    if (p.visibilityState === 'hidden') await p.navigate(p.url).catch(() => p.postMessage(msg));
    else p.postMessage(msg);
  }
}

const ENDED = {
  skip: (q) => [`คิว ${q} ถูกข้ามไปก่อน`, 'กลับไปรอคิว · เปิดหน้าคิวไว้เพื่อให้มีเสียงเตือนเมื่อถึงคิวอีกครั้ง'],
  cancel: (q) => [`คิว ${q} ถูกยกเลิกแล้ว`, 'ไม่ต้องนำรถเข้า'],
  start: (q) => [`คิว ${q} เริ่มโหลดสินค้าแล้ว`, 'แตะเพื่อดูสถานะ'],
};

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch (err) { /* ข้อมูลผิดรูปแบบ */ }
  if (d.type === 'ended') {
    return e.waitUntil((async () => {
      (await self.registration.getNotifications({ tag: TAG })).forEach((n) => n.close());
      await silencePages({ type: 'ended' });
      // Chrome บังคับว่าทุก push ต้องแสดงแจ้งเตือน → แสดงสถานะใหม่แบบไม่มีเสียง
      const [title, body] = (ENDED[d.step] || ENDED.cancel)(d.queue_no || '');
      await self.registration.showNotification(title, { body, tag: INFO_TAG, silent: true });
    })());
  }
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
      if (data.queue_id && data.token) {
        await fetch(`/api/queues/${data.queue_id}/ack`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: data.token }),
        }).catch(() => { });
      }
      await silencePages({ type: 'ack' });   // บันทึกรับทราบก่อน หน้าที่โหลดใหม่จะได้ไม่ดังซ้ำ
      return;
    }
    const page = pages.find((p) => new URL(p.url).pathname.startsWith('/driver/'));
    if (page) return page.focus();
    return self.clients.openWindow('/driver/');
  })());
});
