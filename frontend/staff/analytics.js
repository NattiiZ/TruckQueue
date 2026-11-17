// หน้ารายงานวิเคราะห์: ปริมาณรถตามช่วงเวลา · สัดส่วนตามปลายทาง · ระยะเวลาแต่ละขั้นตอน
// ช่วงเวลา: วันนี้ / เลือกวันที่ (สรุปวันเดียว) หรือย้อนหลัง 7 / 30 / 90 วัน
(() => {
  const { esc, store, api } = window.TQ;
  const $ = (s) => document.querySelector(s);
  const pad2 = (n) => String(n).padStart(2, '0');
  const r0 = (v) => (v == null ? '–' : Math.round(v));
  const r1 = (v) => (v == null ? '–' : (Math.round(v * 10) / 10).toString());
  const DAYS_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const DAYS_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const HOURS = Array.from({ length: 9 }, (_, i) => i + 8);        // 08:00–17:00 น. (ช่องสุดท้าย 16:00–17:00)
  const STAGES = [
    { key: 'wait', name: 'รอเรียกคิว', cls: 1 },
    { key: 'to_dock', name: 'เดินทางเข้าจุดรับสินค้าหลังถูกเรียก', cls: 2 },
    { key: 'loading', name: 'โหลดสินค้า', cls: 3 },
    { key: 'exit_wait', name: 'โหลดเสร็จจนถึงออกจากคลัง', cls: 4 },
  ];
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const span = (h) => `${pad2(h)}:00–${pad2((h + 1) % 24)}:00 น.`;
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

  let days = Number(store.get('truckq-analytics-days')) || 30;
  if (![1, 7, 30, 90].includes(days)) days = 30;
  let date = null;                                                   // วันที่เลือกเอง (null = นับจากวันนี้)
  const pick = $('#pickDay');
  pick.max = localDate();

  async function load() {
    document.querySelectorAll('[data-days]').forEach((b) => b.setAttribute('aria-pressed', !date && Number(b.dataset.days) === days));
    pick.classList.toggle('on', !!date);
    if (!date) pick.value = '';
    try {
      const data = await api.getAnalytics(date ? 1 : days, date || undefined);
      $('#netBanner').hidden = true;
      render(data);
    } catch (e) {
      const n = $('#netBanner'); n.textContent = e.message; n.hidden = false;
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-days]');
    if (b) { days = Number(b.dataset.days); date = null; store.set('truckq-analytics-days', days); load(); }
  });
  pick.addEventListener('change', () => { date = pick.value || null; load(); });

  // ค่าเฉลี่ยรวมทุกจุด (ถ่วงน้ำหนักตามจำนวนคัน) · ใช้ทั้งการ์ดสรุปและหัวข้อที่ 3
  function overallStages(d) {
    const n = d.stages.reduce((a, s) => a + s.n, 0);
    if (!n) return null;
    const o = { dock_name: 'รวมทุกจุด', n, total: true };
    STAGES.forEach((st) => { o[st.key] = d.stages.reduce((a, s) => a + (s[st.key] || 0) * s.n, 0) / n; });
    return o;
  }
  const sumOf = (r) => STAGES.reduce((a, st) => a + Math.max(0, r[st.key] || 0), 0);

  function render(d) {
    const oneDay = d.days === 1;
    const fmt = (s, o) => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', o || { day: 'numeric', month: 'short', year: '2-digit' });
    $('#rangeTxt').textContent = oneDay
      ? `สรุปประจำ${fmt(d.from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${d.from === localDate() ? ' (วันนี้)' : ''}`
      : `ข้อมูลระหว่างวันที่ ${fmt(d.from)} – ${fmt(d.to)} (${d.days} วัน)`;
    const overall = overallStages(d);
    // การ์ดสรุป · "จำนวนรถทั้งหมด" นับเฉพาะรถที่ออกจากคลังแล้ว
    const overTxt = d.exited ? `ร้อยละ ${pct(d.over_std, d.exited)} ของรถที่ออกแล้ว` : '';
    const inYard = overall ? r0(sumOf(overall)) : '–';
    const busiest = [...d.daily].sort((a, b) => b.n - a.n)[0];
    const cards = oneDay
      ? [
          ['จำนวนรถทั้งหมด', d.exited, 'คัน', 'ออกจากคลังแล้ว'],
          ['ยังอยู่ในคลัง', d.total - d.exited, 'คัน', 'ยังไม่บันทึกออก'],
          ['ระยะเวลาเฉลี่ยในคลัง', inYard, 'นาที/คัน', 'ตั้งแต่ลงทะเบียนจนออก'],
          ['โหลดเกินเวลามาตรฐาน', d.over_std, 'คัน', overTxt],
        ]
      : [
          ['จำนวนรถทั้งหมด', d.exited, 'คัน', 'ออกจากคลังแล้ว'],
          ['เฉลี่ยต่อวัน', d.daily.length ? Math.floor(d.exited / d.daily.length) : '–', 'คัน/วัน', `จาก ${d.daily.length} วันที่มีรถ`],
          ['ระยะเวลาเฉลี่ยในคลัง', inYard, 'นาที/คัน', 'ตั้งแต่ลงทะเบียนจนออก'],
          ['โหลดเกินเวลามาตรฐาน', d.over_std, 'คัน', overTxt],
          ['วันที่รถมากที่สุด', busiest ? busiest.n : '–', 'คัน', busiest ? fmt(busiest.date, { weekday: 'short', day: 'numeric', month: 'short' }) : ''],
        ];
    $('#summary').innerHTML = cards.map(([l, v, u, sub]) => `<div class="num"><span>${l}</span><b>${v}<small>${u}</small></b>${sub ? `<em>${sub}</em>` : ''}</div>`).join('');
    $('#emptyState').hidden = d.total > 0;
    if (oneDay) renderPeakDay(d); else renderPeak(d);
    renderBars('#destBars', d.destinations);
    renderBars('#compBars', d.companies);
    renderStages(d, overall);
    $('#dailySec').hidden = oneDay;
    if (!oneDay) renderDaily(d);
  }

  // วาด heatmap 24 ชั่วโมง · rows = [{ label, val(h) → ตัวเลข, tipOf(h) → ข้อความ }] · peakKey = 'แถว-ชั่วโมง'
  function drawHeat(rows, peakKey, fmtVal) {
    const max = Math.max(0, ...rows.flatMap((r) => HOURS.map((h) => r.val(h))));
    const heat = $('#heatmap');
    heat.style.gridTemplateColumns = `64px repeat(${HOURS.length}, minmax(44px, 1fr))`;
    let html = '<span></span>' + HOURS.map((h) => `<span class="h-lab">${pad2(h)}:00</span>`).join('');
    rows.forEach((r, i) => {
      html += `<span class="d-lab">${r.label}</span>`;
      for (const h of HOURS) {
        const v = r.val(h), t = max ? v / max : 0;
        const bg = v ? `background:rgba(0,91,172,${(0.08 + 0.92 * t).toFixed(2)});color:${t > 0.5 ? '#fff' : 'var(--fg)'}` : '';
        html += `<span class="cell${`${i}-${h}` === peakKey ? ' peak' : ''}" style="${bg}" data-tip="${esc(r.tipOf(h))}">${v ? fmtVal(v) : ''}</span>`;
      }
    });
    heat.innerHTML = html;
  }

  /* ---------- 1) ปริมาณรถตามช่วงเวลา: ย้อนหลังหลายวัน (วัน × ชั่วโมง เฉลี่ยต่อวัน) ---------- */
  function renderPeak(d) {
    const daysOf = (wd) => d.weekday_days.find((x) => x.wd === wd)?.days || 0;
    const avg = (wd, h) => { const c = d.peak.find((x) => x.wd === wd && x.hour === h); return c && daysOf(wd) ? c.n / daysOf(wd) : 0; };

    const cells = [];
    for (let wd = 0; wd < 7; wd++) for (const h of HOURS) cells.push({ wd, h, v: avg(wd, h) });
    const top = cells.filter((c) => c.v > 0).sort((a, b) => b.v - a.v);
    drawHeat(
      [0, 1, 2, 3, 4, 5, 6].map((wd) => ({
        label: DAYS_SHORT[wd],
        val: (h) => avg(wd, h),
        tipOf: (h) => (daysOf(wd) ? `วัน${DAYS_TH[wd]} ${span(h)} · เฉลี่ย ${r1(avg(wd, h))} คัน/วัน (จาก ${daysOf(wd)} วัน)` : `วัน${DAYS_TH[wd]} · ไม่มีข้อมูล`),
      })),
      top[0] ? `${top[0].wd}-${top[0].h}` : '',
      r1,
    );
  }

  /* ---------- 1) ปริมาณรถตามช่วงเวลา: วันเดียว (จำนวนคันต่อชั่วโมง) ---------- */
  function renderPeakDay(d) {
    const count = (h) => d.peak.filter((x) => x.hour === h).reduce((a, x) => a + x.n, 0);
    const top = HOURS.map((h) => ({ h, v: count(h) })).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const label = new Date(d.from + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    drawHeat([{ label, val: count, tipOf: (h) => `${span(h)} · ${count(h)} คัน` }], top[0] ? `0-${top[0].h}` : '', (v) => v);
  }

  /* ---------- 2) ปลายทาง · 3) บริษัทขนส่ง: แท่งแนวนอน จำนวนคัน + % ---------- */
  function renderBars(sel, items) {
    const total = items.reduce((a, x) => a + x.n, 0);
    const max = Math.max(1, ...items.map((x) => x.n));
    $(sel).innerHTML = items.length ? items.map((x) => `<div class="hbar" data-tip="${esc(`${x.name}: ${x.n} คัน (ร้อยละ ${pct(x.n, total)})`)}">
      <span class="name">${esc(x.name)}</span>
      <span class="track"><span class="fill" style="width:${(x.n / max * 100).toFixed(1)}%"></span></span>
      <span class="val">${x.n} <small>(${pct(x.n, total)}%)</small></span></div>`).join('') : '<p class="muted">ไม่พบข้อมูล</p>';
  }

  /* ---------- 5) จำนวนรถที่ออกจากคลังรายวัน (ย้อนหลังหลายวัน) ---------- */
  function renderDaily(d) {
    // ทุกวันในช่วง (วันที่ไม่มีรถ = 0)
    const byDate = new Map(d.daily.map((x) => [x.date, x.n]));
    const days = [];
    for (let t = new Date(d.from + 'T00:00:00'); localDate(t) <= d.to; t.setDate(t.getDate() + 1)) days.push({ date: localDate(t), wd: (t.getDay() + 6) % 7, n: byDate.get(localDate(t)) || 0 });
    const W = 960, H = 220, L = 34, R = 8, T = 22, B = 30, pw = W - L - R, ph = H - T - B;
    const top = Math.max(1, ...days.map((x) => x.n));
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => top / s <= 5) || Math.ceil(top / 5);
    const max = Math.ceil(top / step) * step;
    const avg = d.daily.length ? d.exited / d.daily.length : 0;
    const y = (v) => T + ph - v / max * ph, bw = pw / days.length, w = Math.max(2, Math.min(28, bw * 0.7));
    const every = Math.ceil(days.length / 15);                      // ป้ายวันที่ไม่ให้ชนกัน
    const short = (s) => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
    for (let v = 0; v <= max; v += step) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    days.forEach((x, i) => {
      const cx = L + bw * i + bw / 2;
      if (x.n) s += `<rect class="${x.wd >= 5 ? 'f0' : 'f1'}" x="${cx - w / 2}" y="${y(x.n)}" width="${w}" height="${y(0) - y(x.n)}" rx="3"/>`;
      if (x.n && days.length <= 31) s += `<text class="ax" x="${cx}" y="${y(x.n) - 5}" text-anchor="middle">${x.n}</text>`;
      if (i % every === 0) s += `<text class="ax" x="${cx}" y="${H - 10}" text-anchor="middle">${short(x.date)}</text>`;
      s += `<rect class="hit" x="${L + bw * i}" y="${T}" width="${bw}" height="${ph}" data-tip="${esc(`${new Date(x.date + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })} · ${x.n} คัน`)}"/>`;
    });
    if (avg) s += `<line class="std" x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}"/>`;
    $('#dailyChart').innerHTML = s + '</svg>';
    $('#dailyAvg').textContent = avg ? `ค่าเฉลี่ย ${Math.floor(avg)} คัน/วัน` : 'ค่าเฉลี่ยต่อวัน';
  }

  /* ---------- 3) ระยะเวลาแต่ละขั้นตอน ---------- */
  function renderStages(d, overall) {
    $('#stageLegend').innerHTML = STAGES.map((s) => `<span><i class="sw k${s.cls}"></i>${s.name}</span>`).join('');
    if (!overall) { $('#stageBars').innerHTML = '<p class="muted">ยังไม่มีรถที่บันทึกออกจากคลังในช่วงเวลาที่เลือก</p>'; return; }

    const rows = [overall, ...d.stages];
    const maxTotal = Math.max(...rows.map(sumOf));
    $('#stageBars').innerHTML = rows.map((r) => {
      const tot = sumOf(r);
      const segs = STAGES.map((st) => {
        const v = Math.max(0, r[st.key] || 0), w = maxTotal ? v / maxTotal * 100 : 0;
        return v ? `<span class="seg s${st.cls}" style="width:${w.toFixed(2)}%" data-tip="${esc(`${r.dock_name} · ${st.name}: ${r0(v)} นาที (ร้อยละ ${pct(v, tot)})`)}">${w > 7 ? r0(v) : ''}</span>` : '';
      }).join('');
      return `<div class="stack-row${r.total ? ' total' : ''}"><div class="head"><b>${esc(r.dock_name)}</b><span>รวม ${r0(tot)} นาที · ${r.n} คัน</span></div><div class="stack">${segs}</div></div>`;
    }).join('');
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
