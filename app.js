/* app.js — Alongside client (Phase 1: real auth + shell + profiles + settings).
   Phase 2 fills Today/History/Manage from the handoff logic. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, a = {}, ...k) => { const n = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'class') n.className = v; else if (x === 'html') n.innerHTML = v; else if (x.startsWith('on')) n.addEventListener(x.slice(2), v); else n.setAttribute(x, v); } for (const c of k.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };

  const state = {
    user: null, csrf: '', profiles: [],
    lang: localStorage.getItem('med_lang') || 'ro',
    textSize: localStorage.getItem('med_text') || 'Large',
    tab: 'today',
  };
  const SIZES = { Standard: 17, Large: 19, 'Extra large': 22 };
  const t = (k) => (window.STR[state.lang] && window.STR[state.lang][k]) || k;
  function applyPrefs() {
    document.documentElement.style.fontSize = (SIZES[state.textSize] || 19) + 'px';
    document.documentElement.lang = state.lang;
  }

  async function api(path, opts = {}) {
    const o = Object.assign({ credentials: 'include', headers: {} }, opts);
    if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
    if ((o.method || 'GET') !== 'GET') o.headers['X-CSRF'] = state.csrf;
    const r = await fetch(path, o);
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error((j && j.error) || r.status), { status: r.status, data: j });
    return j;
  }

  const root = () => $('#root');

  /* ---------------- Login ---------------- */
  function renderLogin(errKey) {
    applyPrefs();
    const frame = $('#frame');
    frame.innerHTML = '';
    const wrap = el('div', { class: 'login-wrap content' });
    wrap.append(
      el('div', { class: 'blob', style: 'width:300px;height:300px;background:var(--color-accent-2-200);top:-120px;right:-90px' }),
      el('div', { class: 'blob', style: 'width:150px;height:150px;background:var(--color-accent-200);bottom:-40px;left:-50px' }),
    );
    const emailIn = el('input', { class: 'input', type: 'email', autocomplete: 'username', placeholder: t('email') });
    const passIn = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: t('password') });
    const errBox = el('div', { class: 'error', style: 'display:' + (errKey ? 'block' : 'none') }, errKey ? t(errKey) : '');
    const doLogin = async () => {
      errBox.style.display = 'none';
      try { await api('/auth/login.php', { method: 'POST', body: { email: emailIn.value.trim(), password: passIn.value } }); await boot(); }
      catch (e) { errBox.textContent = t(e.status === 401 ? 'bad_credentials' : 'bad_credentials'); errBox.style.display = 'block'; }
    };
    passIn.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

    const gG = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.2C12.3 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.6 37.9 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.4 28.5c-.5-1.5-.8-3.1-.8-4.5s.3-3 .8-4.5l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.7-3.7-13.6-9l-7.9 6.2C6.4 42.6 14.6 48 24 48z"/></svg>';

    wrap.append(
      el('div', { class: 'brand-row' },
        el('div', { class: 'brand-mark', html: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="4"/><line x1="12" y1="8" x2="12" y2="16"/></svg>' }),
        el('div', {}, el('div', { class: 'brand-name display' }, t('brand')), el('div', { class: 'brand-tag' }, t('tagline'))),
      ),
      el('h1', { class: 'login-h' }, t('welcome')),
      el('p', { class: 'login-sub' }, t('signin_sub')),
      errBox,
      el('div', { class: 'field' }, el('label', {}, t('email')), emailIn),
      el('div', { class: 'field' }, el('label', {}, t('password')), passIn),
      el('button', { class: 'btn btn-primary btn-block', onclick: doLogin, style: 'min-height:58px' }, t('signin')),
      el('div', { class: 'divider-or' }, t('or')),
      el('a', { class: 'btn btn-secondary btn-block gbtn', href: '/auth/login.php?provider=google' }, el('span', { html: gG }), t('google')),
      el('p', { class: 'center muted', style: 'margin-top:18px;font-size:.85em' }, t('help')),
      el('p', { class: 'center', style: 'margin-top:4px' }, el('a', { href: '#', class: 'muted', style: 'font-size:.8em', onclick: (e) => { e.preventDefault(); state.lang = state.lang === 'ro' ? 'en' : 'ro'; localStorage.setItem('med_lang', state.lang); renderLogin(); } }, state.lang === 'ro' ? 'English' : 'Română')),
    );
    frame.append(wrap);
  }

  /* ---------------- App shell ---------------- */
  const TAB_ICON = {
    today: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
    history: '<path d="M3 3v6h6"/><path d="M3 9a9 9 0 1 0 3-6.7"/><path d="M12 8v4l3 2"/>',
    manage: '<path d="M12 2v20M2 12h20"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L4 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4L18.9 13a7 7 0 0 0 .1-1z"/>',
  };
  function greeting() { const h = new Date().getHours(); return h < 12 ? t('good_morning') : h < 17 ? t('good_afternoon') : t('good_evening'); }

  function renderApp() {
    applyPrefs();
    const frame = $('#frame');
    frame.innerHTML = '';
    const screen = el('div', { class: 'screen', id: 'screen' });
    frame.append(screen, renderTabbar());
    renderTab(screen);
  }
  function renderTabbar() {
    const bar = el('nav', { id: 'tabbar' });
    for (const key of ['today', 'history', 'manage', 'settings']) {
      bar.append(el('button', { 'aria-current': state.tab === key ? 'page' : 'false', onclick: () => { state.tab = key; renderApp(); } },
        el('span', { class: 'ico', html: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${TAB_ICON[key]}</svg>` }),
        t(key)));
    }
    return bar;
  }
  function header(screen, titleKey) {
    screen.append(
      el('div', { class: 'blob', style: 'width:220px;height:220px;background:var(--color-accent-2-200);top:-90px;right:-70px' }),
      el('div', { class: 'content' },
        el('div', { class: 'appbar-kicker' }, greeting() + ' · ' + new Date().toLocaleDateString(state.lang === 'ro' ? 'ro-RO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })),
        el('h1', { class: 'appbar-title display' }, t(titleKey))),
    );
  }
  function renderTab(screen) {
    screen.innerHTML = '';
    if (state.tab === 'settings') return renderSettings(screen);
    header(screen, state.tab);
    const c = el('div', { class: 'content' });
    if (state.tab === 'today') {
      const ul = el('ul', { class: 'plist' });
      if (!state.profiles.length) ul.append(el('li', { class: 'soon' }, t('no_profiles')));
      else state.profiles.forEach(p => ul.append(el('li', {},
        el('span', { class: 'pavatar' }, (p.name || '?').charAt(0).toUpperCase()),
        el('div', {}, el('div', { style: 'font-weight:700' }, p.name), el('div', { class: 'muted', style: 'font-size:.85em' }, p.relation || '')))));
      c.append(el('div', { class: 'card-kicker', style: 'text-transform:uppercase;letter-spacing:.08em;font-size:.72em;color:var(--color-neutral-700)' }, t('profiles')), ul);
      c.append(el('p', { class: 'soon', style: 'margin-top:18px' }, t('coming_soon')));
    } else {
      c.append(el('p', { class: 'soon' }, t('coming_soon')));
    }
    screen.append(c);
  }
  function renderSettings(screen) {
    header(screen, 'settings');
    const c = el('div', { class: 'content stack' });
    const seg = (label, opts, cur, on) => {
      const box = el('div', { class: 'card', style: 'padding:14px' }, el('div', { style: 'font-weight:700;margin-bottom:8px' }, label));
      const row = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
      opts.forEach(o => row.append(el('button', { class: 'btn ' + (cur === o ? 'btn-primary' : 'btn-secondary'), onclick: () => on(o) }, o)));
      box.append(row); return box;
    };
    c.append(
      seg('Language / Limbă', ['Română', 'English'], state.lang === 'ro' ? 'Română' : 'English', v => { state.lang = v === 'Română' ? 'ro' : 'en'; localStorage.setItem('med_lang', state.lang); renderApp(); }),
      seg('Text size', ['Standard', 'Large', 'Extra large'], state.textSize, v => { state.textSize = v; localStorage.setItem('med_text', v); renderApp(); }),
    );
    if (state.user && state.user.admin) c.append(el('a', { class: 'btn btn-secondary btn-block', href: '/admin/' }, t('admin')));
    c.append(el('button', { class: 'btn btn-ghost btn-block', onclick: async () => { await api('/auth/logout.php', { method: 'POST' }); location.reload(); } }, t('signout')));
    c.append(el('p', { class: 'center muted', style: 'font-size:.8em;margin-top:10px' }, state.user ? state.user.email : ''));
    screen.append(c);
  }

  /* ---------------- Boot ---------------- */
  async function boot() {
    applyPrefs();
    let me;
    try { me = await api('/auth/me.php'); } catch (e) { me = { user: null }; }
    if (!me.user) return renderLogin();
    state.user = me.user; state.csrf = me.csrf || '';
    try { state.profiles = (await api('/api/profiles.php?action=list')).profiles || []; } catch (e) { state.profiles = []; }
    renderApp();
  }

  boot();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
