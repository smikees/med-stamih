/* app.js — Alongside client (Phase 2 core: Today + Manage + person switcher +
   item editor + Settings, on real APIs). History/export/images/notes-UI/polling
   land next. Reuses window.STR (i18n.js) and window.MED (logic.js). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, a = {}, ...k) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (v == null) continue; if (x === 'class') n.className = v; else if (x === 'html') n.innerHTML = v; else if (x.startsWith('on')) n.addEventListener(x.slice(2), v); else n.setAttribute(x, v); } for (const c of k.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const M = window.MED;
  const TINTS = ['var(--color-accent-500)', 'var(--color-accent-2-500)', 'var(--color-accent-600)', 'var(--color-accent-2-600)', 'var(--color-accent-400)'];

  const state = {
    user: null, csrf: '',
    lang: localStorage.getItem('med_lang') || 'ro',
    textSize: localStorage.getItem('med_text') || 'Large',
    showPhotos: localStorage.getItem('med_photos') !== '0',
    tab: 'today',
    profiles: [], sel: null, manageSel: null,
    items: [], logs: {},           // for the currently-loaded profile+today
    editItem: null,                // item-editor dialog state
  };
  const SIZES = { Standard: 17, Large: 19, 'Extra large': 22 };
  const t = (k) => (window.STR[state.lang] && window.STR[state.lang][k]) ?? (window.STR.en[k] ?? k);
  const fmt = (k, v) => { let s = t(k); if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
  const todayISO = () => M.isoOf(new Date());
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmtMin = (m) => M.fmtMin(m, state.lang);
  function applyPrefs() { document.documentElement.style.fontSize = (SIZES[state.textSize] || 19) + 'px'; document.documentElement.lang = state.lang; }
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
      endMode: r.end_mode, endDate: r.end_date, endCount: r.end_count, startDate: r.start_date };
  }

  /* ---------------- data ---------------- */
  async function loadProfiles() { state.profiles = (await api('/api/profiles.php?action=list')).profiles || []; if (!state.sel && state.profiles[0]) state.sel = state.profiles[0].id; if (!state.manageSel && state.profiles[0]) state.manageSel = state.profiles[0].id; }
  async function loadDay(pid) {
    if (!pid) { state.items = []; state.logs = {}; return; }
    const [it, dy] = await Promise.all([api('/api/items.php?action=list&profile=' + pid), api('/api/logs.php?action=day&profile=' + pid + '&date=' + todayISO())]);
    state.items = (it.items || []).map(normItem);
    state.logs = dy.logs || {};
  }
  async function setLog(itemId, status, takenMin, note) {
    const body = { profile_id: state.sel, item_id: itemId, date: todayISO(), status, taken_min: takenMin ?? null, note: note ?? null };
    if (status == null) delete state.logs[itemId]; else state.logs[itemId] = { status, taken_min: takenMin ?? null, note: note ?? null };
    render();
    try { await api('/api/logs.php?action=set', { method: 'POST', body }); } catch (e) { await loadDay(state.sel); render(); }
  }

  /* ---------------- shell ---------------- */
  function render() { applyPrefs(); if (!state.user) return renderLogin(); const f = $('#frame'); f.innerHTML = ''; const screen = el('div', { class: 'screen', id: 'screen' }); f.append(screen, tabbar()); routeTab(screen); }
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
    if (state.tab === 'history') { head(screen, t('histKicker'), fmt('weekTitle', { name: personName(cur()) })); screen.append(switcher('sel'), el('div', { class: 'content' }, el('p', { class: 'soon' }, t('comingSoon')))); return; }
    const pid = state.tab === 'manage' ? state.manageSel : state.sel;
    ensureLoaded(pid, screen);
  }
  function cur() { return state.profiles.find(p => p.id === state.sel); }
  function curManage() { return state.profiles.find(p => p.id === state.manageSel); }

  let loadedFor = null, loadedTab = null;
  async function ensureLoaded(pid, screen) {
    const key = state.tab + ':' + pid;
    if (loadedFor !== key) {
      screen.append(el('div', { class: 'content muted', style: 'padding-top:30vh;text-align:center' }, '…'));
      loadedFor = key; await loadDay(pid); render(); return;
    }
    if (state.tab === 'today') renderToday(screen); else renderManage(screen);
  }
  // when switching profile/tab, invalidate
  function invalidate() { loadedFor = null; }
  ['sel', 'manageSel'].forEach(() => {});

  /* ---------------- Today ---------------- */
  function scheduledToday(items) { const d = new Date(); return items.filter(it => M.isScheduledOn(it, d)); }
  function renderToday(screen) {
    const p = cur();
    head(screen, greeting() + ' · ' + new Date().toLocaleDateString(state.lang === 'ro' ? 'ro-RO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), fmt('daysTitle', { name: personName(p) }));
    const c = el('div', { class: 'content' });
    screen.append(switcher('sel'));
    const all = scheduledToday(state.items);
    if (!state.items.length) {
      c.append(el('div', { class: 'empty' }, el('p', {}, fmt('noList', { name: personName(p) })),
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
      const its = pills.filter(x => x.group === g.key).sort((a, b) => a.time - b.time);
      if (!its.length) return;
      c.append(sectionHeader(g, its));
      its.forEach(it => c.append(itemCard(it)));
    });
    // activities
    const acts = all.filter(x => x.type === 'activity').sort((a, b) => a.time - b.time);
    if (acts.length) { c.append(el('div', { class: 'sec-head' }, el('span', { class: 'sec-ico', html: M.icon('activity', 20, 'var(--color-accent-2-700)') }), el('span', { class: 'sec-title display' }, t('secActivities')))); acts.forEach(it => c.append(itemCard(it))); }
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
    const secState = (g) => { const its = pills.filter(x => x.group === g.key); if (!its.length) return null; const pend = its.filter(x => !state.logs[x.id]).length; return { g, pend, tone: pend === 0 ? 'done' : (nm >= g.start && nm < g.end) ? 'due' : (nm >= g.end ? 'over' : 'soon'), firstTime: its.sort((a, b) => a.time - b.time)[0].time }; };
    const secs = M.GROUPS.map(secState).filter(Boolean);
    const over = secs.find(s => s.tone === 'over' && s.pend), due = secs.find(s => s.tone === 'due' && s.pend), next = secs.filter(s => s.pend && s.tone === 'soon').sort((a, b) => a.firstTime - b.firstTime)[0];
    if (over) { cls = 'rb-alert'; txt = fmt('remOverdue', { group: t('group' + cap(over.g.key)) }); }
    else if (due) { cls = 'rb-alert'; txt = fmt('remDue', { group: t('group' + cap(due.g.key)) }); }
    else if (next) { cls = 'rb-soon'; txt = fmt('remNext', { group: t('group' + cap(next.g.key)), time: fmtMin(next.firstTime) }); }
    else { cls = 'rb-done'; txt = t('remAllDone'); }
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
    const av = state.showPhotos ? el('span', { class: 'itc-av ' + (isAct ? 'act' : 'pill'), html: it.photo ? '' : M.icon(isAct ? 'activity' : 'pill', 26, isAct ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)') }) : null;
    if (av && it.photo) av.style.backgroundImage = 'url(' + it.photo + ')', av.style.backgroundSize = 'cover', av.innerHTML = '';
    const detail = isAct ? (it.purpose || '') : (fmt('take', { n: it.count }) + (it.purpose ? ' · ' + fmt('forPurpose', { purpose: (it.purpose || '').toLowerCase() }) : ''));
    const body = el('div', { style: 'flex:1;min-width:0' },
      el('div', { class: 'itc-top' }, el('span', { class: 'itc-name' }, it.name), el('span', { class: 'itc-time muted', html: M.icon('clock', 14, 'currentColor', 2.4) + ' ' + esc(fmtMin(it.time)) })),
      detail ? el('div', { class: 'itc-detail muted' }, detail) : null,
      it.note ? el('span', { class: 'itc-note' }, it.note) : null,
      actionZone(it, l, isAct));
    return el('div', { class: 'card itemcard elev-sm' }, av, body);
  }
  function actionZone(it, l, isAct) {
    if (!l) return el('div', { class: 'itc-actions' },
      el('button', { class: 'btn btn-primary', onclick: () => setLog(it.id, 'taken', nowMin()), html: M.icon('check', 18, 'currentColor', 2.6) + ' ' + esc(t(isAct ? 'btnDone' : 'btnTaken')) }),
      el('button', { class: 'btn btn-secondary', onclick: () => setLog(it.id, 'skipped'), html: M.icon('x', 18, 'currentColor', 2.6) + ' ' + esc(t(isAct ? 'btnDidntDo' : 'btnDidnt')) }));
    if (l.status === 'taken') {
      const label = l.taken_min != null ? fmt('takenAt', { time: fmtMin(l.taken_min) }) : t('takenWord');
      return el('div', {}, el('div', { class: 'statebar sb-taken' }, el('span', { html: M.icon('check', 18, 'var(--color-accent-2-700)', 2.6) }), el('span', { style: 'flex:1' }, label),
        el('button', { class: 'btn btn-ghost small', onclick: () => setLog(it.id, null) }, t('btnChange'))),
        el('button', { class: 'linklike', onclick: (e) => editTime(it, e) }, t('editTime')));
    }
    return el('div', { class: 'statebar sb-skip' }, el('span', { html: M.icon('x', 18, 'var(--color-accent-700)', 2.6) }), el('span', { style: 'flex:1' }, t('markedNot')),
      el('button', { class: 'btn btn-ghost small', onclick: () => setLog(it.id, null) }, t('btnChange')));
  }
  function editTime(it, e) {
    const wrap = e.target.closest('.itemcard'); if (wrap.querySelector('.timeedit')) { wrap.querySelector('.timeedit').remove(); return; }
    const sel = el('select', { class: 'input' }); for (let m = 0; m < 1440; m += 30) sel.append(el('option', { value: m, selected: Math.abs((state.logs[it.id].taken_min ?? it.time) - m) < 15 ? 'selected' : null }, fmtMin(m)));
    sel.addEventListener('change', () => setLog(it.id, 'taken', parseInt(sel.value, 10)));
    e.target.after(el('div', { class: 'timeedit' }, sel));
  }

  /* ---------------- Manage ---------------- */
  function renderManage(screen) {
    const p = curManage();
    head(screen, t('mngKicker'), t('mngTitle'));
    screen.append(switcher('manageSel'));
    const c = el('div', { class: 'content' });
    c.append(el('div', { class: 'mng-listhead' }, el('h2', { class: 'display', style: 'font-size:1.25em' }, fmt('listOf', { name: personName(p) })),
      el('button', { class: 'btn btn-primary', onclick: () => openEditor(null), html: M.icon('plus', 18, 'currentColor', 2.6) + ' ' + esc(t('addBtn')) })));
    if (!state.items.length) c.append(el('p', { class: 'soon' }, fmt('noList', { name: personName(p) })));
    state.items.slice().sort((a, b) => (a.group + a.time) < (b.group + b.time) ? -1 : 1).forEach(it => {
      const meta = it.type === 'pill' ? [fmt('take', { n: it.count }), t('group' + cap(it.group)), it.purpose].filter(Boolean).join(' · ')
        : [t('typeActivity'), t('group' + cap(it.group)), it.purpose].filter(Boolean).join(' · ');
      const rec = recurText(it);
      c.append(el('div', { class: 'mrow card' },
        state.showPhotos ? el('span', { class: 'mrow-av ' + (it.type === 'activity' ? 'act' : 'pill'), html: it.photo ? '' : M.icon(it.type === 'activity' ? 'activity' : 'pill', 22, it.type === 'activity' ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)') }) : null,
        el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'font-weight:700' }, it.name), el('div', { class: 'muted', style: 'font-size:.82em' }, meta), rec ? el('div', { style: 'font-size:.8em;color:var(--color-accent-2-700)' }, rec) : null),
        el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('editPerson'), onclick: () => openEditor(it), html: M.icon('pencil', 18) }),
        el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': t('removePhoto'), onclick: () => removeItem(it), html: M.icon('trash', 18) })));
    });
    screen.append(c);
  }
  function recurText(it) {
    const parts = []; const f = it.freq || 'daily';
    if (f === 'weekly') { const names = (it.days || []).slice().sort((a, b) => a - b).map(d => M.wdShort(d, state.lang)).join(', '); parts.push(t('repWeekly') + (names ? ' · ' + names : '')); }
    else if (f === 'monthly') parts.push(t('repMonthly') + ' · ' + fmt('domLabel', { n: it.dom || 1 }));
    if (it.endMode === 'date' && it.endDate) parts.push(fmt('until', { date: M.shortDate(it.endDate, state.lang) }));
    if (it.endMode === 'count' && it.endCount) parts.push(fmt('untilCount', { n: it.endCount }));
    return parts.join(' · ');
  }
  async function removeItem(it) { await api('/api/items.php?action=delete', { method: 'POST', body: { id: it.id } }); await loadDay(state.manageSel); render(); }

  /* ---------------- Item editor dialog ---------------- */
  function openEditor(it) {
    state.editItem = it ? Object.assign({}, it) : { isNew: true, type: 'pill', name: '', count: 1, group: 'morning', time: 8 * 60, freq: 'daily', days: [], dom: 1, endMode: 'never', purpose: '', note: '' };
    renderEditor();
  }
  function renderEditor() {
    const e = state.editItem; const pid = state.manageSel;
    const bd = el('div', { class: 'dialog-backdrop', onclick: (ev) => { if (ev.target === bd) closeDialog(); } });
    const field = (labelKey, ctrl) => el('div', { class: 'field' }, el('label', {}, t(labelKey)), ctrl);
    const input = (val, ph) => el('input', { class: 'input', value: val ?? '', placeholder: ph ? t(ph) : null });
    const nameI = input(e.name, 'phName');
    const typeS = sel(['pill', 'activity'], [t('typeMedicine'), t('typeActivity')], e.type, v => { e.type = v; });
    const countI = el('input', { class: 'input', type: 'number', min: 1, value: e.count });
    const whenS = sel(['morning', 'noon', 'evening', 'bedtime'], ['groupMorning', 'groupNoon', 'groupEvening', 'groupBedtime'].map(t), e.group, v => { e.group = v; });
    const timeS = el('select', { class: 'input' }); for (let m = 0; m < 1440; m += 30) timeS.append(el('option', { value: m, selected: Math.abs(e.time - m) < 15 ? 'selected' : null }, fmtMin(m)));
    const repeatS = sel(['daily', 'weekly', 'monthly'], [t('repDaily'), t('repWeekly'), t('repMonthly')], e.freq, v => { e.freq = v; renderEditor(); });
    const purposeI = input(e.purpose, 'phFor'); const noteI = input(e.note, 'phNote');
    const dc = el('div', { class: 'dialog' },
      el('div', { class: 'dialog-title display' }, t(e.isNew ? 'editAdd' : 'editEdit')),
      el('div', { class: 'dialog-body' },
        field('fName', nameI),
        el('div', { class: 'grid2' }, field('fType', typeS), field('fHowMany', countI)),
        el('div', { class: 'grid2' }, field('fWhen', whenS), field('fTime', timeS)),
        field('fRepeat', repeatS),
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
          e.count = Math.max(1, parseInt(countI.value, 10) || 1); e.time = parseInt(timeS.value, 10);
          const body = { profile_id: pid, type: e.type, name: e.name, count: e.count, grp: e.group, time_min: e.time,
            purpose: purposeI.value.trim(), note: noteI.value.trim(), freq: e.freq, days: e.days, dom: e.dom,
            end_mode: e.endMode, end_date: e.endDate, end_count: e.endCount, photo_url: e.photo };
          if (e.isNew) await api('/api/items.php?action=create', { method: 'POST', body });
          else await api('/api/items.php?action=update', { method: 'POST', body: Object.assign({ id: e.id }, body) });
          state.editItem = null; await loadDay(pid); render();
        } }, t('save'))));
    bd.append(dc); document.body.append(bd);
  }
  function sel(vals, labels, cur, on) { const s = el('select', { class: 'input' }); vals.forEach((v, i) => s.append(el('option', { value: v, selected: v === cur ? 'selected' : null }, labels[i]))); s.addEventListener('change', () => on(s.value)); return s; }
  function dayToggles(e) { const row = el('div', { class: 'daytoggles' }); for (let d = 0; d < 7; d++) { const on = (e.days || []).includes(d); row.append(el('button', { class: 'btn ' + (on ? 'btn-primary' : 'btn-secondary') + ' small', onclick: () => { e.days = on ? e.days.filter(x => x !== d) : [...(e.days || []), d]; renderEditor(); } }, M.wdChip(d, state.lang))); } return row; }
  function domSelect(e) { const s = el('select', { class: 'input' }); for (let d = 1; d <= 31; d++) s.append(el('option', { value: d, selected: (e.dom || 1) === d ? 'selected' : null }, d)); s.addEventListener('change', () => e.dom = parseInt(s.value, 10)); return s; }
  function endControls(e) {
    const wrap = el('div', {});
    const seg = el('div', { class: 'daytoggles' });
    [['never', 'endNever'], ['date', 'endOnDate'], ['count', 'endAfter']].forEach(([m, k]) => seg.append(el('button', { class: 'btn ' + (e.endMode === m ? 'btn-primary' : 'btn-secondary') + ' small', onclick: () => { e.endMode = m; renderEditor(); } }, t(k))));
    wrap.append(seg);
    if (e.endMode === 'date') wrap.append(el('input', { class: 'input', type: 'date', style: 'margin-top:8px', value: e.endDate || '', onchange: (ev) => e.endDate = ev.target.value }));
    if (e.endMode === 'count') wrap.append(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:8px' }, el('input', { class: 'input', type: 'number', min: 1, value: e.endCount || 1, style: 'max-width:120px', onchange: (ev) => e.endCount = parseInt(ev.target.value, 10) }), t('endTimes')));
    return wrap;
  }
  function closeDialog() { state.editItem = null; const b = $('.dialog-backdrop'); if (b) b.remove(); }

  /* ---------------- Settings ---------------- */
  function renderSettings(screen) {
    head(screen, t('setKicker'), t('setTitle'));
    const c = el('div', { class: 'content stack' });
    const seg = (labelHtml, opts, cur, on) => { const box = el('div', { class: 'card', style: 'padding:14px' }, el('div', { class: 'set-label', html: labelHtml }), el('div', { class: 'segrow' }, ...opts.map(([v, lab]) => el('button', { class: 'btn ' + (cur === v ? 'btn-primary' : 'btn-secondary'), onclick: () => on(v) }, lab)))); return box; };
    c.append(
      seg(M.icon('globe', 18) + ' ' + t('setLanguage'), [['ro', 'Română'], ['en', 'English']], state.lang, v => { state.lang = v; localStorage.setItem('med_lang', v); render(); }),
      seg(t('setTextSize'), [['Standard', t('tsStandard')], ['Large', t('tsLarge')], ['Extra large', t('tsXL')]], state.textSize, v => { state.textSize = v; localStorage.setItem('med_text', v); render(); }),
      seg(t('setPhotos'), [[true, t('onWord')], [false, t('offWord')]], state.showPhotos, v => { state.showPhotos = v; localStorage.setItem('med_photos', v ? '1' : '0'); render(); }),
    );
    if (state.user.admin) c.append(el('a', { class: 'btn btn-secondary btn-block', href: '/admin/' }, t('admin')));
    c.append(el('button', { class: 'btn btn-ghost btn-block', onclick: async () => { await api('/auth/logout.php', { method: 'POST' }); location.reload(); } }, t('signOut')));
    c.append(el('p', { class: 'center muted', style: 'font-size:.8em' }, state.user.email));
    screen.append(c);
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
      el('div', { class: 'brand-row' }, el('div', { class: 'brand-mark', html: M.icon('pill', 30, '#fff') }), el('div', {}, el('div', { class: 'brand-name display' }, t('brand')), el('div', { class: 'brand-tag' }, t('tagline')))),
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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
