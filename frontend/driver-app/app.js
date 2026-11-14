// หน้าคนขับ: ลงทะเบียน → ได้เลขคิว → ระบบเช็กสถานะทุก 5 วินาที → แจ้งเตือนเมื่อถึงคิว
(() => {
  const { esc, digits, hhmm, store, api, plate, alarm } = window.TQ;
  const KEY = 'truckq-driver-queue';   // จำคิวของเครื่องนี้ไว้ ปิดหน้าแล้วเปิดใหม่ยังเห็นคิวเดิม
  const ACK_KEY = 'truckq-driver-ack'; // จำว่ากด "รับทราบ" การเรียกครั้งไหนไปแล้ว (เปิดหน้าใหม่จะได้ไม่ดังซ้ำ)
  const POLL_MS = 5000;
  const $ = (s) => document.querySelector(s);

  let current = null;     // { id, token }
  let lastQueue = null;   // ข้อมูลคิวล่าสุดจาก server
  let poller = null;
  let confirming = false;

  try { current = JSON.parse(store.get(KEY)); } catch (e) { current = null; }
  const remember = (q) => { current = q; store.set(KEY, q ? JSON.stringify(q) : null); };
  plate.bind($('#plate'));
  plate.bind($('#trailer'));

  /* ---------- เช็กสถานะเป็นระยะ ----------
     ใช้ตัวจับเวลาใน Web Worker เพราะ setInterval ปกติจะถูกเบราว์เซอร์หน่วงเหลือนาทีละครั้ง
     เมื่อสลับไปแอปอื่นนานๆ ทำให้รู้ช้าว่าถึงคิว */
  function startPolling(fn, ms) {
    try {
      const src = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms})`], { type: 'text/javascript' }));
      const worker = new Worker(src);
      worker.onmessage = fn;
      return { stop: () => worker.terminate() };
    } catch (e) {
      const t = setInterval(fn, ms);
      return { stop: () => clearInterval(t) };
    }
  }

  /* ---------- เตือนเมื่อถึงคิว: ดังวนซ้ำ + หน้าจอเตือนเต็มจอ จนกว่าจะกด "รับทราบ" ---------- */
  const callKey = (q) => `${q.id}:${q.called_at}`;   // ถูกข้ามแล้วเรียกใหม่ = นับเป็นการเรียกครั้งใหม่ ต้องดังอีก

  function checkAlarm(q) {
    // ต้องเตือน = ถูกเรียกอยู่ และยังไม่ได้กดรับทราบ (ทั้งบน server และในเครื่องนี้ เผื่อเน็ตหลุดตอนกด)
    const needAck = q.status === 'called' && !q.driver_ack_at && store.get(ACK_KEY) !== callKey(q);
    if (needAck) {
      alarm.start(q);
      $('#alarmDock').textContent = q.dock_name || 'จุดรับสินค้า';
      $('#alarmQno').textContent = q.queue_no;
      $('#alarmMeta').textContent = [plate.pair(q), q.called_at ? `เรียกเมื่อ ${hhmm(q.called_at)} น.` : ''].filter(Boolean).join(' · ');
      $('#alarm').hidden = false;
    } else {
      alarm.stop();
      $('#alarm').hidden = true;
    }
  }

  function acknowledge() {
    if (lastQueue?.status === 'called') store.set(ACK_KEY, callKey(lastQueue));
    alarm.stop();
    $('#alarm').hidden = true;
    // แจ้ง server: หยุดส่งแจ้งเตือนซ้ำ และพนักงานจะเห็นว่าคนขับรับทราบแล้ว
    if (current) api.ackQueue(current.id, current.token).catch(() => { });
  }
  $('#alarmAck').addEventListener('click', acknowledge);
  alarm.onAck = acknowledge;                                     // กด "รับทราบ" จากแจ้งเตือนของระบบ
  alarm.onPush = () => { if (current) refresh(); };              // server ส่งแจ้งเตือนมา → เช็กสถานะทันที
  alarm.onChange = () => {                                       // เพิ่งเปิดเสียง/อนุญาตแจ้งเตือน
    if (lastQueue) renderTicket(lastQueue);
    alarm.enablePush(current);
  };

  /* ---------- ฟอร์ม ---------- */
  async function loadCarriers() {
    const sel = $('#carrier');
    try {
      const list = await api.getCompanies();
      sel.innerHTML = '<option value="">เลือกบริษัทขนส่ง</option>' + list.map((c) => `<option value="${c.id}">${esc(c.company_name)}</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">โหลดรายชื่อไม่ได้</option>';
      $('#formErr').textContent = e.message;
    }
  }

  async function loadDestinations() {
    const sel = $('#destination');
    try {
      const list = await api.getDestinations();
      sel.innerHTML = '<option value="">เลือกปลายทาง</option>' + list.map((d) => `<option value="${d.id}">${esc(d.destination)}</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">โหลดรายการปลายทางไม่ได้</option>';
    }
  }

  // กรอกเบอร์ครบ 10 หลัก → ถ้าเคยมาแล้ว เติมชื่อ นามสกุล บริษัทให้
  let lookupFor = '';
  $('#phone').addEventListener('input', async (e) => {
    const phone = digits(e.target.value), err = $('#formErr');
    if (phone.length < 10) { lookupFor = ''; return; }
    if (phone === lookupFor) return;
    lookupFor = phone;
    try {
      const d = await api.lookupDriver(phone);
      if (phone !== lookupFor) return;
      err.textContent = d.found && d.inactive ? d.message : '';   // ปิดสิทธิ์แล้ว: ไม่เติมข้อมูล และเซิร์ฟเวอร์จะไม่รับคิว
      if (d.found && !d.inactive) {
        $('#firstName').value = d.first_name; $('#lastName').value = d.last_name;
        if (d.company_id) $('#carrier').value = String(d.company_id);
        $('#plate').focus();
      }
    } catch (ex) { /* ค้นไม่เจอหรือเน็ตหลุด ให้กรอกเองได้ตามปกติ */ }
  });

  /* ---------- ขั้นที่ 1: กรอกฟอร์ม → ตรวจครบ → ไปหน้ายืนยัน ---------- */
  const READ_DELAY_S = 3;      // ปุ่มยืนยันกดได้หลังจากนี้ (ให้เวลาอ่านทวนข้อมูล)
  let pending = null;          // ข้อมูลที่รอยืนยัน
  let countdown = null;

  $('#regForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alarm.unlock();
    const body = {
      phone: $('#phone').value.trim(), first_name: $('#firstName').value.trim(), last_name: $('#lastName').value.trim(),
      company_id: $('#carrier').value, plate_no: $('#plate').value.trim(),
      trailer_plate: $('#trailer').value.trim(), destination_id: $('#destination').value,
    };
    const err = $('#formErr');
    if (digits(body.phone).length < 9) return (err.textContent = 'กรุณากรอกเบอร์โทรให้ถูกต้อง');
    if (!body.first_name) return (err.textContent = 'กรุณากรอกชื่อ');
    if (!body.last_name) return (err.textContent = 'กรุณากรอกนามสกุล');
    if (!body.company_id) return (err.textContent = 'กรุณาเลือกบริษัทขนส่ง');
    if (!plate.isValid(body.plate_no)) return (err.textContent = `กรุณากรอกทะเบียนหัวให้ถูกรูปแบบ เช่น ${plate.example}`);
    if (!plate.isValid(body.trailer_plate)) return (err.textContent = `กรุณากรอกทะเบียนหางให้ถูกรูปแบบ เช่น ${plate.example}`);
    if (!body.destination_id) return (err.textContent = 'กรุณาเลือกปลายทาง (ถ้าไม่ทราบ เลือก "ไม่ระบุ")');
    err.textContent = '';
    pending = body;
    showReview();
  });

  /* ---------- ขั้นที่ 2: ทวนข้อมูล → ยืนยัน (กดได้หลังนับถอยหลัง) ---------- */
  const selectedText = (sel) => sel.options[sel.selectedIndex]?.textContent || '';
  function showReview() {
    const b = pending;
    $('#summary').innerHTML = [
      ['เบอร์โทร', b.phone],
      ['ชื่อ - นามสกุล', `${b.first_name} ${b.last_name}`],
      ['บริษัทขนส่ง', selectedText($('#carrier'))],
      ['ทะเบียนหัว', b.plate_no],
      ['ทะเบียนหาง', b.trailer_plate],
      ['ปลายทาง', selectedText($('#destination'))],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    $('#reviewErr').textContent = '';
    $('#regForm').hidden = true; $('#review').hidden = false;
    window.scrollTo(0, 0);
    startCountdown();
  }
  function startCountdown() {
    const btn = $('#confirmBtn');
    let left = READ_DELAY_S;
    clearInterval(countdown);
    btn.disabled = true; btn.textContent = `อ่านทวนข้อมูล… (${left})`;
    countdown = setInterval(() => {
      left -= 1;
      if (left > 0) { btn.textContent = `อ่านทวนข้อมูล… (${left})`; return; }
      clearInterval(countdown); btn.disabled = false; btn.textContent = 'ยืนยันรับคิว';
    }, 1000);
  }
  $('#editBtn').addEventListener('click', () => {
    clearInterval(countdown);
    $('#review').hidden = true; $('#regForm').hidden = false;   // ข้อมูลในฟอร์มยังอยู่ แก้ต่อได้เลย
  });
  $('#confirmBtn').addEventListener('click', async () => {
    if (!pending) return;
    alarm.unlock();   // ขออนุญาตเปิดเสียง/แจ้งเตือนตอนกดยืนยัน
    const btn = $('#confirmBtn'); btn.disabled = true; btn.textContent = 'กำลังรับคิว…';
    try {
      const q = await api.createQueue(pending);
      remember({ id: q.id, token: q.token });
      pending = null; $('#regForm').reset(); lookupFor = '';
      showTicket();
    } catch (ex) {
      $('#reviewErr').textContent = ex.message + ' · กด "แก้ไขข้อมูล" เพื่อแก้';
      btn.disabled = false; btn.textContent = 'ยืนยันรับคิว';
    }
  });

  /* ---------- บัตรคิว ---------- */
  function showForm() {
    stopPolling(); lastQueue = null; confirming = false;
    alarm.stop(); alarm.keepScreenOn(false); $('#alarm').hidden = true;
    $('#ticket').hidden = true; $('#review').hidden = true; $('#regForm').hidden = false;
  }
  function showTicket() {
    clearInterval(countdown);
    $('#regForm').hidden = true; $('#review').hidden = true; $('#ticket').hidden = false;
    alarm.keepScreenOn(true);   // กันจอดับระหว่างรอคิว
    alarm.enablePush(current);  // สมัครรับแจ้งเตือนถึงมือถือ (ถ้าอนุญาตแจ้งเตือนไว้แล้ว)
    refresh(); stopPolling(); poller = startPolling(refresh, POLL_MS);
  }
  function stopPolling() { poller?.stop(); poller = null; }

  async function refresh() {
    if (!current) return showForm();
    try {
      const q = await api.getQueue(current.id, current.token);
      $('#netBanner').hidden = true;
      lastQueue = q;
      checkAlarm(q);
      renderTicket(q);
      if (q.status === 'exited' || q.status === 'cancelled') { stopPolling(); alarm.keepScreenOn(false); }
    } catch (e) {
      if (e.status === 404) { remember(null); return showForm(); }
      $('#netBanner').hidden = false;
    }
  }

  function estimateText(iso) {
    if (!iso) return null;
    const m = Math.round((new Date(iso) - Date.now()) / 60000 / 5) * 5;   // ปัดเป็น 5 นาที เพราะเป็นค่าประมาณ
    if (m <= 0) return { at: 'เร็วๆ นี้', left: 'อีกไม่กี่นาที' };
    return { at: '~' + hhmm(Date.now() + m * 60000), left: m < 60 ? `อีกประมาณ ${m} นาที` : `อีกประมาณ ${Math.floor(m / 60)} ชม. ${m % 60} นาที` };
  }

  function renderTicket(q) {
    // สถานะ: waiting รอคิว → called กำลังเรียก → loading กำลังเข้าโหลด → done โหลดเสร็จ → exited ออกแล้ว · cancelled ยกเลิก
    let box, actions = '';
    if (q.status === 'waiting') {
      const e = estimateText(q.estimated_call_at);
      box = `<div class="box">คาดว่าจะถึงคิว<b>${e ? e.at : '–'}</b>${e ? e.left + ' · ' : ''}รถรอก่อนหน้า ${q.ahead ?? 0} คัน<small>เวลาโดยประมาณ อาจเปลี่ยนตามสถานการณ์</small></div>`;
      actions = confirming
        ? `<div class="confirm"><span>ยืนยันยกเลิกคิว ${esc(q.queue_no)}?</span><div class="row"><button class="btn" data-act="keep">ไม่ยกเลิก</button><button class="btn danger" data-act="cancel-yes">ยกเลิกคิว</button></div></div>`
        : `<button class="btn ghost" data-act="cancel">ยกเลิกคิว</button>`;
    } else if (q.status === 'called') {
      box = `<div class="box called">ถึงคิวของท่านแล้ว<b>กรุณานำรถเข้า ${esc(q.dock_name)}</b><small>เรียกเมื่อ ${hhmm(q.called_at)}</small></div>`;
    } else if (q.status === 'loading') {
      box = `<div class="box loading">กำลังเข้าโหลดสินค้า<b>${esc(q.dock_name)}</b><small>เริ่มเวลา ${hhmm(q.loading_started_at)}</small></div>`;
    } else if (q.status === 'done') {
      box = `<div class="box done">โหลดเสร็จแล้ว<b>กรุณานำรถออกทางประตู</b><small>เสร็จเวลา ${hhmm(q.loading_finished_at)}</small></div>`;
    } else if (q.status === 'exited') {
      box = `<div class="box exited">ออกจากคลังแล้ว<b>เดินทางปลอดภัย</b><small>ออกเวลา ${hhmm(q.exited_at)}</small></div>`;
      actions = `<button class="btn full" data-act="new">ลงทะเบียนคิวใหม่</button>`;
    } else {
      box = `<div class="box cancelled">ยกเลิกคิวแล้ว<b>ไม่ต้องรอเรียก</b></div>`;
      actions = `<button class="btn primary full" data-act="new">ลงทะเบียนคิวใหม่</button>`;
    }
    const needNoti = 'Notification' in window && Notification.permission === 'default';
    const sound = (q.status === 'waiting' && (!alarm.isUnlocked() || needNoti))
      ? `<button class="btn sound full" data-act="sound">แตะเพื่อเปิดเสียงและแจ้งเตือนเมื่อถึงคิว</button>` : '';
    const tip = q.status === 'waiting'
      ? `<div class="tip">เปิดเสียงโทรศัพท์ให้ดังสุด · เปิดหน้านี้ค้างไว้ ถึงคิวแล้วจะมีเสียงดังจนกว่าจะกด "รับทราบ"</div>` : '';
    $('#ticket').innerHTML = `
      <span class="label">เลขคิวของคุณ</span>
      <div class="qno">${esc(q.queue_no)}</div>
      <div class="plates">${esc(plate.pair(q))}</div>
      <div class="who">${esc(q.first_name)} ${esc(q.last_name)} · ${esc(q.company_name)}${q.destination ? `<br>ปลายทาง ${esc(q.destination)}` : ''}</div>
      ${box}${sound}${tip}${actions}
      <div class="meta">ลงทะเบียนเวลา ${hhmm(q.registered_at)} · เปิดหน้านี้ค้างไว้ได้ สถานะจะอัปเดตเอง</div>`;
  }

  $('#ticket').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'sound') { alarm.unlock(); refresh(); }
    else if (a === 'cancel') { confirming = true; refresh(); }
    else if (a === 'keep') { confirming = false; refresh(); }
    else if (a === 'cancel-yes') {
      b.disabled = true;
      try { await api.cancelQueue(current.id, current.token); }
      catch (ex) { alertBanner(ex.message); }
      confirming = false; refresh();
    } else if (a === 'new') { remember(null); showForm(); }
  });
  function alertBanner(msg) { const n = $('#netBanner'); n.textContent = msg; n.hidden = false; setTimeout(() => { n.hidden = true; n.textContent = 'กำลังเชื่อมต่อระบบใหม่…'; }, 4000); }

  // กลับมาที่หน้านี้ (สลับแอป/เปิดจอ) ให้เช็กสถานะทันที
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current && poller) refresh(); });

  loadCarriers();
  loadDestinations();
  current ? showTicket() : showForm();
})();
