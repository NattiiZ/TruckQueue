// หน้าคนขับ: ลงทะเบียน → ได้เลขคิว → ระบบเช็กสถานะทุก 5 วินาที → แจ้งเตือนเมื่อถึงคิว
(() => {
  const { esc, digits, hhmm, store, api, plate } = window.TQ;
  const KEY = 'truckq-driver-queue';   // จำคิวของเครื่องนี้ไว้ ปิดหน้าแล้วเปิดใหม่ยังเห็นคิวเดิม
  const POLL_MS = 5000;
  const $ = (s) => document.querySelector(s);

  let current = null;     // { id, token }
  let lastStatus = null;
  let pollTimer = null;
  let confirming = false;
  let audio = null;

  try { current = JSON.parse(store.get(KEY)); } catch (e) { current = null; }
  const remember = (q) => { current = q; store.set(KEY, q ? JSON.stringify(q) : null); };
  plate.bind($('#plate'));
  plate.bind($('#trailer'));

  /* ---------- เสียง + สั่น แจ้งเตือนเมื่อถึงคิว ---------- */
  function unlockAudio() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) { }
  }
  function alertCalled() {
    try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) { }
    if (!audio) return;
    [0, 0.4, 0.8].forEach((t) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.25, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.3);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.35);
    });
  }

  /* ---------- ฟอร์ม ---------- */
  async function loadCarriers() {
    const sel = $('#carrier');
    try {
      const list = await api('/api/companies');
      sel.innerHTML = '<option value="">เลือกบริษัทขนส่ง</option>' + list.map((c) => `<option value="${c.id}">${esc(c.company_name)}</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">โหลดรายชื่อไม่ได้</option>';
      $('#formErr').textContent = e.message;
    }
  }

  async function loadDestinations() {
    const sel = $('#destination');
    try {
      const list = await api('/api/destinations');
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
      const d = await api('/api/drivers/lookup?phone=' + encodeURIComponent(phone));
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
    unlockAudio();
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
    const btn = $('#confirmBtn'); btn.disabled = true; btn.textContent = 'กำลังรับคิว…';
    try {
      const q = await api('/api/queues', { method: 'POST', body: JSON.stringify(pending) });
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
    stopPolling(); lastStatus = null; confirming = false;
    $('#ticket').hidden = true; $('#review').hidden = true; $('#regForm').hidden = false;
  }
  function showTicket() {
    clearInterval(countdown);
    $('#regForm').hidden = true; $('#review').hidden = true; $('#ticket').hidden = false;
    refresh(); stopPolling(); pollTimer = setInterval(refresh, POLL_MS);
  }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

  async function refresh() {
    if (!current) return showForm();
    try {
      const q = await api(`/api/queues/${current.id}?token=${encodeURIComponent(current.token)}`);
      $('#netBanner').hidden = true;
      if (lastStatus === 'waiting' && q.status === 'called') alertCalled();
      lastStatus = q.status;
      renderTicket(q);
      if (q.status === 'exited' || q.status === 'cancelled') stopPolling();
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
      box = `<div class="box called">ถึงคิวของคุณแล้ว<b>กรุณานำรถเข้า ${esc(q.dock_name)}</b><small>เรียกเมื่อ ${hhmm(q.called_at)}</small></div>`;
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
    const sound = (q.status === 'waiting' && (!audio || audio.state !== 'running'))
      ? `<button class="btn sound full" data-act="sound">แตะเพื่อเปิดเสียงแจ้งเตือนเมื่อถึงคิว</button>` : '';
    $('#ticket').innerHTML = `
      <span class="label">เลขคิวของคุณ</span>
      <div class="qno">${esc(q.queue_no)}</div>
      <div class="plates">${esc(plate.pair(q))}</div>
      <div class="who">${esc(q.first_name)} ${esc(q.last_name)} · ${esc(q.company_name)}${q.destination ? `<br>ปลายทาง ${esc(q.destination)}` : ''}</div>
      ${box}${sound}${actions}
      <div class="meta">ลงทะเบียนเวลา ${hhmm(q.registered_at)} · เปิดหน้านี้ค้างไว้ได้ สถานะจะอัปเดตเอง</div>`;
  }

  $('#ticket').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'sound') { unlockAudio(); refresh(); }
    else if (a === 'cancel') { confirming = true; refresh(); }
    else if (a === 'keep') { confirming = false; refresh(); }
    else if (a === 'cancel-yes') {
      b.disabled = true;
      try { await api(`/api/queues/${current.id}/cancel`, { method: 'POST', body: JSON.stringify({ token: current.token }) }); }
      catch (ex) { alertBanner(ex.message); }
      confirming = false; refresh();
    } else if (a === 'new') { remember(null); showForm(); }
  });
  function alertBanner(msg) { const n = $('#netBanner'); n.textContent = msg; n.hidden = false; setTimeout(() => { n.hidden = true; n.textContent = 'กำลังเชื่อมต่อระบบใหม่…'; }, 4000); }

  // กลับมาที่หน้านี้ (สลับแอป/เปิดจอ) ให้เช็กสถานะทันที
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current && pollTimer) refresh(); });

  loadCarriers();
  loadDestinations();
  current ? showTicket() : showForm();
})();
