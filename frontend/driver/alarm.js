// ระบบเตือน "ถึงคิวแล้ว" ของหน้าคนขับ · เรียกใช้ผ่าน window.TQ.alarm
// - เสียงไซเรนสองโทน ดังวนซ้ำไม่หยุดจนกว่าคนขับจะกด "รับทราบ"
// - ใช้ <audio> แทน Web Audio: บน iPhone ยังดังแม้เปิดโหมดเงียบ และเล่นต่อได้ตอนสลับไปแอปอื่น
// - สั่นเป็นจังหวะ · กระพริบชื่อแท็บ · แจ้งเตือนของระบบ (เด้งแม้ไม่ได้เปิดหน้านี้อยู่)
// - กันหน้าจอดับเองระหว่างรอคิว (Wake Lock)
// หมายเหตุ: แจ้งเตือนของระบบและกันจอดับ ใช้ได้เฉพาะเว็บที่เปิดผ่าน https (หรือ localhost)
(() => {
  const RATE = 44100;
  const NOTI_TAG = 'truckq-called';
  const NOTI_REPEAT_MS = 15000;                       // ยังไม่กดรับทราบ → เด้งแจ้งเตือนซ้ำทุก 15 วินาที
  // สั่นตามจังหวะเสียง: สั้น 3 ครั้งตามโน้ต + ยาว 1 ครั้ง แล้วพัก · รวม 2.4 วินาที เท่ากับรอบเสียง
  const VIBRATE = [160, 40, 160, 40, 160, 40, 700, 1100];
  const VIBRATE_MS = 2400;

  /* ---------- สร้างไฟล์เสียง WAV ในเครื่อง (ไม่ต้องโหลดไฟล์เสียงจากเน็ต) ---------- */
  function makeWav(seconds, sample) {
    const n = Math.floor(seconds * RATE);
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    text(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample(i / RATE))) * 32767, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  // เสียงระฆังประกาศ (chime) ไล่โน้ตขึ้น 4 ตัว A5 · C#6 · E6 · A6 วนทุก 2.4 วินาที
  // เสียงใส สุภาพกว่าไซเรน แต่ความถี่สูงพอให้ได้ยินชัดแม้มีเสียงเครื่องยนต์
  const CYCLE_S = 2.4;
  const NOTES = [[0, 880], [0.2, 1108.7], [0.4, 1318.5], [0.6, 1760]];   // [เริ่มที่วินาที, ความถี่ Hz]
  const PARTIALS = [[1, 1, 0.55], [2, 0.42, 0.3], [3, 0.2, 0.18], [4.2, 0.08, 0.1]];   // [ฮาร์มอนิก, ความดัง, เวลาจางหาย]
  const SIREN = makeWav(CYCLE_S, (t) => {
    let s = 0;
    for (const [at, f] of NOTES) {
      const tt = t - at;
      if (tt < 0) continue;
      let n = 0;
      for (const [h, a, tau] of PARTIALS) n += a * Math.exp(-tt / tau) * Math.sin(2 * Math.PI * f * h * tt);
      s += n * Math.min(1, tt / 0.004);               // เริ่มเสียงนุ่มๆ 4 มิลลิวินาที กันเสียงแตก
    }
    const tail = Math.min(1, (CYCLE_S - t) / 0.25);   // จางลงท้ายรอบ กันเสียงคลิกตอนวนซ้ำ
    return Math.tanh(s * 1.3) * 0.98 * tail;          // อัดให้ดังเต็มที่โดยไม่แตก
  });
  // เสียงเงียบ เล่นวนไว้ระหว่างรอคิว เพื่อให้เบราว์เซอร์ยอมเปิดไซเรนได้ทันทีตอนถึงคิว
  const SILENT = makeWav(1, () => 0);

  const player = new Audio();
  player.loop = true;
  player.preload = 'auto';

  let unlocked = false;   // คนขับแตะหน้าจอแล้ว เบราว์เซอร์อนุญาตให้เล่นเสียง
  let ringing = false;
  let vibrateTimer = null, titleTimer = null, notiTimer = null;
  let wakeLock = null, wantWake = false;
  let swReg = null;
  const baseTitle = document.title;

  /* ---------- Service worker: ให้แจ้งเตือนเด้งได้ (แม้ปิดเบราว์เซอร์) และกด "รับทราบ" จากแจ้งเตือนได้ ---------- */
  let swReady = Promise.resolve(null);
  if ('serviceWorker' in navigator && window.isSecureContext) {
    swReady = navigator.serviceWorker.register('sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((r) => { swReg = r; return r; })
      .catch(() => null);
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'ack') alarm.onAck?.();          // กด "รับทราบ" จากแจ้งเตือน
      if (e.data?.type === 'called') alarm.onPush?.();      // server แจ้งว่าถึงคิว → เช็กสถานะทันที
    });
  }

  /* ---------- Web Push: สมัครให้ server ส่งแจ้งเตือนถึงเครื่องนี้ได้ แม้ปิดหน้าเว็บ/เบราว์เซอร์ไปแล้ว ---------- */
  const keyBytes = (b64) => {
    const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };

  /** เรียกเมื่อมีคิวแล้ว: { id, token } · ต้องได้รับอนุญาตแจ้งเตือนก่อน ถ้ายังไม่ได้ก็ข้ามไปเฉยๆ */
  async function enablePush(queue) {
    if (!queue || !canNotify() || !('PushManager' in window)) return false;
    const reg = await swReady;
    if (!reg) return false;
    try {
      const { publicKey } = await window.TQ.api.getPushKey();
      if (!publicKey) return false;                          // server ยังไม่ได้ตั้งกุญแจ VAPID
      const options = { userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) };
      let sub = await reg.pushManager.getSubscription();
      try {
        sub = sub || await reg.pushManager.subscribe(options);
      } catch (e) {                                          // สมัครไว้ด้วยกุญแจเก่า → ยกเลิกแล้วสมัครใหม่
        await sub?.unsubscribe();
        sub = await reg.pushManager.subscribe(options);
      }
      await window.TQ.api.subscribePush(queue.id, queue.token, sub.toJSON());
      return true;
    } catch (e) {
      return false;
    }
  }

  /** เรียกตอนคนขับแตะปุ่ม (เบราว์เซอร์ให้เล่นเสียง/ขอสิทธิ์ได้เฉพาะตอนผู้ใช้แตะ) */
  function unlock() {
    if (!unlocked) {
      player.src = ringing ? SIREN : SILENT;
      player.play().then(() => { unlocked = true; alarm.onChange?.(); }).catch(() => { });
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => alarm.onChange?.()).catch(() => { });
    }
    keepScreenOn(wantWake);
  }

  function start(q) {
    if (ringing) return;
    ringing = true;
    player.src = SIREN; player.volume = 1;
    player.play().catch(() => { });           // ยังไม่ได้แตะหน้าจอ = เล่นไม่ได้ ใช้หน้าจอเตือน + แจ้งเตือนแทน
    vibrate(); vibrateTimer = setInterval(vibrate, VIBRATE_MS);
    let on = false;
    titleTimer = setInterval(() => { on = !on; document.title = on ? '● ถึงคิวแล้ว · กรุณานำรถเข้า' : baseTitle; }, 800);
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: `ถึงคิว ${q.queue_no} แล้ว`, artist: `นำรถเข้า ${q.dock_name || ''}` }); } catch (e) { }
    }
    notify(q); notiTimer = setInterval(() => notify(q), NOTI_REPEAT_MS);
  }

  function stop() {
    if (!ringing) return;
    ringing = false;
    clearInterval(vibrateTimer); clearInterval(titleTimer); clearInterval(notiTimer);
    document.title = baseTitle;
    try { navigator.vibrate && navigator.vibrate(0); } catch (e) { }
    if (unlocked) { player.src = SILENT; player.play().catch(() => { }); } else player.pause();
    closeNotifications();
  }

  // หมายเหตุ: iPhone (Safari) ไม่รองรับการสั่นจากเว็บ · Android ต้องเคยแตะหน้าจอแล้วและหน้าเว็บต้องแสดงอยู่
  function vibrate() { try { navigator.vibrate && navigator.vibrate(VIBRATE); } catch (e) { } }
  // ถ้าเริ่มสั่นไม่ได้ (เบราว์เซอร์ยังไม่ให้สิทธิ์) แตะหน้าจอครั้งเดียวก็สั่นต่อได้ทันที · สลับกลับมาที่หน้านี้ก็สั่นใหม่
  document.addEventListener('pointerdown', () => { if (ringing) vibrate(); }, true);
  document.addEventListener('visibilitychange', () => { if (ringing && !document.hidden) vibrate(); });

  /* ---------- แจ้งเตือนของระบบ ---------- */
  function canNotify() { return 'Notification' in window && Notification.permission === 'granted'; }
  function notify(q) {
    if (!canNotify()) return;
    const title = `ถึงคิว ${q.queue_no} แล้ว`;
    const opts = {
      body: `กรุณานำรถเข้า ${q.dock_name || 'จุดรับสินค้า'} · แตะเพื่อเปิดดู`,
      tag: NOTI_TAG, renotify: true, requireInteraction: true, vibrate: VIBRATE,
      actions: [{ action: 'ack', title: 'รับทราบ' }],
    };
    if (swReg) swReg.showNotification(title, opts).catch(() => { });
    else { try { new Notification(title, opts).onclick = () => window.focus(); } catch (e) { } }
  }
  function closeNotifications() {
    swReg?.getNotifications({ tag: NOTI_TAG }).then((list) => list.forEach((n) => n.close())).catch(() => { });
  }

  /* ---------- กันหน้าจอดับเองระหว่างรอคิว ---------- */
  async function keepScreenOn(on) {
    wantWake = on;
    if (!('wakeLock' in navigator)) return;
    if (!on) { wakeLock?.release().catch(() => { }); wakeLock = null; return; }
    if (wakeLock || document.hidden) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { /* แบตต่ำหรือเบราว์เซอร์ไม่รองรับ */ }
  }
  // สลับแอปแล้วกลับมา ระบบจะปล่อย wake lock เอง ต้องขอใหม่
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wantWake) keepScreenOn(true); });

  const alarm = {
    unlock, start, stop, keepScreenOn, enablePush,
    isRinging: () => ringing,
    isUnlocked: () => unlocked,
    canNotify,
    onAck: null,      // app.js ใส่ฟังก์ชันไว้: เรียกเมื่อกด "รับทราบ" จากแจ้งเตือน
    onChange: null,   // app.js ใส่ฟังก์ชันไว้: เรียกเมื่อเปิดเสียง/อนุญาตแจ้งเตือนสำเร็จ
    onPush: null,     // app.js ใส่ฟังก์ชันไว้: เรียกเมื่อ server ส่งแจ้งเตือนถึงคิวมา
  };
  window.TQ.alarm = alarm;
})();
