/* logic.js — framework-agnostic domain logic + icons, ported from the handoff
   source (GROUPS windows, ICONS paths, isScheduledOn). Exposed as window.MED. */
(() => {
  const GROUPS = [
    { key: 'morning', label: 'groupMorning', start: 5 * 60, end: 11 * 60 },
    { key: 'noon', label: 'groupNoon', start: 11 * 60, end: 15 * 60 },
    { key: 'evening', label: 'groupEvening', start: 16 * 60, end: 21 * 60 },
    { key: 'bedtime', label: 'groupBedtime', start: 21 * 60, end: 24 * 60 },
  ];

  const ICONS = {
    check: [['path', { d: 'M20 6 9 17l-5-5' }]],
    x: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'M6 6l12 12' }]],
    morning: [['path', { d: 'M12 2v8' }], ['path', { d: 'm4.93 10.93 1.41 1.41' }], ['path', { d: 'M2 18h2' }], ['path', { d: 'M20 18h2' }], ['path', { d: 'm19.07 10.93-1.41 1.41' }], ['path', { d: 'M22 22H2' }], ['path', { d: 'm8 6 4-4 4 4' }], ['path', { d: 'M16 18a4 4 0 0 0-8 0' }]],
    noon: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2' }], ['path', { d: 'M12 20v2' }], ['path', { d: 'm4.93 4.93 1.41 1.41' }], ['path', { d: 'm17.66 17.66 1.41 1.41' }], ['path', { d: 'M2 12h2' }], ['path', { d: 'M20 12h2' }], ['path', { d: 'm6.34 17.66-1.41 1.41' }], ['path', { d: 'm19.07 4.93-1.41 1.41' }]],
    evening: [['path', { d: 'M12 10V2' }], ['path', { d: 'm4.93 10.93 1.41 1.41' }], ['path', { d: 'M2 18h2' }], ['path', { d: 'M20 18h2' }], ['path', { d: 'm19.07 10.93-1.41 1.41' }], ['path', { d: 'M22 22H2' }], ['path', { d: 'm16 6-4 4-4-4' }], ['path', { d: 'M16 18a4 4 0 0 0-8 0' }]],
    bedtime: [['path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }]],
    pill: [['path', { d: 'm10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z' }], ['path', { d: 'm8.5 8.5 7 7' }]],
    activity: [['path', { d: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2' }]],
    plus: [['path', { d: 'M5 12h14' }], ['path', { d: 'M12 5v14' }]],
    minus: [['path', { d: 'M5 12h14' }]],
    pencil: [['path', { d: 'M12 20h9' }], ['path', { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }]],
    trash: [['path', { d: 'M3 6h18' }], ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }], ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }]],
    today: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'm9 12 2 2 4-4' }]],
    calendar: [['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ['path', { d: 'M16 2v4' }], ['path', { d: 'M8 2v4' }], ['path', { d: 'M3 10h18' }]],
    clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 6v6l4 2' }]],
    bell: [['path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' }], ['path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' }]],
    globe: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }], ['path', { d: 'M2 12h20' }]],
    gear: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }]],
    camera: [['path', { d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' }], ['circle', { cx: 12, cy: 13, r: 3 }]],
    chevronLeft: [['path', { d: 'm15 18-6-6 6-6' }]],
    chevronRight: [['path', { d: 'm9 18 6-6-6-6' }]],
    rotate: [['path', { d: 'M3 7v6h6' }], ['path', { d: 'M21 17a9 9 0 0 0-9-9 8.97 8.97 0 0 0-6.34 2.66L3 13' }]],
    share: [['circle', { cx: 18, cy: 5, r: 3 }], ['circle', { cx: 6, cy: 12, r: 3 }], ['circle', { cx: 18, cy: 19, r: 3 }], ['path', { d: 'm8.6 13.5 6.8 3.9' }], ['path', { d: 'm15.4 6.6-6.8 3.9' }]],
    download: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['path', { d: 'M7 10l5 5 5-5' }], ['path', { d: 'M12 15V3' }]],
    note: [['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }], ['path', { d: 'M14 2v6h6' }], ['path', { d: 'M9 13h6' }], ['path', { d: 'M9 17h4' }]],
  };

  function icon(name, size = 24, color = 'currentColor', sw = 2.75) {
    const parts = (ICONS[name] || []).map(([tag, a]) => {
      const at = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
      return `<${tag} ${at}/>`;
    }).join('');
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${parts}</svg>`;
  }

  const pad = (n) => (n < 10 ? '0' : '') + n;
  const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function fmtMin(m, lang) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60), mm = m % 60;
    if (lang === 'ro') return pad(h) + ':' + pad(mm);
    const ap = h < 12 ? 'AM' : 'PM'; let hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + pad(mm) + ' ' + ap;
  }

  // ported verbatim (standalone). item uses handoff shape: {freq,days[],dom,endMode,endDate,endCount,startDate}
  function isScheduledOn(item, date) {
    const mode = item.endMode || (item.endDate ? 'date' : 'never');
    if (mode === 'date' && item.endDate) { const end = new Date(item.endDate + 'T23:59:59'); if (!isNaN(end) && date > end) return false; }
    const f = item.freq || 'daily';
    const occurs = (d) => f === 'weekly' ? (Array.isArray(item.days) && item.days.indexOf(d.getDay()) >= 0) : f === 'monthly' ? (d.getDate() === (item.dom || 1)) : true;
    if (!occurs(date)) return false;
    if (mode === 'count' && item.startDate) {
      const start = new Date(item.startDate + 'T00:00:00');
      if (!isNaN(start) && date >= start) {
        const cap = Number(item.endCount) || 10; const dIso = isoOf(date); let n = 0; const cur = new Date(start);
        for (let i = 0; i < 800; i++) { if (cur > date) break; if (occurs(cur)) { n++; if (isoOf(cur) === dIso) return n <= cap; } cur.setDate(cur.getDate() + 1); }
      }
    }
    return true;
  }

  const wdShort = (d, lang) => (lang === 'ro' ? ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[d];
  const wdChip = (d, lang) => (lang === 'ro' ? ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])[d];
  function shortDate(iso, lang) {
    const d = new Date(iso + 'T00:00:00'); if (isNaN(d)) return iso;
    const mo = lang === 'ro' ? ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'noi.', 'dec.'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + mo[d.getMonth()];
  }

  // daypart derived from the item's time, so Today/History sections follow the clock
  function groupForMin(m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    if (m >= 300 && m < 660) return 'morning';   // 05:00–10:59
    if (m >= 660 && m < 960) return 'noon';       // 11:00–15:59
    if (m >= 960 && m < 1260) return 'evening';   // 16:00–20:59
    return 'bedtime';                             // 21:00–04:59
  }

  window.MED = { GROUPS, ICONS, icon, isoOf, fmtMin, pad, isScheduledOn, groupForMin, wdShort, wdChip, shortDate };
})();
