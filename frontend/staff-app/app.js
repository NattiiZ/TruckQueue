// หน้าพนักงาน: เรียกคิวเข้าจุดรับสินค้า จองคิวที่เคาน์เตอร์ และดูภาพรวมวันนี้ · ดึงข้อมูลจาก backend ทุก 5 วินาที
(() => {
  const { esc, digits, hhmm, store, api, plate } = window.TQ;
  const POLL_MS = 5000;
  const MIN = 60000;
  const $ = (s) => document.querySelector(s);
  const pad2 = (n) => String(n).padStart(2, '0');

  let view = 'queue';
  let board = null;        // ข้อมูลจาก /api/staff/board
  let dash = null;         // ข้อมูลจาก /api/staff/dashboard
  let offset = 0;          // นาฬิกาเครื่องนี้ต่างจากเซิร์ฟเวอร์กี่ ms
  let dockFilter = Number(store.get('truckq-staff-dock')) || 0;
  let armed = null;        // ปุ่มที่กดครั้งแรกแล้วรอยืนยัน เช่น 'skip:12'
  let armTimer = null;
  let busy = false;

  const now = () => Date.now() + offset;
  const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad2(s % 60); };
  const dur = (ms) => { if (ms == null) return '–'; const m = Math.max(0, Math.round(ms / MIN)); return m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`; };
  const r0 = (v) => v == null ? '–' : Math.round(v);

  /* ---------- โหลดข้อมูล ---------- */
  async function load() {
    try {
      const b = await api('/api/staff/board');
      offset = new Date(b.server_time) - Date.now();
      board = b;
      if (view === 'dashboard') dash = await api('/api/staff/dashboard');
      $('#netBanner').hidden = true;
      render();
    } catch (e) {
      const n = $('#netBanner'); n.textContent = e.message; n.hidden = false;
    }
  }

  let toastT;
  function toast(msg, isErr = false) {
    const t = $('#toast'); t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 3000);
  }

  /* ---------- ปุ่มต่างๆ ---------- */
  const NEED_CONFIRM = ['skip', 'cancel'];   // กดครั้งแรก = เตรียม, กดซ้ำภายใน 4 วินาที = ทำจริง
  document.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-df]');
    if (chip) { dockFilter = Number(chip.dataset.df); store.set('truckq-staff-dock', dockFilter); render(); return; }

    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    const act = b.dataset.act, id = b.dataset.id, dock = b.dataset.dock;
    const key = `${act}:${id || dock}`;
    if (NEED_CONFIRM.includes(act) && armed !== key) {
      armed = key; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = null; render(); }, 4000);
      render(); return;
    }
    armed = null; clearTimeout(armTimer);

    busy = true; b.disabled = true;
    try {
      if (act === 'call') {
        const r = await api(`/api/staff/docks/${dock}/call-next`, { method: 'POST' });
        toast(`เรียกคิว ${r.queue_no} แล้ว`);
      } else {
        await api(`/api/staff/queues/${id}/${act}`, { method: 'POST' });
        toast({ start: 'บันทึกเวลาเริ่มโหลดแล้ว', finish: 'บันทึกโหลดเสร็จแล้ว · กดเรียกคิวถัดไปเมื่อจุดรับสินค้าพร้อม', exit: 'บันทึกรถออกแล้ว', skip: 'ข้ามคิวแล้ว คิวนี้ไปต่อท้าย', cancel: 'ยกเลิกคิวแล้ว' }[act]);
      }
    } catch (ex) {
      toast(ex.message, true);
    } finally {
      busy = false;
      await load();
    }
  });

  /* ---------- หน้าเรียกคิว ---------- */
  const confirmBtn = (act, id, label, armedLabel) => {
    const isArmed = armed === `${act}:${id}`;
    return `<button class="btn ghost${isArmed ? ' armed' : ''}" data-act="${act}" data-id="${id}">${isArmed ? armedLabel : label}</button>`;
  };

  function renderQueue() {
    const { docks, waiting, done, late_minutes: LATE } = board;
    const t = now();
    $('#today').textContent = new Date(t).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (dockFilter && !docks.some((d) => d.id === dockFilter)) dockFilter = 0;
    $('#dockFilter').innerHTML = [{ id: 0, dock_name: 'ทุกจุด' }, ...docks]
      .map((d) => `<button data-df="${d.id}" aria-pressed="${d.id === dockFilter}">${esc(d.dock_name)}</button>`).join('');

    const next = waiting[0];
    $('#docks').innerHTML = docks.filter((d) => !dockFilter || d.id === dockFilter).map((d) => {
      const q = d.current;
      const head = (tag) => `<div class="dock-h"><h3>${esc(d.dock_name)}<small>มาตรฐาน ${d.std_minutes} นาที</small></h3>${tag}</div>`;
      if (!q) {
        return `<article class="dock">${head('<span class="tag t-idle">ว่าง</span>')}
          <div class="idle">
            <div class="info">${next ? `คิวถัดไป <b class="mono">${esc(next.queue_no)}</b> · ${esc(plate.pair(next))}<br>${esc(next.company_name)} · ${esc(next.destination)}` : 'ไม่มีรถรอคิว'}</div>
            <div class="actions"><button class="btn primary" data-act="call" data-dock="${d.id}" ${next ? '' : 'disabled'}>เรียกคิวถัดไป</button></div>
            <div class="info">กดเมื่อจุดนี้พร้อมรับรถ · เรียกคันที่รอนานสุดตามลำดับคิว</div>
          </div></article>`;
      }
      const called = q.status === 'called';
      const since = new Date(called ? q.called_at : q.loading_started_at).getTime();
      const late = called && t - since > LATE * MIN;
      return `<article class="dock${late ? ' late' : ''}">
        ${head(called ? '<span class="tag t-called">กำลังเรียก</span>' : '<span class="tag t-loading">กำลังเข้าโหลด</span>')}
        <div class="qno">${esc(q.queue_no)}</div>
        <div class="plates">${esc(plate.pair(q))}</div>
        <div class="info">${esc(q.first_name)} ${esc(q.last_name)} · ${esc(q.company_name)}<br>ปลายทาง ${esc(q.destination)}</div>
        ${called ? `<div class="phone"><span class="mono">${esc(q.phone)}</span><a class="btn sm" href="tel:${digits(q.phone)}">โทร</a></div>` : ''}
        <div class="info">${called ? 'เรียกมาแล้ว' : `เริ่มโหลด ${hhmm(q.loading_started_at)} · ผ่านไป`}
          <span class="timer" data-since="${since}" data-warn="${(called ? LATE : d.std_minutes) * MIN}"${called ? ' data-late' : ''}>${clock(t - since)}</span></div>
        ${called ? `<div class="late-msg">รถยังไม่เข้า เกิน ${LATE} นาทีแล้ว โทรตามหรือข้ามคิว</div>` : ''}
        <div class="actions">${called
          ? `<button class="btn primary" data-act="start" data-id="${q.id}">รถเข้าแล้ว เริ่มโหลด</button>${confirmBtn('skip', q.id, 'ข้ามคิว', 'แตะอีกครั้งเพื่อข้ามคิว')}`
          : `<button class="btn primary" data-act="finish" data-id="${q.id}">โหลดเสร็จ</button>`}</div>
      </article>`;
    }).join('');

    $('#doneN').textContent = done.length;
    $('#doneBox').hidden = !done.length;
    $('#doneList').innerHTML = done.map((q) => `<div class="row">
      <span class="no">${esc(q.queue_no)}</span>
      <div class="main"><b>${esc(plate.pair(q))}</b><span>${esc(q.first_name)} · โหลดเสร็จ ${hhmm(q.loading_finished_at)} (${dur(new Date(q.loading_finished_at) - new Date(q.loading_started_at))})</span></div>
      <div class="side"><button class="btn sm primary" data-act="exit" data-id="${q.id}">บันทึกรถออก</button></div></div>`).join('');

    $('#waitN').textContent = waiting.length;
    $('#waitList').innerHTML = waiting.length ? waiting.map((q) => `<div class="row">
      <span class="no">${esc(q.queue_no)}</span>
      <div class="main"><b>${esc(plate.pair(q))}</b><span>${esc(q.first_name)} ${esc(q.last_name)} · ${esc(q.company_name)} · ${esc(q.destination)}</span></div>
      <div class="side"><span>รอ <span data-since="${new Date(q.registered_at).getTime()}" data-fmt="dur">${dur(t - new Date(q.registered_at))}</span> · คาดว่าเรียก ${hhmm(q.estimated_call_at)}</span>
        ${confirmBtn('cancel', q.id, 'ยกเลิก', 'แตะอีกครั้งเพื่อยกเลิก')}</div></div>`).join('') : '<div class="empty">ไม่มีรถรอคิว</div>';
  }

  /* ---------- Dashboard ---------- */
  const tile = (label, value, unit, extra = '') => `<div class="num"><span>${label}</span><b>${value}<small>${unit}</small></b>${extra ? `<em>${extra}</em>` : ''}</div>`;

  function renderDashboard() {
    if (!dash) return;
    const c = dash.counts, t = now();
    $('#dashDate').textContent = new Date(t).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#nums').innerHTML = [
      tile('รถเข้าวันนี้', c.registered - c.cancelled, 'คัน', c.cancelled ? `ยกเลิก ${c.cancelled} คัน` : ''),
      tile('รอคิวตอนนี้', c.waiting, 'คัน', dash.oldest_waiting_at ? `รอนานสุด ${dur(t - new Date(dash.oldest_waiting_at))}` : 'ไม่มีรถรอ'),
      tile('กำลังเรียก / เข้าโหลด', c.called + c.loading, 'คัน', `เรียก ${c.called} · โหลด ${c.loading}`),
      tile('โหลดเสร็จ', c.done + c.exited, 'คัน', `ออกแล้ว ${c.exited} · รอออก ${c.done}`),
      tile('รอคิวเฉลี่ย', r0(dash.avg_wait_min), 'นาที'),
      tile('โหลดเฉลี่ย', r0(dash.avg_load_min), 'นาที'),
    ].join('');

    $('#dashDocks').innerHTML = dash.docks.map((d, i) => {
      const cur = board?.docks.find((x) => x.id === d.id)?.current;
      const tag = !cur ? '<span class="tag t-idle">ว่าง</span>' : cur.status === 'called' ? `<span class="tag t-called">เรียก ${esc(cur.queue_no)}</span>` : `<span class="tag t-loading">โหลด ${esc(cur.queue_no)}</span>`;
      return `<div class="dcard"><div class="dc-h"><i class="sw bg${(i % 4) + 1}"></i><b>${esc(d.dock_name)}</b>${tag}</div>
        <dl><dt>โหลดเสร็จวันนี้</dt><dd>${d.loaded} คัน</dd>
        <dt>เวลาโหลดเฉลี่ย</dt><dd class="${d.avg_load_min > d.std_minutes ? 'bad' : ''}">${d.avg_load_min == null ? '–' : r0(d.avg_load_min) + ' นาที'}</dd>
        <dt>มาตรฐาน</dt><dd>${d.std_minutes} นาที</dd>
        <dt>เกินมาตรฐาน</dt><dd class="${d.over_std ? 'bad' : ''}">${d.over_std} คัน</dd></dl></div>`;
    }).join('');

    // กราฟรถมาถึงรายชั่วโมง (แยกสีตามจุดรับสินค้า, สีเทา = ยังรอคิว)
    const nowHour = new Date(t).getHours();
    const hoursWithData = dash.hourly.map((h) => h.hour);
    const from = Math.min(7, ...hoursWithData), to = Math.max(18, nowHour, ...hoursWithData);
    const hours = []; for (let h = from; h <= to; h++) hours.push(h);
    const series = [...dash.docks.map((d, i) => ({ id: d.id, name: d.dock_name, cls: `f${(i % 4) + 1}`, bg: `bg${(i % 4) + 1}` })), { id: null, name: 'ยังรอคิว', cls: 'f0', bg: 'bg0' }];
    $('#hourLegend').innerHTML = series.map((s) => `<span><i class="sw ${s.bg}"></i>${esc(s.name)}</span>`).join('');
    $('#hourChart').innerHTML = barChart(hours.map((h) => {
      const vals = series.map((s) => dash.hourly.filter((x) => x.hour === h && x.dock_id === s.id).reduce((a, x) => a + x.n, 0));
      const total = vals.reduce((a, b) => a + b, 0);
      return { label: pad2(h), vals, classes: series.map((s) => s.cls),
        tip: `<b>${pad2(h)}:00–${pad2(h + 1)}:00</b><br>มาถึง ${total} คัน${total ? '<br>' + series.map((s, j) => vals[j] ? `${esc(s.name)}: ${vals[j]}` : '').filter(Boolean).join(' · ') : ''}` };
    }));
    $('#stdChart').innerHTML = stdChart(dash.docks.map((d, i) => ({ name: d.dock_name, std: d.std_minutes, avg: d.avg_load_min, n: d.loaded, cls: `f${(i % 4) + 1}` })));
  }

  /* ---------- กราฟ (SVG) ---------- */
  function scaleTicks(v) { for (const s of [1, 2, 5, 10, 15, 20, 25, 30, 50, 60, 100]) if (Math.ceil(v / s) <= 5) return { max: Math.max(s, Math.ceil(v / s) * s), step: s }; return { max: v, step: v / 4 }; }
  const roundTop = (x, y, w, h, r) => { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

  function barChart(cats) {
    const W = 640, H = 220, L = 30, R = 8, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
    const { max, step } = scaleTicks(Math.max(1, ...cats.map((c) => c.vals.reduce((a, b) => a + b, 0))));
    const y = (v) => T + ph - v / max * ph, bw = pw / cats.length, w = Math.min(30, bw * 0.62);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
    for (let v = 0; v <= max; v += step) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    cats.forEach((c, i) => {
      const cx = L + bw * i + bw / 2; let acc = 0; const top = c.vals.reduce((last, v, j) => v > 0 ? j : last, -1);
      c.vals.forEach((v, j) => {
        if (!v) return; const y1 = y(acc + v), y0 = y(acc); acc += v;
        s += j === top ? `<path class="${c.classes[j]}" d="${roundTop(cx - w / 2, y1, w, y0 - y1, 3)}"/>`
          : `<rect class="${c.classes[j]}" x="${cx - w / 2}" y="${y1 + 2}" width="${w}" height="${Math.max(0, y0 - y1 - 2)}"/>`;
      });
      s += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${c.label}</text><rect class="hit" x="${L + bw * i}" y="${T}" width="${bw}" height="${ph}" data-tip="${esc(c.tip)}"/>`;
    });
    return s + '</svg>';
  }

  function stdChart(rows) {
    const W = 640, rowH = 50, T = 4, B = 26, L = 76, R = 64, H = T + rowH * rows.length + B, pw = W - L - R;
    const { max, step } = scaleTicks(Math.max(...rows.map((r) => Math.max(r.avg ?? 0, r.std))) * 1.1);
    const x = (v) => L + v / max * pw;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
    for (let v = 0; v <= max; v += step) s += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - B}"/><text class="ax" x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}</text>`;
    rows.forEach((r, i) => {
      const cy = T + rowH * i + rowH / 2;
      s += `<text class="lab" x="0" y="${cy + 4}">${esc(r.name)}</text>`;
      s += r.avg != null
        ? `<rect class="${r.cls}" x="${L}" y="${cy - 9}" width="${Math.max(3, x(r.avg) - L)}" height="18" rx="4"/><text class="lab" x="${Math.max(x(r.avg), x(r.std)) + 8}" y="${cy + 4}">${Math.round(r.avg)} นาที</text>`
        : `<text class="ax" x="${L + 6}" y="${cy + 4}">ยังไม่มีรถโหลดเสร็จ</text>`;
      s += `<line class="std" x1="${x(r.std)}" x2="${x(r.std)}" y1="${cy - 16}" y2="${cy + 16}"/>`;
      s += `<rect class="hit" x="0" y="${T + rowH * i}" width="${W}" height="${rowH}" data-tip="${esc(`<b>${r.name}</b><br>เฉลี่ย ${r.avg == null ? '–' : Math.round(r.avg) + ' นาที'} จาก ${r.n} คัน<br>มาตรฐาน ${r.std} นาที`)}"/>`;
    });
    return s + '</svg>';
  }

  const tip = $('#tip');
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.innerHTML = t.dataset.tip; tip.hidden = false;
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
    const y = e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = y + 'px';
  });

  /* ---------- จองคิวให้คนขับที่เดินมาที่เคาน์เตอร์ ---------- */
  const BOOK_DELAY_S = 2;      // ปุ่มยืนยันกดได้หลังจากนี้ (ให้เวลาทวนข้อมูลกับคนขับ)
  let bookPending = null, bookTimer = null, bookListsLoaded = false, bookLookupFor = '';

  plate.bind($('#bPlate'));
  plate.bind($('#bTrailer'));

  async function loadBookLists() {
    try {
      const [companies, dests] = await Promise.all([api('/api/companies'), api('/api/destinations')]);
      $('#bCompany').innerHTML = '<option value="">เลือกบริษัทขนส่ง</option>' + companies.map((c) => `<option value="${c.id}">${esc(c.company_name)}</option>`).join('');
      $('#bDest').innerHTML = '<option value="">เลือกปลายทาง</option>' + dests.map((d) => `<option value="${d.id}">${esc(d.destination)}</option>`).join('');
      bookListsLoaded = true;
    } catch (e) { $('#bErr').textContent = e.message; }
  }
  const setBookHint = (text, cls = '') => { const h = $('#bHint'); h.textContent = text; h.className = 'hint ' + cls; };

  $('#bPhone').addEventListener('input', async (e) => {
    const phone = digits(e.target.value);
    if (phone.length < 10) { setBookHint(''); bookLookupFor = ''; return; }
    if (phone === bookLookupFor) return;
    bookLookupFor = phone;
    try {
      const d = await api('/api/drivers/lookup?phone=' + encodeURIComponent(phone));
      if (phone !== bookLookupFor) return;
      if (d.found && d.inactive) setBookHint(d.message, 'bad');
      else if (d.found) {
        $('#bFirst').value = d.first_name; $('#bLast').value = d.last_name;
        if (d.company_id) $('#bCompany').value = String(d.company_id);
        setBookHint('เคยมาแล้ว เติมชื่อและบริษัทให้แล้ว ถามคนขับว่ายังถูกต้องไหม', 'ok');
        $('#bPlate').focus();
      } else setBookHint('คนขับใหม่ กรอกข้อมูลให้ครบ');
    } catch (ex) { /* ค้นไม่ได้ก็กรอกเองได้ */ }
  });

  $('#bookForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const b = {
      phone: $('#bPhone').value.trim(), first_name: $('#bFirst').value.trim(), last_name: $('#bLast').value.trim(),
      company_id: $('#bCompany').value, plate_no: $('#bPlate').value, trailer_plate: $('#bTrailer').value,
      destination_id: $('#bDest').value, source: 'staff',
    };
    const err = $('#bErr');
    if (digits(b.phone).length < 9) return (err.textContent = 'กรุณากรอกเบอร์โทรให้ถูกต้อง');
    if (!b.first_name) return (err.textContent = 'กรุณากรอกชื่อ');
    if (!b.last_name) return (err.textContent = 'กรุณากรอกนามสกุล');
    if (!b.company_id) return (err.textContent = 'กรุณาเลือกบริษัทขนส่ง');
    if (!plate.isValid(b.plate_no)) return (err.textContent = `กรุณากรอกทะเบียนหัวให้ถูกรูปแบบ เช่น ${plate.example}`);
    if (!plate.isValid(b.trailer_plate)) return (err.textContent = `กรุณากรอกทะเบียนหางให้ถูกรูปแบบ เช่น ${plate.example}`);
    if (!b.destination_id) return (err.textContent = 'กรุณาเลือกปลายทาง (ถ้าไม่ทราบ เลือก "ไม่ระบุ")');
    err.textContent = '';
    bookPending = b;
    const sel = (s) => s.options[s.selectedIndex]?.textContent || '';
    $('#bSummary').innerHTML = [
      ['เบอร์โทร', b.phone], ['ชื่อ - นามสกุล', `${b.first_name} ${b.last_name}`], ['บริษัทขนส่ง', sel($('#bCompany'))],
      ['ทะเบียนหัว', b.plate_no], ['ทะเบียนหาง', b.trailer_plate], ['ปลายทาง', sel($('#bDest'))],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    $('#bReviewErr').textContent = '';
    showBookStep('review');
    const btn = $('#bConfirm'); let left = BOOK_DELAY_S;
    clearInterval(bookTimer); btn.disabled = true; btn.textContent = `ทวนข้อมูล… (${left})`;
    bookTimer = setInterval(() => {
      left -= 1;
      if (left > 0) { btn.textContent = `ทวนข้อมูล… (${left})`; return; }
      clearInterval(bookTimer); btn.disabled = false; btn.textContent = 'ยืนยันจองคิว';
    }, 1000);
  });

  $('#bEdit').addEventListener('click', () => { clearInterval(bookTimer); showBookStep('form'); });

  $('#bConfirm').addEventListener('click', async () => {
    if (!bookPending) return;
    const btn = $('#bConfirm'); btn.disabled = true; btn.textContent = 'กำลังจองคิว…';
    try {
      const q = await api('/api/queues', { method: 'POST', body: JSON.stringify(bookPending) });
      const s = await api(`/api/queues/${q.id}?token=${encodeURIComponent(q.token)}`).catch(() => null);
      const b = bookPending; bookPending = null;
      $('#bookResult').innerHTML = `
        <span class="muted">จองคิวสำเร็จ · เลขคิว</span>
        <div class="big">${esc(q.queue_no)}</div>
        <div><b>${esc(b.first_name)} ${esc(b.last_name)}</b><br><span class="muted">${esc(plate.pair(b))}${s ? ' · ' + esc(s.destination) : ''}</span></div>
        <div class="note">บอกเลขคิว <b>${esc(q.queue_no)}</b> ให้คนขับ${s ? `<br>รถรอก่อนหน้า ${s.ahead ?? 0} คัน · คาดว่าเรียกประมาณ ${hhmm(s.estimated_call_at)}` : ''}<br>เมื่อถึงคิว พนักงานจะโทรตามที่เบอร์ ${esc(b.phone)}</div>
        <button class="btn primary full" type="button" id="bNext">จองคิวให้คนถัดไป</button>`;
      $('#bookForm').reset(); setBookHint(''); bookLookupFor = '';
      showBookStep('result');
      $('#bNext').onclick = () => showBookStep('form');
      toast(`จองคิว ${q.queue_no} แล้ว`);
    } catch (ex) {
      $('#bReviewErr').textContent = ex.message + ' · กด "แก้ไขข้อมูล" เพื่อแก้';
      btn.disabled = false; btn.textContent = 'ยืนยันจองคิว';
    }
  });

  function showBookStep(step) {
    $('#bookForm').hidden = step !== 'form';
    $('#bookReview').hidden = step !== 'review';
    $('#bookResult').hidden = step !== 'result';
    window.scrollTo(0, 0);
    if (step === 'form') $('#bPhone').focus();
  }

  /* ---------- สลับหน้า + อัปเดตเวลา ---------- */
  function render() {
    if (!board) return;
    if (view === 'queue') renderQueue();
    else if (view === 'dashboard') renderDashboard();
  }
  function route() {
    const h = location.hash.slice(1);
    view = ['dashboard', 'book'].includes(h) ? h : 'queue';
    $('#view-queue').hidden = view !== 'queue';
    $('#view-book').hidden = view !== 'book';
    $('#view-dashboard').hidden = view !== 'dashboard';
    document.querySelectorAll('[data-tab]').forEach((a) => a.dataset.tab === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    tip.hidden = true;
    if (view === 'book' && !bookListsLoaded) loadBookLists();
    load();
  }
  window.addEventListener('hashchange', route);

  // ทุกวินาที: เดินตัวจับเวลา และขึ้นแดงเมื่อเกินเวลา
  setInterval(() => {
    const t = now();
    $('#clock').textContent = new Date(t).toLocaleTimeString('th-TH');
    document.querySelectorAll('[data-since]').forEach((el) => {
      const ms = t - Number(el.dataset.since);
      el.textContent = el.dataset.fmt === 'dur' ? dur(ms) : clock(ms);
      if (el.dataset.warn) {
        const over = ms > Number(el.dataset.warn);
        el.classList.toggle('warn', over);
        if (el.hasAttribute('data-late')) el.closest('.dock')?.classList.toggle('late', over);
      }
    });
  }, 1000);

  setInterval(() => { if (!busy && !armed) load(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  route();
})();
