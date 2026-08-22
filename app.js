/* app.js — Alongside client (Phase 2 core: Today + Manage + person switcher +
   item editor + Settings, on real APIs). History/export/images/notes-UI/polling
   land next. Reuses window.STR (i18n.js) and window.MED (logic.js). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, a = {}, ...k) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (v == null) continue; if (x === 'class') n.className = v; else if (x === 'html') n.innerHTML = v; else if (x.startsWith('on')) n.addEventListener(x.slice(2), v); else n.setAttribute(x, v); } for (const c of k.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const removeDialogs = () => document.querySelectorAll('.dialog-backdrop').forEach(n => n.remove());
  const M = window.MED;
  const TINTS = ['var(--color-accent-500)', 'var(--color-accent-2-500)', 'var(--color-accent-600)', 'var(--color-accent-2-600)', 'var(--color-accent-400)'];

  const state = {
    user: null, csrf: '',
    lang: localStorage.getItem('med_lang') || 'ro',
    textSize: localStorage.getItem('med_text') || 'Large',
    theme: localStorage.getItem('med_theme') || 'organic',
    mode: localStorage.getItem('med_mode') || 'light',   // light | dark | device
    showPhotos: localStorage.getItem('med_photos') !== '0',
    tab: 'today',
    profiles: [], sel: null, manageSel: null,
    items: [], logs: {},           // for the currently-loaded profile+today
    editItem: null,                // item-editor dialog state
    personDlg: null,               // family-member (profile) editor dialog state
    manageTab: 'lists',            // Manage sub-tab: 'lists' | 'members'
    weekOffset: 0,                 // History: 0 = this week, negative = past
    histDirty: false, histSnap: null,
    dayNote: '',                   // per-day note for the currently-loaded profile+today
    exportSel: null,               // Settings: which profile to export (defaults to Today's)
  };
  const SIZES = { Standard: 17, Large: 19, 'Extra large': 22 };
  const t = (k) => (window.STR[state.lang] && window.STR[state.lang][k]) ?? (window.STR.en[k] ?? k);
  const fmt = (k, v) => { let s = t(k); if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
  const todayISO = () => M.isoOf(new Date());
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmtMin = (m) => M.fmtMin(m, state.lang);
  const isoToDMY = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) ? iso.split('-').reverse().join('/') : '';
  function dmyToIso(s) { const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return null; const d = +m[1], mo = +m[2], y = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  // fractional doses: only 1/4 (0.25) and 1/2 (0.5) besides whole numbers
  function parseQty(s) { s = String(s).trim().replace(',', '.').replace('¼', '1/4').replace('½', '1/2'); if (s === '1/4') return 0.25; if (s === '1/2') return 0.5; const f = parseFloat(s); if (f === 0.25 || f === 0.5) return f; return Math.max(1, Math.round(f) || 1); }
  function qtyToStr(n) { return n === 0.25 ? '1/4' : n === 0.5 ? '1/2' : String(n); }
  function qtyLabel(n) { return n === 0.25 ? t('qtrWord') : n === 0.5 ? t('halfWord') : n; }
  // Romanian genitive for "Ziua {name}": female -a names → -ei (Mariana→Marianei); else "lui {name}"
  function roGenitive(name) {
    const n = (name || '').trim(); if (!n) return n; const low = n.toLowerCase();
    const maleA = ['luca', 'toma', 'mircea', 'ilie', 'nica', 'horia', 'barbu', 'costica', 'gica', 'aurica', 'vasilica'];
    if (/a$/.test(low) && !maleA.includes(low)) {
      if (/ca$/.test(low)) return n.slice(0, -2) + 'căi';   // Anca→Ancăi
      if (/ga$/.test(low)) return n.slice(0, -2) + 'găi';   // Olga→Olgăi
      return n.slice(0, -1) + 'ei';                          // Mariana→Marianei, Maria→Mariei, Ana→Anei
    }
    return 'lui ' + n;                                       // male / indeclinable
  }
  function pGen(name) { return state.lang === 'ro' ? roGenitive(name) : name; }
  function effMode() { return state.mode === 'device' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.mode; }
  function applyPrefs() {
    const root = SIZES[state.textSize] || 19;
    const de = document.documentElement;
    de.style.fontSize = root + 'px';                 // scales rem
    document.body.style.fontSize = (root * 15 / 19).toFixed(1) + 'px';     // body drives em/inherited text (Large=15px)
    de.lang = state.lang;
    de.dataset.theme = state.theme;
    de.dataset.mode = effMode();
  }
  function personName(p) { return p ? p.name : ''; }
  function tintFor(p, i) { return (p && p.tint) || TINTS[i % TINTS.length]; }

  async function api(path, opts = {}) {
    const o = Object.assign({ credentials: 'include', headers: {} }, opts);
    if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
    if ((o.method || 'GET') !== 'GET') o.headers['X-CSRF'] = state.csrf;
    const r = await fetch(path, o);
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error((j && j.error) || r.status), { status: r.status, data: j });
    return j;
  }
  // DB item -> handoff shape for MED + rendering
  function normItem(r) {
    return { id: r.id, type: r.type, name: r.name, count: r.count, group: r.grp, time: r.time_min,
      purpose: r.purpose, note: r.note, photo: r.photo_url, freq: r.freq, days: r.days || [], dom: r.dom,
      endMode: r.end_mode, endDate: r.end_date, endCount: r.end_count, startDate: r.start_date, everyDays: r.every_days || 1 };
  }

  /* ---------------- data ---------------- */
  async function loadProfiles() { state.profiles = (await api('/api/profiles.php?action=list')).profiles || []; if (!state.sel && state.profiles[0]) state.sel = state.profiles[0].id; if (!state.manageSel && state.profiles[0]) state.manageSel = state.profiles[0].id; }
  const dataCache = {};   // pid -> { items, logs } for today; makes profile-switching instant
  const chanCache = {};   // pid -> [channels]
  async function loadDay(pid) {
    if (!pid) { state.items = []; state.logs = {}; return; }
    const [it, dy] = await Promise.all([api('/api/items.php?action=list&profile=' + pid), api('/api/logs.php?action=day&profile=' + pid + '&date=' + todayISO())]);
    state.items = (it.items || []).map(normItem);
    state.logs = dy.logs || {};
    state.dayNote = dy.day_note || '';
    dataCache[pid] = { items: state.items, logs: state.logs, dayNote: state.dayNote };
  }
  async function refreshDay(pid, key) {   // background revalidate after showing cached data
    try {
      const [it, dy] = await Promise.all([api('/api/items.php?action=list&profile=' + pid), api('/api/logs.php?action=day&profile=' + pid + '&date=' + todayISO())]);
      const items = (it.items || []).map(normItem), logs = dy.logs || {}, dayNote = dy.day_note || '';
      dataCache[pid] = { items, logs, dayNote };
      if (loadedFor === key) { state.items = items; state.logs = logs; state.dayNote = dayNote; render(); }
    } catch (e) {}
  }
  async function setLog(itemId, status, takenMin, note) {
    const body = { profile_id: state.sel, item_id: itemId, date: todayISO(), status, taken_min: takenMin ?? null, note: note ?? null };
    if (status == null) delete state.logs[itemId]; else state.logs[itemId] = { status, taken_min: takenMin ?? null, note: note ?? null };
    if (dataCache[state.sel]) dataCache[state.sel].logs = state.logs;
    if (histCache[state.sel]) { const k = todayISO() + '|' + itemId; if (status == null) delete histCache[state.sel].logs[k]; else histCache[state.sel].logs[k] = state.logs[itemId]; }
    render();
    try { await api('/api/logs.php?action=set', { method: 'POST', body }); } catch (e) { await loadDay(state.sel); render(); }
  }

  /* ---------------- shell ---------------- */
  function render() { applyPrefs(); removeDialogs(); if (!state.user) return renderLogin(); const f = $('#frame'); f.innerHTML = ''; const screen = el('div', { class: 'screen', id: 'screen' }); f.append(screen, tabbar()); routeTab(screen); }
  const TAB_ICON = { today: 'today', history: 'calendar', manage: 'plus', settings: 'gear' };
  const TAB_LABEL = { today: 'navToday', history: 'navHistory', manage: 'navManage', settings: 'navSettings' };
  function tabbar() {
    const bar = el('nav', { id: 'tabbar' });
    ['today', 'history', 'manage', 'settings'].forEach(k => bar.append(el('button', { 'aria-current': state.tab === k ? 'page' : 'false', 'aria-label': t(TAB_LABEL[k]), onclick: () => { state.tab = k; render(); } },
      el('span', { class: 'ico', html: M.icon(TAB_ICON[k], 24, 'currentColor', 2.4) }), t(TAB_LABEL[k]))));
    return bar;
  }
  function greeting() { const h = new Date().getHours(); return t(h < 12 ? 'greetMorning' : h < 17 ? 'greetAfternoon' : 'greetEvening'); }
  function head(screen, kicker, title) {
    screen.append(el('div', { class: 'blob', style: 'width:220px;height:220px;background:var(--color-accent-2-200);top:-90px;right:-70px' }),
      el('div', { class: 'content' }, el('div', { class: 'appbar-kicker' }, kicker), el('h1', { class: 'appbar-title display' }, title)));
  }
  function switcher(selKey) {
    const row = el('div', { class: 'pswitch' });
    state.profiles.forEach((p, i) => row.append(el('button', { class: 'pchip' + (state[selKey] === p.id ? ' on' : ''), onclick: () => { state[selKey] = p.id; render(); } },
      el('span', { class: 'pchip-av', style: 'background:' + tintFor(p, i) }, (p.name || '?').charAt(0).toUpperCase()), p.name)));
    return row;
  }

  function routeTab(screen) {
    if (state.tab === 'settings') return renderSettings(screen);
    if (state.tab === 'history') { histRoute(screen); return; }
    if (state.tab === 'manage' && state.manageTab === 'members') { renderManageMembers(screen); return; }
    const pid = state.tab === 'manage' ? state.manageSel : state.sel;
    ensureLoaded(pid, screen);
  }
  function cur() { return state.profiles.find(p => p.id === state.sel); }
  function curManage() { return state.profiles.find(p => p.id === state.manageSel); }

  let loadedFor = null;
  async function ensureLoaded(pid, screen) {
    const key = state.tab + ':' + pid;
    if (loadedFor === key) { state.tab === 'today' ? renderToday(screen) : renderManage(screen); return; }
    loadedFor = key;
    if (dataCache[pid]) {                       // instant from cache, revalidate in background
      state.items = dataCache[pid].items; state.logs = dataCache[pid].logs; state.dayNote = dataCache[pid].dayNote || '';
      render(); refreshDay(pid, key); return;
    }
    renderSkeleton(screen);                      // first time: shimmer, then load
    await loadDay(pid);
    if (loadedFor === key) render();
  }
  function renderSkeleton(screen) {
    const isManage = state.tab === 'manage';
    const p = state.profiles.find(x => x.id === (isManage ? state.manageSel : state.sel));
    head(screen, isManage ? t('mngKicker') : greeting(), isManage ? t('mngTitle') : fmt('daysTitle', { name: pGen(personName(p)) }));
    screen.append(switcher(isManage ? 'manageSel' : 'sel'));
    const c = el('div', { class: 'content' });
    c.append(el('div', { class: 'sk sk-card', style: 'height:92px' }));
    for (let i = 0; i < 3; i++) c.append(el('div', { class: 'sk sk-card', style: 'height:' + (i === 0 ? 132 : 96) + 'px' }));
    screen.append(c);
  }

  /* ---------------- Today ---------------- */
  function scheduledToday(items) { const d = new Date(); return items.filter(it => M.isScheduledOn(it, d)); }
  function renderToday(screen) {
    const p = cur();
    head(screen, greeting() + ' · ' + new Date().toLocaleDateString(state.lang === 'ro' ? 'ro-RO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), fmt('daysTitle', { name: pGen(personName(p)) }));
    const c = el('div', { class: 'content' });
    screen.append(switcher('sel'));
    const all = scheduledToday(state.items);
    if (!state.items.length) {
      c.append(el('div', { class: 'empty' }, el('p', {}, fmt('noList', { name: pGen(personName(p)) })),
        el('button', { class: 'btn btn-primary', onclick: () => openEditor(null) }, t('addFirst'))));
      screen.append(c); return;
    }
    const total = all.length; let done = 0, skipped = 0;
    all.forEach(it => { const l = state.logs[it.id]; if (l && l.status === 'taken') done++; else if (l && l.status === 'skipped') skipped++; });
    const pending = total - done - skipped;
    // summary
    c.append(summaryCard(total, done, skipped, pending));
    // reminder banner
    const pills = all.filter(x => x.type === 'pill');
    c.append(reminderBanner(pills));
    // pill sections by group
    M.GROUPS.forEach(g => {
      const its = pills.filter(x => M.groupForMin(x.time) === g.key).sort((a, b) => a.time - b.time);
      if (!its.length) return;
      c.append(sectionHeader(g, its));
      its.forEach(it => c.append(itemCard(it)));
    });
    // activities
    const acts = all.filter(x => x.type === 'activity').sort((a, b) => a.time - b.time);
    if (acts.length) { c.append(el('div', { class: 'sec-head' }, el('span', { class: 'sec-ico', html: M.icon('activity', 20, 'var(--color-accent-2-700)') }), el('span', { class: 'sec-title display' }, t('secActivities')))); acts.forEach(it => c.append(itemCard(it))); }
    c.append(dayNoteCard());
    screen.append(c);
  }
  function summaryCard(total, done, skipped, pending) {
    const r = 30, circ = 2 * Math.PI * r, frac = total ? done / total : 0;
    const ring = `<svg width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="${r}" fill="none" stroke="var(--color-neutral-300)" stroke-width="8"/><circle cx="38" cy="38" r="${r}" fill="none" stroke="var(--color-accent-2-500)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - frac)}" transform="rotate(-90 38 38)"/><text x="38" y="43" text-anchor="middle" font-size="18" font-weight="700" fill="var(--color-text)">${done}/${total}</text></svg>`;
    let headline = total === 0 ? t('sumNothing') : pending === 0 ? t('sumAllDone') : fmt(pending === 1 ? 'sumPillLeft' : 'sumPillsLeft', { n: pending });
    let sub = total === 0 ? t('sumAddManage') : fmt('sumTaken', { done, total }) + (skipped ? ' · ' + fmt('sumNotTaken', { n: skipped }) : '');
    return el('div', { class: 'card summary elev-sm' }, el('div', { class: 'ring', html: ring }), el('div', {}, el('div', { class: 'sum-h' }, headline), el('div', { class: 'sum-sub muted' }, sub)));
  }
  function reminderBanner(pills) {
    const nm = nowMin(); let cls = 'rb-soon', txt = '';
    const secState = (g) => { const its = pills.filter(x => M.groupForMin(x.time) === g.key); if (!its.length) return null; const pend = its.filter(x => !state.logs[x.id]).length; return { g, pend, tone: pend === 0 ? 'done' : (nm >= g.start && nm < g.end) ? 'due' : (nm >= g.end ? 'over' : 'soon'), firstTime: its.sort((a, b) => a.time - b.time)[0].time }; };
    const secs = M.GROUPS.map(secState).filter(Boolean);
    const over = secs.find(s => s.tone === 'over' && s.pend), due = secs.find(s => s.tone === 'due' && s.pend), next = secs.filter(s => s.pend && s.tone === 'soon').sort((a, b) => a.firstTime - b.firstTime)[0];
    if (over) { cls = 'rb-alert'; txt = fmt('remOverdue', { group: t('group' + cap(over.g.key)) }); }
    else if (due) { cls = 'rb-alert'; txt = fmt('remDue', { group: t('group' + cap(due.g.key)) }); }
    else if (next) { cls = 'rb-soon'; txt = fmt('remNext', { group: t('group' + cap(next.g.key)), time: fmtMin(next.firstTime) }); }
    else { cls = 'rb-done'; const anySkip = pills.some(x => state.logs[x.id] && state.logs[x.id].status === 'skipped'); txt = t(anySkip ? 'remAllDonePlain' : 'remAllDone'); }
    return el('div', { class: 'rbanner ' + cls }, el('span', { class: 'rb-ico', html: M.icon('bell', 18, 'currentColor', 2.4) }), txt);
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const GNAME = { morning: 'morning', noon: 'noon', evening: 'evening', bedtime: 'bedtime' };
  function sectionHeader(g, its) {
    const nm = nowMin(); const pend = its.filter(x => !state.logs[x.id]).length;
    const tone = pend === 0 ? 'done' : (nm >= g.start && nm < g.end) ? 'due' : (nm >= g.end ? 'over' : 'soon');
    const badge = { done: ['badgeAllDone', 'b-done'], due: ['badgeDue', 'b-due'], over: ['badgeOverdue', 'b-over'], soon: ['badgeSoon', 'b-soon'] }[tone];
    return el('div', { class: 'sec-head' },
      el('span', { class: 'sec-ico', html: M.icon(GNAME[g.key], 20, 'var(--color-accent-2-700)') }),
      el('div', { style: 'flex:1' }, el('span', { class: 'sec-title display' }, t(g.label)),
        el('div', { class: 'sec-rem muted', html: M.icon('bell', 13, 'currentColor', 2.4) + ' ' + fmt('reminderWord', { time: fmtMin(its[0].time) }) })),
      el('span', { class: 'tag ' + badge[1] }, t(badge[0])));
  }
  function itemCard(it) {
    const l = state.logs[it.id]; const isAct = it.type === 'activity';
    const av = state.showPhotos ? itemAvatar(it, 'itc-av', isAct, 26) : null;
    const detail = isAct ? (it.purpose || '') : (fmt('take', { n: qtyLabel(it.count) }) + (it.purpose ? ' · ' + fmt('forPurpose', { purpose: (it.purpose || '').toLowerCase() }) : ''));
    const body = el('div', { style: 'flex:1;min-width:0' },
      el('div', { class: 'itc-top' }, el('span', { class: 'itc-name' }, it.name), el('span', { class: 'itc-time muted', html: M.icon('clock', 14, 'currentColor', 2.4) + ' ' + esc(fmtMin(it.time)) })),
      detail ? el('div', { class: 'itc-detail muted' }, detail) : null,
      it.note ? el('span', { class: 'itc-note' }, it.note) : null,
      actionZone(it, l, isAct),
      l ? controlsRow(it, l, isAct) : null);
    return el('div', { class: 'card itemcard elev-sm' }, av, body);
  }
  function miniLink(iconName, label, onclick) {
    return el('button', { class: 'linklike ml', onclick }, el('span', { class: 'ml-ic', html: M.icon(iconName, 13, 'currentColor', 2.2) }), el('span', { class: 'ml-tx' }, label));
  }
  function controlsRow(it, l, isAct) {   // edit-time + note on one line
    const row = el('div', { class: 'itc-linkrow' });
    if (l.status === 'taken') row.append(miniLink('clock', t('editTime'), (ev) => toggleTimeEdit(it, ev)));
    if (l.note) row.append(el('button', { class: 'linklike ml', onclick: (ev) => toggleNoteEdit(it, l, ev) }, el('span', { class: 'ml-ic', html: M.icon('note', 13, 'currentColor', 2.2) }), el('span', { class: 'ml-tx' }, l.note)));
    else row.append(miniLink('note', t('addNote'), (ev) => toggleNoteEdit(it, l, ev)));
    return row;
  }
  function toggleTimeEdit(it, ev) {
    const link = ev.target.closest('.linklike'); if (!link) return;
    const sel = el('select', { class: 'input timesel' }); for (let m = 0; m < 1440; m += 30) sel.append(el('option', { value: m, selected: Math.abs((state.logs[it.id].taken_min ?? it.time) - m) < 15 ? 'selected' : null }, fmtMin(m)));
    sel.addEventListener('change', () => setLog(it.id, 'taken', parseInt(sel.value, 10)));
    link.replaceWith(sel); sel.focus();
  }
  function toggleNoteEdit(it, l, ev) {
    const row = ev.target.closest('.itc-linkrow'); const ex = row.parentElement.querySelector('.noteedit'); if (ex) { ex.remove(); return; }
    row.parentElement.querySelectorAll('.timeedit').forEach(n => n.remove());
    const ta = el('textarea', { class: 'input noteedit-ta', rows: 2, placeholder: t('notePh'), maxlength: 300 }); ta.value = l.note || '';
    let saved = false; const save = () => { if (saved) return; saved = true; const v = ta.value.trim(); setLog(it.id, l.status, l.taken_min ?? null, v || null); };
    ta.addEventListener('blur', save);
    row.after(el('div', { class: 'noteedit' }, ta)); ta.focus();
  }
  function dayNoteCard() {
    const wrap = el('div', { class: 'card daynote elev-sm' }, el('div', { class: 'dn-label', html: M.icon('note', 16, 'currentColor', 2.2) + ' ' + esc(t('noteToday')) }));
    const ta = el('textarea', { class: 'input dn-ta', rows: 2, placeholder: t('noteTodayPh') });
    ta.value = state.dayNote || '';
    let saved = state.dayNote || '';
    ta.addEventListener('blur', async () => { const v = ta.value.trim(); if (v === saved) return; saved = v; state.dayNote = v; if (dataCache[state.sel]) dataCache[state.sel].dayNote = v; try { await api('/api/logs.php?action=daynote', { method: 'POST', body: { profile_id: state.sel, date: todayISO(), note: v } }); } catch (e) {} });
    wrap.append(ta);
    return wrap;
  }
  function actionZone(it, l, isAct) {
    if (!l) return el('div', { class: 'itc-actions' },
      el('button', { class: 'btn btn-primary', onclick: () => setLog(it.id, 'taken', nowMin()), html: M.icon('check', 18, 'currentColor', 2.6) + ' ' + esc(t(isAct ? 'btnDone' : 'btnTaken')) }),
      el('button', { class: 'btn btn-secondary', onclick: () => setLog(it.id, 'skipped'), html: M.icon('x', 18, 'currentColor', 2.6) + ' ' + esc(t(isAct ? 'btnDidntDo' : 'btnDidnt')) }));
    if (l.status === 'taken') {
      const label = l.taken_min != null ? fmt(isAct ? 'doneAt' : 'takenAt', { time: fmtMin(l.taken_min) }) : t(isAct ? 'doneWord' : 'takenWord');
      return el('div', { class: 'statebar sb-taken' }, el('span', { html: M.icon('check', 18, 'var(--color-accent-2-700)', 2.6) }), el('span', { style: 'flex:1' }, label),
        el('button', { class: 'btn btn-ghost small', onclick: () => setLog(it.id, null) }, t('btnChange')));
    }
    return el('div', { class: 'statebar sb-skip' }, el('span', { html: M.icon('x', 18, 'var(--color-accent-700)', 2.6) }), el('span', { style: 'flex:1' }, t(isAct ? 'markedNotAct' : 'markedNot')),
      el('button', { class: 'btn btn-ghost small', onclick: () => setLog(it.id, null) }, t('btnChange')));
  }

  /* ---------------- Manage (sub-tabs: Lists / Family members) ---------------- */
  function manageSubtabs() {
    const bar = el('div', { class: 'subtabs' });
    [['lists', 'tabLists'], ['members', 'familyMembers']].forEach(([k, lab]) =>
      bar.append(el('button', { class: 'subtab' + (state.manageTab === k ? ' on' : ''), onclick: () => { state.manageTab = k; render(); } }, t(lab))));
    return bar;
  }
  function renderManage(screen) {   // Lists sub-tab
    const p = curManage();
    head(screen, t('mngKicker'), t('mngTitle'));
    screen.append(manageSubtabs(), switcher('manageSel'));
    const c = el('div', { class: 'content' });
    c.append(el('div', { class: 'mng-listhead' }, el('h2', { class: 'display', style: 'font-size:1.25em' }, fmt('listOf', { name: pGen(personName(p)) })),
      el('button', { class: 'btn btn-primary', onclick: () => openEditor(null), html: M.icon('plus', 18, 'currentColor', 2.6) + ' ' + esc(t('addBtn')) })));
    if (!state.items.length) c.append(el('p', { class: 'soon' }, fmt('noList', { name: pGen(personName(p)) })));
    state.items.slice().sort((a, b) => (a.group + a.time) < (b.group + b.time) ? -1 : 1).forEach(it => {
      const meta = it.type === 'pill' ? [fmt('take', { n: qtyLabel(it.count) }), t('group' + cap(M.groupForMin(it.time))), it.purpose].filter(Boolean).join(' · ')
        : [t('typeActivity'), t('group' + cap(M.groupForMin(it.time))), it.purpose].filter(Boolean).join(' · ');
      const rec = recurText(it);
      c.append(el('div', { class: 'mrow card' },
        state.showPhotos ? itemAvatar(it, 'mrow-av', it.type === 'activity', 22) : null,
        el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'font-weight:700' }, it.name), el('div', { class: 'meta' }, meta), rec ? el('div', { class: 'rec' }, rec) : null),
        el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('notifyNow'), title: t('notifyNow'), onclick: () => notifyNow(it), html: M.icon('bell', 18) }),
        el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('editPerson'), onclick: () => openEditor(it), html: M.icon('pencil', 18) }),
        el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('removePhoto'), onclick: () => removeItem(it), html: M.icon('trash', 18) })));
    });
    c.append(notifSection(state.manageSel));
    screen.append(c);
  }
  /* ---- Notifications (Telegram) ---- */
  const TG_LOGO = '<svg viewBox="0 0 240 240" width="26" height="26" aria-hidden="true"><circle cx="120" cy="120" r="120" fill="#229ED9"/><path fill="#fff" d="M53 118l122-47c6-2 11 1 9 10l-21 98c-1 6-5 8-10 5l-28-21-13 13c-2 2-3 3-6 3l2-30 55-50c2-2 0-3-3-1l-68 43-29-9c-6-2-6-6 1-9z"/></svg>';
  function notifSection(pid) {
    const wrap = el('div', { style: 'margin-top:22px' });
    wrap.append(el('h2', { class: 'display', style: 'font-size:1.12em;margin:0 0 4px' }, t('notifTitle')),
      el('p', { class: 'muted', style: 'margin:0 0 10px' }, t('notifNote')));
    const chans = chanCache[pid];
    if (chans === undefined) { fetchChannels(pid); wrap.append(el('div', { class: 'sk', style: 'height:56px' })); return wrap; }
    if (!chans.length) wrap.append(el('p', { class: 'muted', style: 'margin:0 0 8px' }, t('notifNone')));
    chans.forEach(ch => wrap.append(el('div', { class: 'mrow' },
      el('span', { class: 'tg-logo', html: TG_LOGO }),
      el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'font-weight:700' }, ch.label || 'Telegram'), el('div', { class: 'meta' }, ch.verified ? t('verifiedWord') : t('pendingWord'))),
      el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('unlinkWord'), onclick: () => unlinkChan(pid, ch.id), html: M.icon('trash', 18) }))));
    if (chans.filter(c => c.verified).length < 3)
      wrap.append(el('button', { class: 'btn btn-secondary btn-block tg-btn', style: 'margin-top:6px', onclick: () => linkTelegram(pid), html: TG_LOGO + ' ' + esc(t('linkTelegram')) }));
    return wrap;
  }
  async function fetchChannels(pid) { try { const r = await api('/api/channels.php?action=list&profile=' + pid); chanCache[pid] = r.channels || []; if (state.tab === 'manage') render(); } catch (e) { chanCache[pid] = []; } }
  function unlinkChan(pid, id) {
    confirmDialog(t('confirmDelTitle'), t('confirmDelChannel'), t('deleteWord'), async () => {
      try { await api('/api/channels.php?action=unlink', { method: 'POST', body: { profile_id: pid, id } }); } catch (e) {} chanCache[pid] = undefined; render();
    });
  }
  async function linkTelegram(pid) {
    let r; try { r = await api('/api/channels.php?action=link', { method: 'POST', body: { profile_id: pid } }); } catch (e) { window.alert(t('notifMax')); return; }
    chanCache[pid] = undefined;
    try { window.open(r.deep_link, '_blank'); } catch (e) {}
    linkHintDialog(pid, r.deep_link);
  }
  function linkHintDialog(pid, deep) {
    removeDialogs();
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) removeDialogs(); } });
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, t('linkTelegram')),
      el('div', { class: 'dialog-body' }, el('p', {}, t('linkHint'))),
      el('div', { class: 'dialog-actions' },
        el('a', { class: 'btn btn-secondary', href: deep, target: '_blank' }, t('linkOpen')),
        el('button', { class: 'btn btn-primary', onclick: () => { removeDialogs(); render(); } }, t('refreshWord'))));
    bd.append(dc); document.body.append(bd);
  }
  function renderManageMembers(screen) {   // Family members sub-tab
    head(screen, t('mngKicker'), t('mngTitle'));
    screen.append(manageSubtabs());
    const c = el('div', { class: 'content' });
    c.append(familyMembersSection());
    screen.append(c);
  }
  function familyMembersSection() {
    const wrap = el('div', {});
    wrap.append(el('p', { class: 'muted', style: 'margin:2px 0 12px' }, t('familyNote')));
    state.profiles.forEach((pf, i) => wrap.append(el('div', { class: 'mrow' },
      el('span', { class: 'pavatar', style: 'background:' + tintFor(pf, i) }, (pf.name || '?').charAt(0).toUpperCase()),
      el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'font-weight:700' }, pf.name), el('div', { class: 'meta' }, pf.relation || '')),
      pf.role === 'owner' ? el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('shareTitle'), title: t('shareTitle'), onclick: () => openPerson(pf, true), html: M.icon('share', 18) }) : null,
      el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('editPerson'), onclick: () => openPerson(pf), html: M.icon('pencil', 18) }),
      (state.profiles.length > 1 && pf.role === 'owner') ? el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('removePhoto'), onclick: () => removePerson(pf), html: M.icon('trash', 18) }) : null)));
    wrap.append(el('button', { class: 'btn btn-secondary btn-block', style: 'margin-top:6px', onclick: () => openPerson(null), html: M.icon('plus', 18, 'currentColor', 2.6) + ' ' + esc(t('addMember')) }));
    return wrap;
  }
  const TZS = [['Europe/Bucharest', 'București'], ['Europe/Chisinau', 'Chișinău'], ['Europe/Madrid', 'Madrid'], ['Europe/London', 'London'], ['Europe/Paris', 'Paris'], ['Europe/Berlin', 'Berlin'], ['Europe/Rome', 'Roma'], ['Europe/Athens', 'Atena'], ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Los_Angeles', 'Los Angeles'], ['Asia/Jerusalem', 'Ierusalim']];
  function tzSelect(e) {
    const s = el('select', { class: 'input' }); const cur = e.timezone || 'Europe/Bucharest';
    const list = TZS.slice(); if (!list.some(x => x[0] === cur)) list.unshift([cur, cur]);
    list.forEach(([v, lab]) => s.append(el('option', { value: v, selected: v === cur ? 'selected' : null }, lab)));
    s.addEventListener('change', () => e.timezone = s.value);
    return s;
  }
  function openPerson(pf, focusShare) { state.personDlg = pf ? { id: pf.id, name: pf.name, relation: pf.relation, timezone: pf.timezone, role: pf.role, members: undefined, _focusShare: !!focusShare } : { isNew: true, name: '', relation: '', timezone: state.lang === 'ro' ? 'Europe/Bucharest' : 'Europe/Madrid' }; if (pf && pf.role === 'owner') loadMembers(pf.id); renderPerson(); }
  function closePerson() { state.personDlg = null; removeDialogs(); }
  async function loadMembers(pid) { try { const r = await api('/api/profiles.php?action=members&profile=' + pid); if (state.personDlg && state.personDlg.id === pid) { state.personDlg.members = r.members || []; renderPerson(); } } catch (e) { if (state.personDlg && state.personDlg.id === pid) { state.personDlg.members = []; renderPerson(); } } }
  async function shareAdd(email) { email = (email || '').trim().toLowerCase(); if (!email) return; try { await api('/api/profiles.php?action=share', { method: 'POST', body: { id: state.personDlg.id, email } }); toast(t('shareAdded')); await loadMembers(state.personDlg.id); } catch (e) { toast(t('shareNoUser')); } }
  async function shareRemove(email) { try { await api('/api/profiles.php?action=unshare', { method: 'POST', body: { id: state.personDlg.id, email } }); } catch (e) {} await loadMembers(state.personDlg.id); }
  function shareSection(e) {
    const wrap = el('div', { class: 'field share-sec', style: 'margin-top:4px' },
      el('label', { html: M.icon('share', 15) + ' ' + esc(t('shareTitle')) }),
      el('p', { class: 'muted', style: 'font-size:.82em;margin:2px 0 8px' }, t('shareNote')));
    if (e.members === undefined) { wrap.append(el('div', { class: 'sk', style: 'height:40px' })); return wrap; }
    e.members.forEach(m => wrap.append(el('div', { class: 'mrow', style: 'margin-bottom:6px' },
      el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'font-weight:700' }, m.name || m.email), el('div', { class: 'meta' }, (m.role === 'owner' ? t('ownerWord') : t('editorWord')) + (m.name ? ' · ' + m.email : ''))),
      m.role === 'owner' ? null : el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('unlinkWord'), onclick: () => shareRemove(m.email), html: M.icon('trash', 18) }))));
    const emailI = el('input', { class: 'input', type: 'email', placeholder: t('shareEmailPh'), style: 'flex:1', oninput: (ev) => { e._shareEmail = ev.target.value; }, value: e._shareEmail || '' });
    wrap.append(el('div', { style: 'display:flex;gap:8px;margin-top:4px' }, emailI,
      el('button', { class: 'btn btn-secondary', onclick: () => { const v = emailI.value; e._shareEmail = ''; shareAdd(v); } }, t('shareAdd'))));
    return wrap;
  }
  function renderPerson() {
    removeDialogs();
    const e = state.personDlg;
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) closePerson(); } });
    const nameI = el('input', { class: 'input', value: e.name || '', placeholder: t('phPersonName'), oninput: (ev) => { e.name = ev.target.value; } });
    const relI = el('input', { class: 'input', value: e.relation || '', placeholder: t('phRelationship'), oninput: (ev) => { e.relation = ev.target.value; } });
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, t(e.isNew ? 'personAddTitle' : 'personEditTitle')),
      e.isNew ? el('p', { class: 'muted', style: 'font-size:.85em;margin:-2px 0 10px' }, t('personAddSub')) : null,
      el('div', { class: 'dialog-body' },
        el('div', { class: 'field' }, el('label', {}, t('fName')), nameI),
        el('div', { class: 'field' }, el('label', {}, t('fRelationship')), relI),
        el('div', { class: 'field' }, el('label', {}, t('fTimezone')), tzSelect(e)),
        (!e.isNew && e.role === 'owner') ? shareSection(e) : null),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: closePerson }, t('cancel')),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          const name = nameI.value.trim(); if (!name) { nameI.focus(); return; }
          const relation = relI.value.trim();
          if (e.isNew) { const r = await api('/api/profiles.php?action=create', { method: 'POST', body: { name, relation, timezone: e.timezone } }); state.personDlg = null; removeDialogs(); await loadProfiles(); state.manageSel = r.id; state.sel = r.id; loadedFor = null; render(); }
          else { await api('/api/profiles.php?action=rename', { method: 'POST', body: { id: e.id, name, relation, timezone: e.timezone || 'Europe/Bucharest' } }); state.personDlg = null; removeDialogs(); await loadProfiles(); render(); }
        } }, t(e.isNew ? 'addPersonBtn' : 'savePersonBtn'))));
    bd.append(dc); document.body.append(bd);
    if (e._focusShare) { e._focusShare = false; const s = dc.querySelector('.share-sec'); if (s) setTimeout(() => s.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }
  }
  async function removePerson(pf) {
    if (!window.confirm(t('removePhoto') + ' ' + pf.name + '?')) return;
    await api('/api/profiles.php?action=delete', { method: 'POST', body: { id: pf.id } });
    await loadProfiles();
    if (state.manageSel === pf.id) state.manageSel = state.profiles[0] ? state.profiles[0].id : null;
    if (state.sel === pf.id) state.sel = state.profiles[0] ? state.profiles[0].id : null;
    loadedFor = null; render();
  }
  function recurText(it) {
    const parts = []; const f = it.freq || 'daily';
    if (f === 'weekly') { const names = (it.days || []).slice().sort((a, b) => a - b).map(d => M.wdShort(d, state.lang)).join(', '); parts.push(t('repWeekly') + (names ? ' · ' + names : '')); }
    else if (f === 'monthly') parts.push(t('repMonthly') + ' · ' + fmt('domLabel', { n: it.dom || 1 }));
    else if (f === 'daily' && (it.everyDays || 1) > 1) parts.push(fmt('everyDays', { n: it.everyDays }));
    if (it.endMode === 'date' && it.endDate) parts.push(fmt('until', { date: M.shortDate(it.endDate, state.lang) }));
    if (it.endMode === 'count' && it.endCount) parts.push(fmt('untilCount', { n: it.endCount }));
    return parts.join(' · ');
  }
  function openAbout() {
    removeDialogs();
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) removeDialogs(); } });
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, t('aboutTitle')),
      el('div', { class: 'dialog-body' }, el('p', { style: 'line-height:1.55' }, t('aboutBody'))),
      el('div', { class: 'dialog-actions' }, el('button', { class: 'btn btn-primary', onclick: () => removeDialogs() }, t('close'))));
    bd.append(dc); document.body.append(bd);
  }
  function confirmDialog(title, body, confirmLabel, onConfirm) {
    removeDialogs();
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) removeDialogs(); } });
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, title),
      el('div', { class: 'dialog-body' }, el('p', {}, body)),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: () => removeDialogs() }, t('keepWord')),
        el('button', { class: 'btn btn-danger', onclick: () => { removeDialogs(); onConfirm(); } }, confirmLabel)));
    bd.append(dc); document.body.append(bd);
  }
  function removeItem(it) {
    confirmDialog(t('confirmDelTitle'), fmt('confirmDelItem', { name: it.name }), t('deleteWord'), async () => {
      await api('/api/items.php?action=delete', { method: 'POST', body: { id: it.id } }); await loadDay(state.manageSel); render();
    });
  }
  async function notifyNow(it) {
    try {
      const r = await api('/api/notify.php', { method: 'POST', body: { profile_id: state.manageSel, item_id: it.id } });
      if (r.no_channel) toast(t('notifyNoChannel')); else toast(fmt('notifySent', { n: r.sent }));
    } catch (e) { toast(t('notifyNoChannel')); }
  }
  function photoSrc(it) { return (it && it.photo && it.id) ? ('/media.php?item=' + it.id + '&v=' + encodeURIComponent(String(it.photo).slice(-14))) : null; }
  function itemAvatar(it, cls, isAct, size) {
    const src = photoSrc(it);
    const span = el('span', { class: cls + ' ' + (isAct ? 'act' : 'pill'), html: src ? '' : M.icon(isAct ? 'activity' : 'pill', size, isAct ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)') });
    if (src) {
      span.style.backgroundImage = 'url(' + src + ')'; span.style.backgroundSize = 'cover'; span.style.backgroundPosition = 'center';
      // thin type-colored border so pill vs activity stays readable once a photo hides the icon
      span.style.border = '2.5px solid ' + (isAct ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)');
      span.style.cursor = 'zoom-in'; span.setAttribute('role', 'button'); span.onclick = () => openPhoto(it);
    }
    return span;
  }
  function openPhoto(it) {
    const src = photoSrc(it); if (!src) return;
    removeDialogs();
    const bd = el('div', { class: 'dialog-backdrop lightbox', onclick: () => removeDialogs() });
    const spin = el('div', { class: 'lb-spin' });
    const img = el('img', { alt: it.name || '' });
    img.onload = () => { spin.remove(); img.classList.add('show'); };
    img.onerror = () => { spin.remove(); };
    img.onclick = (ev) => { ev.stopPropagation(); img.classList.toggle('zoom'); };
    const close = el('button', { class: 'lb-close', 'aria-label': t('close'), html: '✕', onclick: (ev) => { ev.stopPropagation(); removeDialogs(); } });
    bd.append(spin, img, close); document.body.append(bd);
    img.src = src;
  }
  async function uploadPhoto(file, pid) {
    const fd = new FormData(); fd.append('profile_id', pid); fd.append('file', file);
    const r = await fetch('/media.php?action=upload', { method: 'POST', credentials: 'include', headers: { 'X-CSRF': state.csrf }, body: fd });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error((j && j.error) || r.status), { data: j });
    return j;   // { photo_url }
  }
  function photoControl(e, pid) {
    const wrap = el('div', { class: 'photo-pick' });
    const fileI = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    const cur = e.photoPreview || photoSrc(e);
    const tcol = e.type === 'activity' ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)';   // match Today's image border
    const prev = el('div', { class: 'photo-prev' + (cur ? '' : ' empty') });
    if (cur) { prev.style.backgroundImage = 'url(' + cur + ')'; prev.style.border = '2.5px solid ' + tcol; }
    else { prev.style.border = '2px dashed ' + tcol; prev.innerHTML = M.icon('image', 30, tcol, 2); }
    prev.onclick = () => fileI.click();
    fileI.addEventListener('change', async () => {
      const f = fileI.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { e.photoPreview = rd.result; renderEditor(); }; rd.readAsDataURL(f);
      try { const r = await uploadPhoto(f, pid); e.photo = r.photo_url; } catch (err) { e.photoPreview = null; toast(t('photoError')); renderEditor(); }
    });
    const btns = el('div', { class: 'photo-btns' },
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => fileI.click() }, t(cur ? 'changePhoto' : 'addPhoto')),
      cur ? el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { e.photo = null; e.photoPreview = null; renderEditor(); } }, t('removePhoto')) : null);
    wrap.append(prev, fileI, btns);
    return wrap;
  }
  let toastT = null;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(n => n.remove());
    const n = el('div', { class: 'toast' }, msg); document.body.append(n);
    requestAnimationFrame(() => n.classList.add('show'));
    clearTimeout(toastT); toastT = setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2400);
  }

  /* ---------------- Item editor dialog ---------------- */
  function openEditor(it) {
    state.editItem = it ? Object.assign({}, it) : { isNew: true, type: 'pill', name: '', count: 1, group: 'morning', time: 8 * 60, freq: 'daily', days: [], dom: 1, endMode: 'never', purpose: '', note: '' };
    renderEditor();
  }
  function renderEditor() {
    removeDialogs();
    const e = state.editItem; const pid = state.manageSel;
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) closeDialog(); } });
    const field = (labelKey, ctrl) => el('div', { class: 'field' }, el('label', {}, t(labelKey)), ctrl);
    const input = (val, ph) => el('input', { class: 'input', value: val ?? '', placeholder: ph ? t(ph) : null });
    const nameI = input(e.name, 'phName');
    const typeS = sel(['pill', 'activity'], [t('typeMedicine'), t('typeActivity')], e.type, v => { e.type = v; });
    const countI = el('input', { class: 'input', inputmode: 'text', value: qtyToStr(e.count), placeholder: '1' });
    const timeS = el('select', { class: 'input' }); for (let m = 0; m < 1440; m += 30) timeS.append(el('option', { value: m, selected: Math.abs(e.time - m) < 15 ? 'selected' : null }, fmtMin(m)));
    const repeatS = sel(['daily', 'weekly', 'monthly'], [t('repDaily'), t('repWeekly'), t('repMonthly')], e.freq, v => { e.freq = v; renderEditor(); });
    const purposeI = input(e.purpose, 'phFor'); const noteI = input(e.note, 'phNote');
    // keep edits in state so a re-render (repeat change, photo pick) never drops them
    nameI.addEventListener('input', () => e.name = nameI.value);
    countI.addEventListener('input', () => e.count = parseQty(countI.value));
    purposeI.addEventListener('input', () => e.purpose = purposeI.value);
    noteI.addEventListener('input', () => e.note = noteI.value);
    timeS.addEventListener('change', () => e.time = parseInt(timeS.value, 10));
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, t(e.isNew ? 'editAdd' : 'editEdit')),
      el('div', { class: 'dialog-body' },
        field('fName', nameI),
        field('fPhoto', photoControl(e, pid)),
        el('div', { class: 'grid2' }, field('fType', typeS), el('div', { class: 'field' }, el('label', {}, t('fHowMany')), countI, el('div', { class: 'field-hint muted' }, t('qtyHint')))),
        field('fTime', timeS),
        field('fRepeat', repeatS),
        e.freq === 'daily' ? field('fEvery', everyDaysControl(e)) : null,
        e.freq === 'weekly' ? field('fDays', dayToggles(e)) : null,
        e.freq === 'monthly' ? field('fDom', domSelect(e)) : null,
        field('fEnd', endControls(e)),
        field('fFor', purposeI),
        field('fNote', noteI),
      ),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: closeDialog }, t('cancel')),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          e.name = nameI.value.trim(); if (!e.name) { nameI.focus(); return; }
          e.count = parseQty(countI.value); e.time = parseInt(timeS.value, 10);
          const body = { profile_id: pid, type: e.type, name: e.name, count: e.count, grp: M.groupForMin(e.time), time_min: e.time,
            purpose: purposeI.value.trim(), note: noteI.value.trim(), freq: e.freq, days: e.days, dom: e.dom,
            end_mode: e.endMode, end_date: e.endDate, end_count: e.endCount, every_days: e.freq === 'daily' ? (e.everyDays || 1) : 1, photo_url: e.photo };
          if (e.isNew) await api('/api/items.php?action=create', { method: 'POST', body });
          else await api('/api/items.php?action=update', { method: 'POST', body: Object.assign({ id: e.id }, body) });
          state.editItem = null; removeDialogs(); await loadDay(pid); render();
        } }, t('save'))));
    bd.append(dc); document.body.append(bd);
  }
  function sel(vals, labels, cur, on) { const s = el('select', { class: 'input' }); vals.forEach((v, i) => s.append(el('option', { value: v, selected: v === cur ? 'selected' : null }, labels[i]))); s.addEventListener('change', () => on(s.value)); return s; }
  function everyDaysControl(e) {
    const inp = el('input', { class: 'input', type: 'number', min: 1, value: e.everyDays || 1, style: 'max-width:90px', onchange: (ev) => e.everyDays = Math.max(1, parseInt(ev.target.value, 10) || 1) });
    return el('div', { style: 'display:flex;align-items:center;gap:8px' }, inp, el('span', {}, t('daysWord')));
  }
  function dayToggles(e) { const row = el('div', { class: 'daytoggles' }); for (let d = 0; d < 7; d++) { const on = (e.days || []).includes(d); row.append(el('button', { class: 'btn ' + (on ? 'btn-primary' : 'btn-secondary') + ' small', onclick: () => { e.days = on ? e.days.filter(x => x !== d) : [...(e.days || []), d]; renderEditor(); } }, M.wdChip(d, state.lang))); } return row; }
  function domSelect(e) { const s = el('select', { class: 'input' }); for (let d = 1; d <= 31; d++) s.append(el('option', { value: d, selected: (e.dom || 1) === d ? 'selected' : null }, d)); s.addEventListener('change', () => e.dom = parseInt(s.value, 10)); return s; }
  function endControls(e) {
    const wrap = el('div', {});
    const seg = el('div', { class: 'daytoggles' });
    [['never', 'endNever'], ['date', 'endOnDate'], ['count', 'endAfter']].forEach(([m, k]) => seg.append(el('button', { class: 'btn ' + (e.endMode === m ? 'btn-primary' : 'btn-secondary') + ' small', onclick: () => { e.endMode = m; renderEditor(); } }, t(k))));
    wrap.append(seg);
    if (e.endMode === 'date') { const di = el('input', { class: 'input', type: 'date', style: 'margin-top:8px;max-width:200px;text-align:left', value: e.endDate || '', min: todayISO() }); di.addEventListener('change', () => { e.endDate = di.value || null; }); wrap.append(di); }
    if (e.endMode === 'count') wrap.append(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:8px' }, el('input', { class: 'input', type: 'number', min: 1, value: e.endCount || 1, style: 'max-width:120px', onchange: (ev) => e.endCount = parseInt(ev.target.value, 10) }), t('endTimes')));
    return wrap;
  }
  function closeDialog() { state.editItem = null; removeDialogs(); }

  /* ---------------- Settings ---------------- */
  function renderSettings(screen) {
    head(screen, t('setKicker'), t('setTitle'));
    const c = el('div', { class: 'content stack' });
    const seg = (labelHtml, opts, cur, on) => { const box = el('div', { class: 'card', style: 'padding:14px' }, el('div', { class: 'set-label', html: labelHtml }), el('div', { class: 'segrow' }, ...opts.map(([v, lab]) => el('button', { class: 'btn ' + (cur === v ? 'btn-primary' : 'btn-secondary'), onclick: () => on(v) }, lab)))); return box; };
    c.append(
      seg(M.icon('globe', 18) + ' ' + t('setLanguage'), [['ro', 'Română'], ['en', 'English']], state.lang, v => { state.lang = v; localStorage.setItem('med_lang', v); render(); }),
      seg(t('setTextSize'), [['Standard', t('tsStandard')], ['Large', t('tsLarge')], ['Extra large', t('tsXL')]], state.textSize, v => { state.textSize = v; localStorage.setItem('med_text', v); render(); }),
      seg(t('setPhotos'), [[true, t('onWord')], [false, t('offWord')]], state.showPhotos, v => { state.showPhotos = v; localStorage.setItem('med_photos', v ? '1' : '0'); render(); }),
      seg(M.icon('image', 18) + ' ' + t('setTheme'), [['organic', t('themeOrganic')], ['ocean', t('themeOcean')], ['lavender', t('themeLavender')]], state.theme, v => { state.theme = v; localStorage.setItem('med_theme', v); render(); }),
      seg(t('setMode'), [['light', t('modeLight')], ['dark', t('modeDark')], ['device', t('modeDevice')]], state.mode, v => { state.mode = v; localStorage.setItem('med_mode', v); render(); }),
    );
    if (state.sel) {
      if (!state.exportSel || !state.profiles.some(p => p.id === state.exportSel)) state.exportSel = state.sel;
      const chips = el('div', { class: 'pswitch' });
      state.profiles.forEach((p, i) => chips.append(el('button', { class: 'pchip' + (state.exportSel === p.id ? ' on' : ''), onclick: () => { state.exportSel = p.id; render(); } },
        el('span', { class: 'pchip-av', style: 'background:' + tintFor(p, i) }, (p.name || '?').charAt(0).toUpperCase()), p.name)));
      const ex = state.exportSel;
      c.append(el('div', { class: 'card', style: 'padding:14px' },
        el('div', { class: 'set-label', html: M.icon('download', 18) + ' ' + esc(t('exportTitle')) }),
        el('p', { class: 'muted', style: 'font-size:.82em;margin:2px 0 8px' }, t('exportForWhom')),
        chips,
        el('div', { class: 'segrow', style: 'margin-top:10px' },
          el('a', { class: 'btn btn-secondary', href: '/api/export.php?profile=' + ex + '&days=30' }, t('export30')),
          el('a', { class: 'btn btn-secondary', href: '/api/export.php?profile=' + ex + '&days=90' }, t('export90')),
          el('a', { class: 'btn btn-secondary', href: '/api/export.php?profile=' + ex + '&days=365' }, t('exportAll')))));
    }
    if (state.user.admin) c.append(el('a', { class: 'btn btn-secondary btn-block', href: '/admin/' }, t('admin')));
    c.append(el('button', { class: 'btn btn-ghost btn-block', onclick: async () => { await api('/auth/logout.php', { method: 'POST' }); location.reload(); } }, t('signOut')));
    c.append(el('p', { class: 'center muted', style: 'font-size:.8em' }, state.user.email));
    screen.append(c);
  }

  /* ---------------- History ---------------- */
  const histCache = {};   // pid -> { items, logs:{"iso|itemId":{status,taken_min,note}}, from }
  let histLoadedKey = null;
  function addDaysISO(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return M.isoOf(d); }
  function weekStartISO(offset) { const d = new Date(); d.setDate(d.getDate() + offset * 7); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return M.isoOf(d); } // Monday
  function weekDatesISO(offset) { const s = weekStartISO(offset); return Array.from({ length: 7 }, (_, i) => addDaysISO(s, i)); }
  const minISO = (a, b) => (a < b ? a : b);
  const hlog = (pid, iso, id) => (histCache[pid] && histCache[pid].logs[iso + '|' + id]) || null;

  async function ensureItems(pid) {
    if (dataCache[pid]) return dataCache[pid].items;
    const it = await api('/api/items.php?action=list&profile=' + pid);
    return (it.items || []).map(normItem);
  }
  async function loadHist(pid, from) {
    const items = await ensureItems(pid);
    const to = todayISO();
    const r = await api('/api/logs.php?action=range&profile=' + pid + '&from=' + from + '&to=' + to);
    histCache[pid] = { items, logs: r.logs || {}, from };
  }
  function histRoute(screen) {
    const pid = state.sel; const key = pid + '|' + state.weekOffset;
    const neededFrom = minISO(weekStartISO(state.weekOffset), addDaysISO(todayISO(), -29));
    const c = histCache[pid];
    if (c && c.from <= neededFrom && histLoadedKey === key) { renderHistory(screen); return; }
    if (c && c.from <= neededFrom) { histLoadedKey = key; renderHistory(screen); return; }
    histLoadedKey = key;
    head(screen, t('histKicker'), fmt('weekTitle', { name: pGen(personName(cur())) }));
    screen.append(switcher('sel'));
    const sk = el('div', { class: 'content' }); sk.append(el('div', { class: 'sk', style: 'height:70px' }), el('div', { class: 'sk', style: 'height:230px' })); screen.append(sk);
    loadHist(pid, neededFrom).then(() => { if (histLoadedKey === key) render(); });
  }
  function scheduledInWeek(items, dates) { return items.filter(it => dates.some(iso => M.isScheduledOn(it, new Date(iso + 'T00:00:00')))); }
  function renderHistory(screen) {
    const pid = state.sel; const items = (histCache[pid] && histCache[pid].items) || [];
    const dates = weekDatesISO(state.weekOffset); const today = todayISO();
    head(screen, t('histKicker'), fmt('weekTitle', { name: pGen(personName(cur())) }));
    screen.append(switcher('sel'));
    const c = el('div', { class: 'content' });
    // stats over the week (days up to today)
    let sched = 0, taken = 0;
    scheduledInWeek(items, dates).forEach(it => dates.forEach(iso => {
      if (iso > today) return; if (!M.isScheduledOn(it, new Date(iso + 'T00:00:00'))) return;
      sched++; const l = hlog(pid, iso, it.id); if (l && l.status === 'taken') taken++;
    }));
    const pct = sched ? Math.round(taken / sched * 100) : 0;
    c.append(el('div', { class: 'hist-stats' },
      el('div', { class: 'card stat' }, el('div', { class: 'stat-n sage' }, pct + '%'), el('div', { class: 'stat-l muted' }, t('takenThisWeek'))),
      el('div', { class: 'card stat' }, el('div', { class: 'stat-n' }, String(taken)), el('div', { class: 'stat-l muted' }, fmt('weekTaken', { n: sched })))));
    // week nav
    const capTxt = state.weekOffset === 0 ? t('weekThis') : state.weekOffset === -1 ? t('weekLast') : (M.shortDate(dates[0], state.lang) + ' – ' + M.shortDate(dates[6], state.lang));
    c.append(el('div', { class: 'weeknav' },
      el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('prevWeek'), onclick: () => { state.weekOffset--; render(); }, html: M.icon('chevronLeft', 18) }),
      el('div', { class: 'weekcap' }, capTxt),
      el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('nextWeek'), disabled: state.weekOffset >= 0 ? 'disabled' : null, onclick: () => { if (state.weekOffset < 0) { state.weekOffset++; render(); } }, html: M.icon('chevronRight', 18) })));
    // grid
    const rows = scheduledInWeek(items, dates);
    const grid = el('div', { class: 'histgrid-wrap card' });
    const g = el('div', { class: 'histgrid', style: 'grid-template-columns:116px repeat(7,minmax(42px,1fr))' });
    g.append(el('div', { class: 'hg-corner' }, ''));
    dates.forEach(iso => { const d = new Date(iso + 'T00:00:00'); g.append(el('div', { class: 'hg-dh' + (iso === today ? ' today' : '') }, el('div', { class: 'hg-wd' }, M.wdChip(d.getDay(), state.lang)), el('div', { class: 'hg-dn' }, String(d.getDate())))); });
    if (!rows.length) g.append(el('div', { class: 'hg-empty', style: 'grid-column:1/-1' }, t('noRecordsWeek')));
    rows.forEach(it => {
      g.append(el('div', { class: 'hg-name' }, it.name));
      dates.forEach(iso => {
        const future = iso > today; const sch = M.isScheduledOn(it, new Date(iso + 'T00:00:00'));
        if (future) { g.append(el('div', { class: 'hg-cell blank' }, '')); return; }
        if (!sch) { g.append(el('div', { class: 'hg-cell na' }, 'N/A')); return; }
        const l = hlog(pid, iso, it.id); const st = l ? l.status : null;
        const sym = st === 'taken' ? '✓' : st === 'skipped' ? '✕' : '–';
        const cls = st === 'taken' ? 'c-taken' : st === 'skipped' ? 'c-skip' : 'c-none';
        g.append(el('button', { class: 'hg-cell ' + cls, onclick: () => setHistCell(pid, iso, it.id) }, sym));
      });
    });
    grid.append(g); c.append(grid);
    // legend
    c.append(el('div', { class: 'legend' },
      ['legendTaken c-taken ✓', 'legendNot c-skip ✕', 'legendNo c-none –', 'legendNA na N/A'].map(s => { const [k, cl, sym] = s.split(' '); return el('span', { class: 'leg' }, el('span', { class: 'leg-c ' + cl }, sym), t(k)); })));
    // dirty bar / hint
    if (state.histDirty) c.append(el('div', { class: 'dirtybar' },
      el('button', { class: 'btn btn-secondary', onclick: histCancel, html: M.icon('rotate', 16) + ' ' + esc(t('cancelChanges')) }),
      el('button', { class: 'btn btn-primary', onclick: histSave, html: M.icon('check', 16) + ' ' + esc(t('saveChanges')) })));
    else c.append(el('p', { class: 'muted', style: 'font-size:.82em;margin:8px 2px' }, t('tapCorrect')));
    // view all
    c.append(el('button', { class: 'btn btn-ghost btn-block', onclick: () => fullHistoryDialog(pid) }, t('viewAll')));
    // worth a look
    const wl = worthList(pid, items);
    if (wl.length) {
      c.append(el('h2', { class: 'display', style: 'font-size:1.1em;margin:18px 0 6px' }, t('worthLook')));
      wl.forEach(w => c.append(el('div', { class: 'mrow' },
        el('span', { class: 'wl-c ' + (w.kind === 'skip' ? 'c-skip' : 'c-none') }, w.kind === 'skip' ? '✕' : '–'),
        el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'font-weight:700' }, w.name), el('div', { class: 'meta' }, M.wdShort(new Date(w.iso + 'T00:00:00').getDay(), state.lang) + ' ' + t('group' + cap(w.group)).toLowerCase() + ' · ' + t(w.kind === 'skip' ? 'missNot' : 'missNo'))))));
    }
    screen.append(c);
  }
  function setHistCell(pid, iso, id) {
    const key = iso + '|' + id; const cur = hlog(pid, iso, id); const curSt = cur ? cur.status : null;
    const next = curSt === null ? 'taken' : curSt === 'taken' ? 'skipped' : null;
    if (!state.histSnap) state.histSnap = {};
    if (!(key in state.histSnap)) state.histSnap[key] = cur ? Object.assign({}, cur) : null;
    applyHist(pid, iso, id, next);
    state.histDirty = true; render();
    api('/api/logs.php?action=set', { method: 'POST', body: { profile_id: pid, item_id: id, date: iso, status: next, taken_min: null } }).catch(() => {});
  }
  function applyHist(pid, iso, id, status) {
    const key = iso + '|' + id; const logs = histCache[pid].logs;
    if (status == null) delete logs[key]; else logs[key] = { status, taken_min: (logs[key] && logs[key].taken_min) ?? null, note: (logs[key] && logs[key].note) || null };
    if (iso === todayISO() && dataCache[pid]) { if (status == null) delete dataCache[pid].logs[id]; else dataCache[pid].logs[id] = logs[key]; }
  }
  function histSave() { state.histSnap = null; state.histDirty = false; render(); }
  function histCancel() {
    const pid = state.sel; const snap = state.histSnap || {};
    Object.keys(snap).forEach(key => { const [iso, id] = key.split('|'); const orig = snap[key]; applyHist(pid, iso, +id, orig ? orig.status : null); api('/api/logs.php?action=set', { method: 'POST', body: { profile_id: pid, item_id: +id, date: iso, status: orig ? orig.status : null, taken_min: orig ? orig.taken_min : null } }).catch(() => {}); });
    state.histSnap = null; state.histDirty = false; render();
  }
  function worthList(pid, items) {
    const out = []; const today = todayISO();
    for (let i = 1; i <= 6 && out.length < 5; i++) {
      const iso = addDaysISO(today, -i); const d = new Date(iso + 'T00:00:00');
      items.forEach(it => { if (out.length >= 5) return; if (!M.isScheduledOn(it, d)) return; const l = hlog(pid, iso, it.id); if (l && l.status === 'taken') return; out.push({ name: it.name, iso, group: M.groupForMin(it.time), kind: l && l.status === 'skipped' ? 'skip' : 'none' }); });
    }
    return out.slice(0, 5);
  }
  function fullHistoryDialog(pid) {
    removeDialogs();
    const items = (histCache[pid] && histCache[pid].items) || []; const today = todayISO();
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) removeDialogs(); } });
    const body = el('div', { class: 'dialog-body', style: 'max-height:64vh;overflow-y:auto' });
    let any = false;
    for (let i = 0; i < 30; i++) {
      const iso = addDaysISO(today, -i); const d = new Date(iso + 'T00:00:00');
      const dayItems = items.filter(it => M.isScheduledOn(it, d)).sort((a, b) => a.time - b.time);
      if (!dayItems.length) continue; any = true;
      body.append(el('div', { class: 'fh-day' }, M.wdShort(d.getDay(), state.lang) + ' ' + M.shortDate(iso, state.lang) + (iso === today ? ' · ' + t('weekThis') : '')));
      dayItems.forEach(it => {
        const l = hlog(pid, iso, it.id); const st = l ? l.status : null;
        const sym = st === 'taken' ? '✓' : st === 'skipped' ? '✕' : '–'; const cl = st === 'taken' ? 'c-taken' : st === 'skipped' ? 'c-skip' : 'c-none';
        const lab = st === 'taken' ? (l.taken_min != null ? fmt(it.type === 'activity' ? 'doneAt' : 'takenAt', { time: fmtMin(l.taken_min) }) : t(it.type === 'activity' ? 'doneWord' : 'takenWord')) : st === 'skipped' ? t(it.type === 'activity' ? 'markedNotAct' : 'markedNot') : t('legendNo');
        body.append(el('div', { class: 'fh-row' }, el('span', { class: 'wl-c ' + cl }, sym), el('span', { style: 'flex:1;min-width:0' }, it.name), el('span', { class: 'meta' }, lab)));
      });
    }
    if (!any) body.append(el('p', { class: 'muted' }, t('noRecordsWeek')));
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, t('allHistTitle')),
      el('p', { class: 'muted', style: 'margin:-2px 0 8px' }, personName(cur()) + ' · ' + t('last30')),
      body,
      el('div', { class: 'dialog-actions' }, el('button', { class: 'btn btn-secondary', onclick: removeDialogs }, t('close'))));
    bd.append(dc); document.body.append(bd);
  }

  /* ---------------- Login ---------------- */
  function renderLogin(errKey) {
    const frame = $('#frame'); frame.innerHTML = '';
    const wrap = el('div', { class: 'login-wrap content' });
    wrap.append(el('div', { class: 'blob', style: 'width:300px;height:300px;background:var(--color-accent-2-200);top:-120px;right:-90px' }), el('div', { class: 'blob', style: 'width:150px;height:150px;background:var(--color-accent-200);bottom:-40px;left:-50px' }));
    const emailIn = el('input', { class: 'input', type: 'email', autocomplete: 'username', placeholder: t('email') });
    const passIn = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: t('password') });
    const errBox = el('div', { class: 'error', style: 'display:' + (errKey ? 'block' : 'none') }, errKey ? t('bad_credentials') || 'Wrong email or password.' : '');
    const doLogin = async () => { errBox.style.display = 'none'; try { await api('/auth/login.php', { method: 'POST', body: { email: emailIn.value.trim(), password: passIn.value } }); await boot(); } catch (e) { errBox.textContent = state.lang === 'ro' ? 'E-mail sau parolă greșite.' : 'Wrong email or password.'; errBox.style.display = 'block'; } };
    passIn.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    const gG = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.2C12.3 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.6 37.9 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.4 28.5c-.5-1.5-.8-3.1-.8-4.5s.3-3 .8-4.5l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.7-3.7-13.6-9l-7.9 6.2C6.4 42.6 14.6 48 24 48z"/></svg>';
    wrap.append(
      el('div', { class: 'brand-row' }, el('div', { class: 'brand-mark', html: M.icon('pill', 30, '#fff') }),
        el('div', {}, el('div', { class: 'brand-name-row' }, el('span', { class: 'brand-name display' }, t('brand')),
          el('button', { class: 'info-btn', 'aria-label': t('aboutAria'), title: t('aboutAria'), onclick: openAbout, html: M.icon('info', 20, 'currentColor', 2.2) })),
          el('div', { class: 'brand-tag' }, t('tagline')))),
      el('h1', { class: 'login-h display' }, t('welcome')), el('p', { class: 'login-sub' }, t('signInSub')), errBox,
      el('div', { class: 'field' }, el('label', {}, t('email')), emailIn),
      el('div', { class: 'field' }, el('label', {}, t('password')), passIn),
      el('button', { class: 'btn btn-primary btn-block', style: 'min-height:58px', onclick: doLogin }, t('signIn')),
      el('div', { class: 'divider-or' }, t('orDivider')),
      el('a', { class: 'btn btn-secondary btn-block gbtn', href: '/auth/login.php?provider=google' }, el('span', { html: gG }), t('googleBtn')),
      el('p', { class: 'center muted', style: 'margin-top:16px;font-size:.85em' }, t('help')),
      el('p', { class: 'center', style: 'margin-top:4px' }, el('a', { href: '#', class: 'muted', style: 'font-size:.8em', onclick: (ev) => { ev.preventDefault(); state.lang = state.lang === 'ro' ? 'en' : 'ro'; localStorage.setItem('med_lang', state.lang); renderLogin(); } }, state.lang === 'ro' ? 'English' : 'Română')));
    frame.append(wrap); applyPrefs();
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    applyPrefs();
    let me; try { me = await api('/auth/me.php'); } catch (e) { me = { user: null }; }
    if (!me.user) return renderLogin();
    state.user = me.user; state.csrf = me.csrf || '';
    await loadProfiles();
    loadedFor = null; render();
  }
  boot();
  // live-ish cross-account sync: quietly re-fetch today's logs; re-render only on change
  async function pollTick() {
    if (!state.user || document.hidden) return;
    if (document.querySelector('.dialog-backdrop')) return;                 // don't disrupt a dialog
    const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; // or typing
    if (state.tab !== 'today' || !state.sel) return;
    try {
      const dy = await api('/api/logs.php?action=day&profile=' + state.sel + '&date=' + todayISO());
      const logs = dy.logs || {}, dn = dy.day_note || '';
      if (JSON.stringify(logs) !== JSON.stringify(state.logs) || dn !== (state.dayNote || '')) {
        state.logs = logs; state.dayNote = dn;
        if (dataCache[state.sel]) { dataCache[state.sel].logs = logs; dataCache[state.sel].dayNote = dn; }
        render();
      }
    } catch (e) {}
  }
  setInterval(pollTick, 30000);
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.mode === 'device') applyPrefs(); }); } catch (e) {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
