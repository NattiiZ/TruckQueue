// หน้าวิเคราะห์ข้อมูล: ช่วงเวลาที่รถเยอะ · ส่งไปไหน · เวลาหายไปไหน
(() => {
  const { esc, store, api } = window.TQ;
  const $ = (s) => document.querySelector(s);
  const pad2 = (n) => String(n).padStart(2, '0');
  const r0 = (v) => (v == null ? '–' : Math.round(v));
  const r1 = (v) => (v == null ? '–' : (Math.round(v * 10) / 10).toString());
  const DAYS_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const DAYS_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const STAGES = [
    { key: 'wait', name: 'รอคิว', cls: 1 },
    { key: 'to_dock', name: 'เดินทางเข้าจุดรับสินค้าหลังถูกเรียก', cls: 2 },
    { key: 'loading', name: 'โหลดสินค้า', cls: 3 },
    { key: 'exit_wait', name: 'โหลดเสร็จ → ออกจากคลัง', cls: 4 },
  ];

  let days = Number(store.get('truckq-analytics-days')) || 30;

  async function load() {
    document.querySelectorAll('[data-days]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.days) === days));
    try {
      const data = await api.getAnalytics(days);
      $('#netBanner').hidden = true;
      render(data);
    } catch (e) {
      const n = $('#netBanner'); n.textContent = e.message; n.hidden = false;
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-days]');
    if (b) { days = Number(b.dataset.days); store.set('truckq-analytics-days', days); load(); }
  });

  function render(d) {
    const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    $('#rangeTxt').textContent = `${fmt(d.from)} – ${fmt(d.to)} (${d.days} วัน)`;
    const doneCount = d.stages.reduce((a, s) => a + s.n, 0);
    $('#summary').innerHTML = [
      ['รถทั้งหมด', d.total, 'คัน'],
      ['วันทำการที่มีรถ', d.op_days, 'วัน'],
      ['เฉลี่ยต่อวันทำการ', d.op_days ? r1(d.total / d.op_days) : '–', 'คัน'],
      ['ออกจากคลังแล้ว', doneCount, 'คัน'],
    ].map(([l, v, u]) => `<div class="num"><span>${l}</span><b>${v}<small>${u}</small></b></div>`).join('');
    $('#emptyState').hidden = d.total > 0;
    renderPeak(d);
    renderDest(d);
    renderStages(d);
  }

  /* ---------- 1) ช่วงเวลาที่รถเยอะ ---------- */
  function renderPeak(d) {
    const daysOf = (wd) => d.weekday_days.find((x) => x.wd === wd)?.days || 0;
    const avg = (wd, h) => { const c = d.peak.find((x) => x.wd === wd && x.hour === h); return c && daysOf(wd) ? c.n / daysOf(wd) : 0; };
    const hoursData = d.peak.map((x) => x.hour);
    const from = Math.min(7, ...hoursData), to = Math.max(18, ...hoursData);
    const hours = []; for (let h = from; h <= to; h++) hours.push(h);

    const cells = [];
    for (let wd = 0; wd < 7; wd++) for (const h of hours) cells.push({ wd, h, v: avg(wd, h) });
    const max = Math.max(0, ...cells.map((c) => c.v));
    const top = [...cells].filter((c) => c.v > 0).sort((a, b) => b.v - a.v);
    const peakKey = top[0] ? `${top[0].wd}-${top[0].h}` : '';

    const heat = $('#heatmap');
    heat.style.gridTemplateColumns = `56px repeat(${hours.length}, minmax(30px, 1fr))`;
    let html = '<span></span>' + hours.map((h) => `<span class="h-lab">${pad2(h)}</span>`).join('');
    for (let wd = 0; wd < 7; wd++) {
      html += `<span class="d-lab">${DAYS_SHORT[wd]}</span>`;
      for (const h of hours) {
        const v = avg(wd, h), t = max ? v / max : 0;
        const bg = v ? `background:rgba(0,91,172,${(0.08 + 0.92 * t).toFixed(2)});color:${t > 0.5 ? '#fff' : 'var(--fg)'}` : '';
        const label = daysOf(wd) ? `${DAYS_TH[wd]} ${pad2(h)}:00–${pad2(h + 1)}:00 · เฉลี่ย ${r1(v)} คัน/วัน (จาก ${daysOf(wd)} วัน)` : `${DAYS_TH[wd]} · ไม่มีข้อมูล`;
        html += `<span class="cell${`${wd}-${h}` === peakKey ? ' peak' : ''}" style="${bg}" data-tip="${esc(label)}">${v ? r1(v) : ''}</span>`;
      }
    }
    heat.innerHTML = html;

    // ข้อสังเกต: ช่วงที่รถเยอะที่สุด + ชั่วโมงที่เยอะที่สุดของทุกวันรวมกัน + วันที่รถเยอะที่สุด
    const ins = [];
    if (top.length) {
      ins.push(`ช่วงที่รถเยอะที่สุดคือ <b>วัน${DAYS_TH[top[0].wd]} ${pad2(top[0].h)}:00–${pad2(top[0].h + 1)}:00</b> เฉลี่ย ${r1(top[0].v)} คัน/วัน`);
      const totalDays = d.op_days || 1;
      const byHour = hours.map((h) => ({ h, v: d.peak.filter((x) => x.hour === h).reduce((a, x) => a + x.n, 0) / totalDays })).sort((a, b) => b.v - a.v);
      if (byHour[0]?.v) ins.push(`ถ้าดูทุกวันรวมกัน รถมาเยอะช่วง <b>${pad2(byHour[0].h)}:00</b> และ <b>${pad2(byHour[1].h)}:00</b> ควรมีคนโหลดครบทุกจุดในช่วงนี้`);
      const byDay = [0, 1, 2, 3, 4, 5, 6].map((wd) => ({ wd, v: daysOf(wd) ? d.peak.filter((x) => x.wd === wd).reduce((a, x) => a + x.n, 0) / daysOf(wd) : 0 })).sort((a, b) => b.v - a.v);
      if (byDay[0]?.v) ins.push(`วันที่รถเยอะที่สุดคือ <b>วัน${DAYS_TH[byDay[0].wd]}</b> เฉลี่ย ${r1(byDay[0].v)} คัน/วัน`);
    }
    $('#peakInsights').innerHTML = ins.map((t) => `<li>${t}</li>`).join('') || '<li class="muted">ยังไม่มีข้อมูล</li>';
  }

  /* ---------- 2) ส่งไปไหน ---------- */
  function renderDest(d) {
    const total = d.destinations.reduce((a, x) => a + x.n, 0);
    const max = Math.max(1, ...d.destinations.map((x) => x.n));
    $('#destBars').innerHTML = d.destinations.map((x) => `<div class="hbar" data-tip="${esc(`${x.name}: ${x.n} คัน (${Math.round(x.n / total * 100)}%)`)}">
      <span class="name">${esc(x.name)}</span>
      <span class="track"><span class="fill" style="width:${(x.n / max * 100).toFixed(1)}%"></span></span>
      <span class="val">${x.n} <small>(${Math.round(x.n / total * 100)}%)</small></span></div>`).join('');
    const ins = [];
    if (d.destinations.length) {
      const known = d.destinations.filter((x) => x.name !== 'ไม่ระบุ');
      if (known[0]) ins.push(`ส่งไป <b>${esc(known[0].name)}</b> มากที่สุด ${known[0].n} คัน (${Math.round(known[0].n / total * 100)}%)`);
      if (known.length >= 3) { const top3 = known.slice(0, 3).reduce((a, x) => a + x.n, 0); ins.push(`3 ปลายทางแรกรวมกันเป็น ${Math.round(top3 / total * 100)}% ของรถทั้งหมด`); }
      const unknown = d.destinations.find((x) => x.name === 'ไม่ระบุ');
      if (unknown && unknown.n / total >= 0.1) ins.push(`มีรถ "ไม่ระบุ" ปลายทาง ${Math.round(unknown.n / total * 100)}% ถ้าลดได้ รายงานจะแม่นขึ้น`);
    }
    $('#destInsights').innerHTML = ins.map((t) => `<li>${t}</li>`).join('') || '<li class="muted">ยังไม่มีข้อมูล</li>';
  }

  /* ---------- 3) เวลาหายไปไหน ---------- */
  function renderStages(d) {
    $('#stageLegend').innerHTML = STAGES.map((s) => `<span><i class="sw k${s.cls}"></i>${s.name}</span>`).join('');
    if (!d.stages.length) { $('#stageBars').innerHTML = ''; $('#stageInsights').innerHTML = '<li class="muted">ยังไม่มีรถที่ออกจากคลังในช่วงนี้</li>'; return; }

    // ค่าเฉลี่ยรวมทุกจุด (ถ่วงน้ำหนักตามจำนวนคัน)
    const n = d.stages.reduce((a, s) => a + s.n, 0);
    const overall = { dock_name: 'รวมทุกจุด', n, total: true };
    STAGES.forEach((st) => { overall[st.key] = d.stages.reduce((a, s) => a + (s[st.key] || 0) * s.n, 0) / n; });
    const rows = [overall, ...d.stages];
    const sumOf = (r) => STAGES.reduce((a, st) => a + Math.max(0, r[st.key] || 0), 0);
    const maxTotal = Math.max(...rows.map(sumOf));

    $('#stageBars').innerHTML = rows.map((r) => {
      const tot = sumOf(r);
      const segs = STAGES.map((st) => {
        const v = Math.max(0, r[st.key] || 0), w = maxTotal ? v / maxTotal * 100 : 0;
        return v ? `<span class="seg s${st.cls}" style="width:${w.toFixed(2)}%" data-tip="${esc(`${r.dock_name} · ${st.name}: ${r0(v)} นาที (${Math.round(v / tot * 100)}%)`)}">${w > 7 ? r0(v) : ''}</span>` : '';
      }).join('');
      return `<div class="stack-row${r.total ? ' total' : ''}"><div class="head"><b>${esc(r.dock_name)}</b><span>รวม ${r0(tot)} นาที · ${r.n} คัน</span></div><div class="stack">${segs}</div></div>`;
    }).join('');

    const tot = sumOf(overall);
    const biggest = [...STAGES].sort((a, b) => (overall[b.key] || 0) - (overall[a.key] || 0))[0];
    const ins = [`รถอยู่ในคลังเฉลี่ย <b>${r0(tot)} นาที</b>/คัน เป็นช่วง<b>${biggest.name}</b>มากที่สุด ${r0(overall[biggest.key])} นาที (${Math.round(overall[biggest.key] / tot * 100)}%)`];
    if (overall.to_dock >= 8) ins.push(`หลังถูกเรียก คนขับใช้เวลาเข้าจุดรับสินค้าเฉลี่ย ${r0(overall.to_dock)} นาที ช่วงนี้จุดรับสินค้าว่างรอรถอยู่ ลดได้ด้วยการแจ้งเตือนที่เร็วขึ้น`);
    if (overall.exit_wait >= 10) ins.push(`โหลดเสร็จแล้วกว่าจะออกเฉลี่ย ${r0(overall.exit_wait)} นาที อาจติดเรื่องเอกสารหรือการตรวจที่ประตู`);
    if (d.stages.length > 1) {
      const slow = [...d.stages].sort((a, b) => (b.loading || 0) - (a.loading || 0))[0];
      ins.push(`จุดที่โหลดนานที่สุดคือ <b>${esc(slow.dock_name)}</b> เฉลี่ย ${r0(slow.loading)} นาที/คัน`);
    }
    $('#stageInsights').innerHTML = ins.map((t) => `<li>${t}</li>`).join('');
  }

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
    const y = e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = y + 'px';
  });

  load();
})();
