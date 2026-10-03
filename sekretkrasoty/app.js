/* Demo-sites engine. Всё содержимое берётся из config.json (вшит в index.html при сборке). */
(() => {
  'use strict';
  const C = JSON.parse(document.getElementById('cfg').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const WDL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const SERVICES = (C.services || []).map((s, i) => ({ id: s.id || 's' + i, ...s }));
  const STORE_KEY = 'demo_visits_' + (C.slug || 'site');
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; } },
    set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ---------- theme ---------- */
  const hexToRgb = h => { const m = h.replace('#', '').match(/.{2}/g) || ['b4', '74', '6a']; return m.map(x => parseInt(x, 16)); };
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  function setAccent(hex) {
    const rgb = hexToRgb(hex);
    const root = document.documentElement.style;
    root.setProperty('--accent', hex);
    root.setProperty('--accent-soft', `rgba(${rgb.join(',')},.13)`);
    root.setProperty('--on-accent', lum(rgb) > .45 ? '#111' : '#fff');
  }
  const theme = C.theme || {};
  document.documentElement.dataset.preset = theme.preset || 'nails-light';
  if (theme.layout) document.documentElement.dataset.layout = theme.layout;
  setAccent(theme.accent || '#b4746a');

  /* ---------- helpers ---------- */
  const fmtMin = m => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`) : `${m} мин`;
  const price = s => s.price ? `${s.from ? 'от ' : ''}${s.price} BYN` : 'по запросу';
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const niceDate = s => { const d = parseYmd(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const hoursFor = d => { const h = (C.hours || {})[KEYS[d.getDay()]]; return h && h[0] && h[1] ? h : null; };
  function days(n = 14) { const out = []; const t = new Date(); t.setHours(12, 0, 0, 0); for (let i = 0; i < n; i++) { const d = new Date(t); d.setDate(t.getDate() + i); out.push(d); } return out; }
  // master: 'any' (любой свободный) или id мастера из C.staff — у конкретного мастера своё демо-расписание
  function slotsFor(dateStr, svc, master = 'any') {
    const d = parseYmd(dateStr); const h = hoursFor(d); if (!h) return [];
    const start = toMin(h[0]), end = toMin(h[1] === '00:00' ? '24:00' : h[1]);
    const taken = store.get().filter(v => v.date === dateStr && (master === 'any' || !v.master || v.master === master)).map(v => v.time);
    const now = new Date(); const out = [];
    const busy = master === 'any' ? 38 : 52;
    for (let m = start; m + (svc.min || 60) <= end; m += 30) {
      const t = fromMin(m); const dt = new Date(d); dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (dt < new Date(now.getTime() + 30 * 60000)) continue;
      if (hash(C.slug + (master === 'any' ? '' : master) + dateStr + t) % 100 < busy) continue; // демо: часть времени занята
      if (taken.includes(t)) continue;
      out.push(t);
    }
    return out;
  }
  function firstDay(svc, master = 'any') { for (const d of days()) if (slotsFor(ymd(d), svc, master).length) return ymd(d); return ymd(new Date()); }
  // Мастера, которые делают выбранные услуги (по категориям); пусто — у салона один мастер
  function mastersFor(svc) {
    const staff = C.staff || []; if (!staff.length || !svc) return [];
    const cats = new Set((svc.ids || [svc.id]).map(id => (SERVICES.find(s => s.id === id) || {}).category).filter(Boolean));
    const fit = staff.filter(m => !m.categories || m.categories.some(c => cats.has(c)));
    return fit.length ? fit : staff;
  }
  function openNow() {
    const d = new Date(); const h = hoursFor(d); if (!h) return { open: false, text: 'Сегодня выходной' };
    const m = d.getHours() * 60 + d.getMinutes(); const s = toMin(h[0]), e = toMin(h[1] === '00:00' ? '24:00' : h[1]);
    return m >= s && m < e ? { open: true, text: `Открыто до ${h[1]}` } : { open: false, text: m < s ? `Откроется в ${h[0]}` : 'Сейчас закрыто' };
  }
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2400); }
  const cats = [...new Set(SERVICES.map(s => s.category || 'Услуги'))];
  const mainCat = cats[0];
  const mainSvcs = SERVICES.filter(s => s.price && (s.category || 'Услуги') === mainCat);
  const minPrice = Math.min(...(mainSvcs.filter(s => (s.min || 60) >= 45).length ? mainSvcs.filter(s => (s.min || 60) >= 45) : mainSvcs).map(s => s.price));
  const ICON = {
    ig: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tel: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    msg: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    pin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>'
  };
  const DEFAULT_PALETTE = [
    { name: 'Нюд', hex: '#C9A08A' }, { name: 'Пыльная роза', hex: '#B4746A' }, { name: 'Бордо', hex: '#7A2E3A' },
    { name: 'Молочный', hex: '#D9C9BB' }, { name: 'Шалфей', hex: '#8A9A82' }, { name: 'Графит', hex: '#3A3734' }, { name: 'Лаванда', hex: '#9C8FB5' }
  ];

  /* ---------- home ---------- */
  function renderHome() {
    const name = C.name || '';
    const words = name.split(' ');
    const h1 = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [name];
    const st = openNow();
    const gallery = C.gallery || [];
    const rating = C.rating && C.rating.value >= 4 ?`★ ${C.rating.value}${C.rating.count ? ' · ' + C.rating.count + ' отз.' : ''}` : '';
    const palette = C.palette === false ? null : (C.palette || (/^(nails|rose)/.test(theme.preset || '') ? DEFAULT_PALETTE : null));
    const L = C.links || {};
    const contacts = [
      C.phone && `<a class="press" href="tel:${esc(C.phone)}">${ICON.tel}<span class="tnum">${esc(C.phoneLabel || C.phone)}</span></a>`,
      L.instagram && `<a class="press" href="${esc(L.instagram)}" target="_blank" rel="noopener">${ICON.ig}Instagram</a>`,
      L.whatsapp && `<a class="press" href="${esc(L.whatsapp)}" target="_blank" rel="noopener">${ICON.msg}WhatsApp</a>`,
      L.telegram && `<a class="press" href="${esc(L.telegram)}" target="_blank" rel="noopener">${ICON.msg}Telegram</a>`,
      L.viber && `<a class="press" href="${esc(L.viber)}">${ICON.msg}Viber</a>`,
      C.email && `<a class="press" href="mailto:${esc(C.email)}">${ICON.msg}${esc(C.email)}</a>`
    ].filter(Boolean).join('');
    const today = new Date().getDay();
    const hoursRows = [1, 2, 3, 4, 5, 6, 0].map(i => { const h = (C.hours || {})[KEYS[i]]; return `<div class="${i === today ? 'today' : ''}"><span>${WDL[i]}</span><span class="tnum">${h ? h[0] + '–' + h[1] : 'выходной'}</span></div>`; }).join('');
    const route = C.coords ? `https://yandex.by/maps/?rtext=~${C.coords.lat},${C.coords.lon}&rtt=auto` : `https://yandex.by/maps/?text=${encodeURIComponent((C.city || 'Минск') + ', ' + (C.address || ''))}`;

    if (theme.layout === 'studio') { renderStudio({ name, rating, palette, contacts, hoursRows, route, gallery, L }); return; }

    $('#v-home').innerHTML = `
      <div class="ribbon">${esc((C.demo && C.demo.note) || 'Демо-версия сайта. Цены и свободное время примерные.')}</div>
      <div class="hero-wrap">
        <div class="hero ${C.hero ? '' : 'noimg'}" id="hero">
          ${C.hero ? `<img src="${esc(C.hero)}" alt="${esc(name)}" fetchpriority="high" id="hero-img">` : `<div class="big-mono">${esc(name.slice(0, 2))}</div>`}
          ${rating ? `<div class="rate">${esc(rating)} · 2GIS</div>` : ''}
          <button class="cta press" data-book="">Записаться онлайн <i>↗</i></button>
        </div>
      </div>
      <div class="kind">${esc(C.kind || '')} · ${esc(C.city || 'Минск')}</div>
      <h1>${h1.map(l => `<span class="line"><span>${esc(l)}</span></span>`).join('')}</h1>
      <p class="lead reveal">${esc(C.tagline || '')}</p>
      <div class="tiles reveal">
        <div class="tile"><div class="v tnum">${SERVICES.length}</div><div class="k">услуг в прайсе</div></div>
        <div class="tile"><div class="v tnum">${isFinite(minPrice) ? minPrice : '—'}<small style="font-size:15px;font-weight:550"> BYN</small></div><div class="k">цены от</div></div>
        <div class="tile wide"><div><span class="dot ${st.open ? '' : 'off'}"></span><b>${esc(st.text)}</b></div><div class="k">${esc(C.address || '')}</div></div>
      </div>

      <div class="sec reveal">
        <div class="sec-h"><h2>Свободно на неделе</h2><span class="link">время Минска</span></div>
        <div class="chips" id="quick"></div>
      </div>

      ${palette ? `<div class="sec reveal" id="palette-sec">
        <div class="sec-h"><h2>Палитра</h2><span class="link">выберите оттенок</span></div>
        <div class="palette">${palette.map((p, i) => `<button class="sw press ${i === 0 ? '' : ''}" data-hex="${esc(p.hex)}"><i style="background:${esc(p.hex)}"></i>${esc(p.name)}</button>`).join('')}</div>
        <p class="swatch-note">Нажмите на цвет — так мастер увидит ваш выбор заранее.</p>
      </div>` : ''}

      <div class="sec reveal" id="services">
        <div class="sec-h"><h2>Услуги и цены</h2><span class="link">${C.demo && C.demo.pricesAreDemo ? 'цены — демо' : ''}</span></div>
        ${cats.length > 1 ? `<div class="cats">${['Все', ...cats].map((c, i) => `<button class="cat press ${i === 0 ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
        <div id="svc-list"></div>
      </div>

      ${gallery.length ? `<div class="sec reveal">
        <div class="sec-h"><h2>Работы</h2><span class="counter tnum" id="wcount">01 / ${pad(gallery.length)}</span></div>
        <div class="works" id="works">${gallery.map((g, i) => `<button class="work" data-lb="${i}"><img src="${esc(g.src)}" alt="${esc(g.caption || 'Работа')}" loading="lazy">${g.caption ? `<span>${esc(g.caption)}</span>` : ''}${g.kind === 'ai' ? '<em>иллюстрация</em>' : ''}</button>`).join('')}</div>
      </div>` : ''}

      <div class="sec reveal">
        <div class="book-card">
          <h3>${esc(C.bookTitle || 'Запишитесь без переписки')}</h3>
          <p>${esc(C.bookText || 'Выберите услугу и свободное время — подтверждение сразу, без звонков и ожидания ответа в Direct.')}</p>
          <button class="btn btn-accent press" data-book="">Выбрать время ↗</button>
        </div>
      </div>

      ${C.about ? `<div class="sec reveal"><h2 style="margin-bottom:12px">О нас</h2><p class="lead">${esc(C.about)}</p></div>` : ''}

      <div class="sec info reveal">
        <h2 style="margin-bottom:6px">Как нас найти</h2>
        <div class="row"><div><div style="font-weight:600">${esc(C.city || 'Минск')}, ${esc(C.address || '')}</div><div class="k">${esc(C.addressNote || '')}</div></div>
          <a class="btn btn-ghost press" style="width:auto;padding:0 18px;height:44px" target="_blank" rel="noopener" href="${esc(route)}">${ICON.pin}Маршрут</a></div>
        <div class="row"><div class="hours">${hoursRows}${C.hoursNote ? `<div style="color:var(--muted);font-size:13.5px;padding-top:8px">${esc(C.hoursNote)}</div>` : ''}</div></div>
        ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
        ${L.twogis ? `<a class="link" style="margin-top:6px" href="${esc(L.twogis)}" target="_blank" rel="noopener">${rating ? esc(rating) + ' — ' : ''}отзывы на 2GIS ↗</a>` : ''}
      </div>

      <div class="sec pwa reveal">
        <div style="font-size:13px;opacity:.65;text-transform:uppercase;letter-spacing:.08em">Приложение ${esc(name)}</div>
        <div class="big">Запись всегда<br>под рукой.</div>
        <p>Добавьте на экран телефона — следующий визит в пару касаний, без поиска ссылки и звонков.</p>
        <button class="btn press" id="pwa-btn">Добавить на экран</button>
      </div>

      <div class="foot"><span>${esc(name)} · ${esc(C.city || 'Минск')}</span><span>Демо-версия. Записи на этой странице не передаются салону.</span></div>`;

    renderServices('Все');
    renderQuick();
  }
  /* ---------- layout "studio": обложка-бренд, карточка записи, референсы ---------- */
  const INSPO_KEY = 'demo_inspo_' + (C.slug || 'site');
  const INSPO = new Set((() => { try { return JSON.parse(localStorage.getItem(INSPO_KEY) || '[]'); } catch (e) { return []; } })());
  const saveInspo = () => { try { localStorage.setItem(INSPO_KEY, JSON.stringify([...INSPO])); } catch (e) { /* private */ } };
  const SEL = new Set(); // услуги, отмеченные на главной (можно несколько)
  const plural = n => (n % 10 === 1 && n % 100 !== 11) ? 'услуга' : ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) ? 'услуги' : 'услуг';
  const visitSvc = x => x.svcName ? { name: x.svcName, price: x.price, from: x.from, min: x.min } : (visitSvc(x));
  function syncSel() { // обновляет отметки и нижнюю плашку без перерисовки страницы
    $$('[data-pick]').forEach(b => { const on = SEL.has(b.dataset.pick); b.classList.toggle('on', on); const t = b.querySelector('.tick'); if (t) t.textContent = on ? '✓' : '+'; });
    const f = $('#st-float'); if (!f) return;
    const cs = comboOf([...SEL]); const refs = [...INSPO].filter(i => (C.gallery || [])[i]).length;
    const txt = cs ? `${cs.count} ${plural(cs.count)} · ${price(cs)} · ${fmtMin(cs.min)}` : (refs ? `Добавлено ${refs} фото` : '');
    $('#st-count').textContent = txt + (cs && refs ? ` · ♥ ${refs}` : '');
    f.classList.toggle('on', !!txt);
  }
  function renderStudio(o) {
    const g = C.gallery || [];
    const main = SERVICES.find(s => s.featured) || SERVICES.find(s => (s.min || 60) >= 90) || SERVICES[0];
    const tags = C.inspoTags || ['Нюд', 'Френч', 'Миндаль', 'Дизайн', 'Короткие'];
    const words = (C.name || '').length > 9 ? 'long' : '';
    const svcHtml = cats.map(c => (cats.length > 1 ? `<div class="grp">${esc(c)}</div>` : '') + SERVICES.filter(s => (s.category || 'Услуги') === c).map(s => `<button type="button" class="svc st-svc" data-pick="${esc(s.id)}" aria-pressed="false"><div><div class="n">${esc(s.name)}</div><div class="m tnum">${fmtMin(s.min || 60)}</div></div><div style="display:flex;align-items:center;gap:12px"><span class="p tnum">${price(s)}</span><span class="go tick">+</span></div></button>`).join('')).join('');
    $('#v-home').innerHTML = `
      <div class="ribbon">${esc((C.demo && C.demo.note) || 'Демо-версия сайта. Цены и свободное время примерные.')}</div>
      <section class="st-hero" id="hero">
        ${C.hero ? `<img src="${esc(C.hero)}" alt="${esc(C.name)}" id="hero-img" fetchpriority="high">` : ''}
        <div class="st-veil"></div>
        ${o.rating ? `<span class="st-pill-top">${esc(o.rating)} · 2GIS</span>` : ''}
        <div class="st-word"><div class="st-logo ${words}">${esc(C.name)}</div><div class="st-sub">${esc((C.kindLatin || 'Beauty studio'))} · ${esc(C.city || 'Минск')}</div></div>
      </section>

      <div class="st-card" id="st-card">
        <div class="st-row">
          <div class="st-thumb">${g[0] ? `<img src="${esc(g[0].src)}" alt="">` : ''}</div>
          <div class="st-info">
            <span class="st-badge" id="st-badge">Свободное время есть</span>
            <h3>${esc(main.name)}</h3>
            <p>${esc(main.desc || fmtMin(main.min || 60))}</p>
            <div class="st-master"><span class="st-av">${esc((C.name || '').slice(0, 1))}</span><div><b>${(C.staff || []).length ? `Мастер на выбор · ${(C.staff || []).length}` : 'Ваш мастер'}</b><span>${esc(C.name)} · ${esc(C.address || '')}</span></div></div>
          </div>
        </div>
        <div class="st-split">
          <button class="st-col" data-jump="inspo"><span class="k">Референсы</span><span class="st-avs" id="st-avs"></span></button>
          <div class="st-col"><span class="k">Ближайшее время</span><b class="tnum" id="st-when">—</b><span class="tnum st-when2" id="st-when2"></span></div>
        </div>
        <button class="st-pay press" data-cart="${esc(main.id)}" id="st-pay">Записаться · ${price(main)}</button>
        <p class="st-note">Оплата в салоне после визита. Отмена онлайн — не позднее чем за 3 часа.</p>
      </div>

      <div class="sec reveal"><div class="sec-h"><h2>Свободно на неделе</h2><span class="link">время Минска</span></div><div class="chips" id="quick"></div></div>

      <button class="st-allsvc press reveal" id="services" data-book=""><span><b>Все услуги и цены</b><small>${SERVICES.length} ${plural(SERVICES.length)} · ${esc(cats.slice(0, 3).join(', ').toLowerCase())}${C.demo && C.demo.pricesAreDemo ? ' · цены демо' : ''}</small></span><i>↗</i></button>

      ${g.length ? `<div class="sec reveal" id="inspo">
        <div class="sec-h"><div><h2>Референсы</h2><p class="st-hint">Отметьте ♡ работы — мастер увидит их в вашей записи</p></div></div>
        <div class="st-tags">${tags.map(t => `<button class="st-tag press on" data-tag="${esc(t)}">${esc(t)}<i>×</i></button>`).join('')}</div>
        <div class="st-grid">${g.map((x, i) => `<figure class="st-tile${i % 5 === 0 ? ' tall' : ''}"><img src="${esc(x.src)}" alt="${esc(x.caption || 'Работа')}" loading="lazy" data-lb="${i}">${x.kind === 'ai' ? '<em>иллюстрация</em>' : ''}<button class="st-heart press${INSPO.has(i) ? ' on' : ''}" data-heart="${i}" aria-label="В референсы">${INSPO.has(i) ? '♥' : '♡'}</button></figure>`).join('')}</div>
      </div>` : ''}

      ${C.about ? `<div class="sec reveal"><h2 style="margin-bottom:12px">О студии</h2><p class="lead">${esc(C.about)}</p></div>` : ''}

      <div class="sec info reveal">
        <h2 style="margin-bottom:6px">Как нас найти</h2>
        <div class="row"><div><div style="font-weight:600">${esc(C.city || 'Минск')}, ${esc(C.address || '')}</div><div class="k">${esc(C.addressNote || '')}</div></div>
          <a class="btn btn-ghost press" style="width:auto;padding:0 18px;height:44px" target="_blank" rel="noopener" href="${esc(o.route)}">${ICON.pin}Маршрут</a></div>
        <div class="row"><div class="hours">${o.hoursRows}${C.hoursNote ? `<div style="color:var(--muted);font-size:13.5px;padding-top:8px">${esc(C.hoursNote)}</div>` : ''}</div></div>
        ${o.contacts ? `<div class="contacts">${o.contacts}</div>` : ''}
      </div>

      <div class="sec pwa reveal">
        <div style="font-size:13px;opacity:.7;text-transform:uppercase;letter-spacing:.12em">Приложение ${esc(C.name)}</div>
        <div class="big">Запись всегда<br>под рукой.</div>
        <p>Добавьте на экран телефона — следующий визит в пару касаний.</p>
        <button class="btn press" id="pwa-btn">Добавить на экран</button>
      </div>
      <div class="foot"><span>${esc(C.name)} · ${esc(C.city || 'Минск')}</span><span>Демо-версия. Записи на этой странице не передаются салону.</span></div>
      <div class="st-float${INSPO.size ? ' on' : ''}" id="st-float"><span class="st-fi">▦</span><span id="st-count"></span><button class="press" data-cart="${esc(main.id)}">Записаться</button></div>`;
    // ближайшее окно для карточки
    for (const d of days(14)) { const sl = slotsFor(ymd(d), main); if (sl.length) {
      const end = fromMin(toMin(sl[0]) + (main.min || 60));
      $('#st-when').textContent = `${WD[d.getDay()]} ${d.getDate()}.${pad(d.getMonth() + 1)}`;
      $('#st-when2').textContent = `${sl[0]}–${end}`;
      $('#st-badge').textContent = ymd(d) === ymd(new Date()) ? 'Свободно сегодня' : 'Ближайшее окно';
      const pay = $('#st-pay'); pay.dataset.date = ymd(d); pay.dataset.time = sl[0];
      break; } }
    updateInspo();
    renderQuick();
  }
  function updateInspo() {
    const g = C.gallery || []; const ids = [...INSPO].filter(i => g[i]);
    const avs = $('#st-avs'); if (avs) avs.innerHTML = ids.length ? ids.slice(0, 3).map(i => `<img src="${esc(g[i].src)}" alt="">`).join('') + (ids.length > 3 ? `<span>+${ids.length - 3}</span>` : '') : '<span class="st-add">+ добавить</span>';
    syncSel();
  }
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-heart]');
    if (h) { const i = +h.dataset.heart; INSPO.has(i) ? INSPO.delete(i) : INSPO.add(i); saveInspo(); h.classList.toggle('on', INSPO.has(i)); h.textContent = INSPO.has(i) ? '♥' : '♡'; h.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.32,.72,0,1)' }); updateInspo(); e.stopPropagation(); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk) { e.preventDefault(); e.stopPropagation(); const id = pk.dataset.pick; SEL.has(id) ? SEL.delete(id) : SEL.add(id); syncSel(); return; }
    const cb = e.target.closest('[data-cart]');
    if (cb) { e.stopPropagation(); const main = cb.dataset.cart; openBooking(SEL.size ? [...SEL].join('+') : main, SEL.size ? null : cb.dataset.date, SEL.size ? null : cb.dataset.time); return; }
    const t = e.target.closest('[data-tag]'); if (t) { t.classList.toggle('on'); return; }
    const j = e.target.closest('[data-jump]'); if (j) { document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: 'smooth' }); }
  }, true);

  function renderServices(cat) {
    const list = SERVICES.filter(s => cat === 'Все' || (s.category || 'Услуги') === cat);
    $('#svc-list').innerHTML = list.map(s => `<button class="svc press" data-book="${esc(s.id)}"><div><div class="n">${esc(s.name)}</div><div class="m tnum">${fmtMin(s.min || 60)}${s.desc ? ' · ' + esc(s.desc) : ''}</div></div><div style="display:flex;align-items:center;gap:12px"><span class="p tnum">${price(s)}</span><span class="go">+</span></div></button>`).join('');
  }
  function renderQuick() {
    const svc = SERVICES[0]; const el = $('#quick'); if (!el || !svc) return;
    const chips = [];
    for (const d of days(7)) { for (const t of slotsFor(ymd(d), svc).slice(0, 2)) chips.push({ d, t }); if (chips.length >= 7) break; }
    el.innerHTML = chips.map(c => `<button class="chip press tnum" data-book="${esc(svc.id)}" data-date="${ymd(c.d)}" data-time="${c.t}"><b>${WD[c.d.getDay()]} ${c.d.getDate()}</b>${c.t}</button>`).join('') || '<span class="lead">На этой неделе мест нет</span>';
  }

  /* ---------- navigation ---------- */
  function go(v, anchor) {
    $$('.view').forEach(x => x.classList.remove('on')); $('#v-' + v).classList.add('on');
    $$('#nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (anchor || v)));
    $('#nav').style.display = v === 'cabinet' ? 'none' : 'flex';
    if (v === 'visits') renderVisits(); if (v === 'cabinet') renderCab();
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    else window.scrollTo({ top: 0 });
    observeReveals();
  }

  /* ---------- booking ---------- */
  let B = {};
  const TITLES = ['Услуга', 'Дата и время', 'Контакты', 'Проверьте запись'];
  // Несколько услуг в одной записи: объединённая «услуга» с общей ценой и длительностью
  function comboOf(ids) {
    const list = ids.map(id => SERVICES.find(s => s.id === id)).filter(Boolean);
    if (!list.length) return null;
    return { id: list.map(s => s.id).join('+'), ids: list.map(s => s.id), name: list.map(s => s.name).join(' + '),
      min: list.reduce((a, s) => a + (s.min || 60), 0), price: list.reduce((a, s) => a + (s.price || 0), 0), from: list.some(s => s.from), count: list.length };
  }
  // Блокировка прокрутки страницы без прыжка наверх и без сдвига вёрстки
  let lockY = 0;
  function lockScroll() { lockY = window.scrollY; const b = document.body.style; b.position = 'fixed'; b.top = `-${lockY}px`; b.left = '0'; b.right = '0'; }
  function unlockScroll() { const b = document.body.style; if (b.position !== 'fixed') return; b.position = b.top = b.left = b.right = ''; document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, lockY); document.documentElement.style.scrollBehavior = ''; }
  function openBooking(svcId, date, time) {
    const ids = svcId ? String(svcId).split('+') : [...SEL];
    const svc = comboOf(ids);
    B = { ids: svc ? svc.ids : [], svc, master: 'any', date: date || (svc ? firstDay(svc) : null), time: time || null, name: '', phone: '+375 ', agree: false, step: !svc ? 1 : (date && time ? 3 : 2) };
    if (!$('#sheet').classList.contains('on')) lockScroll();
    $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); render();
  }
  function closeBooking() { $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); unlockScroll(); }
  function render() {
    const s = B.step;
    $('#sh-title').textContent = s === 5 ? 'Готово' : TITLES[s - 1];
    $('#sh-step').textContent = s === 5 ? 'Запись подтверждена' : `Шаг ${s} из 4`;
    $$('#bar i').forEach((i, k) => i.classList.toggle('on', k < Math.min(s, 4)));
    let h = '', f = '';
    const backBtn = '<button class="btn btn-text press" data-act="back">← Назад</button>';
    if (s === 1) {
      h = `<p class="note" style="margin:0 0 12px">Можно выбрать несколько услуг.</p>` + cats.map(c => `<div class="grp">${esc(c)}</div>` + SERVICES.filter(x => (x.category || 'Услуги') === c).map(x => `<button class="opt ${B.ids.includes(x.id) ? 'sel' : ''}" data-act="svc" data-id="${esc(x.id)}"><div><div style="font-weight:600">${esc(x.name)}</div><div class="m tnum">${fmtMin(x.min || 60)}</div></div><div style="display:flex;align-items:center;gap:10px"><span class="tnum" style="font-weight:650;white-space:nowrap">${price(x)}</span><span class="tick">${B.ids.includes(x.id) ? '✓' : ''}</span></div></button>`).join('')).join('');
      const cs = comboOf(B.ids);
      f = `<button class="btn btn-accent press" id="b1" ${cs ? '' : 'disabled'} data-act="next">${cs ? `Далее · ${cs.count} ${plural(cs.count)} · ${price(cs)}` : 'Выберите услугу'}</button>`;
    }
    if (s === 2) {
      const ms = mastersFor(B.svc);
      const mHtml = ms.length ? `<div class="grp">Мастер</div><div class="masters">${[{ id: 'any', name: 'Любой свободный', role: 'больше свободного времени' }, ...ms].map(m => `<button class="mst ${B.master === m.id ? 'sel' : ''}" data-act="master" data-id="${esc(m.id)}"><span class="mav">${m.id === 'any' ? '✦' : esc((m.name || '?').replace(/[^А-ЯA-Zа-яa-z]/g, '').slice(0, 1))}</span><span><b>${esc(m.name)}</b><small>${esc(m.role || '')}</small></span></button>`).join('')}</div>${C.staffNote ? `<p class="note" style="margin:6px 0 4px">${esc(C.staffNote)}</p>` : ''}<div class="grp">Дата и время</div>` : '';
      h = `<div class="sumline"><span>${esc(B.svc.name)}</span><span class="tnum">${price(B.svc)}</span></div>${mHtml}
        <div class="days">${days().map(d => { const k = ymd(d); const has = slotsFor(k, B.svc, B.master).length; return `<button class="day press ${k === B.date ? 'sel' : ''} ${has ? '' : 'off'}" data-act="day" data-d="${k}"><span class="w">${WD[d.getDay()]}</span><span class="d tnum">${d.getDate()}</span></button>`; }).join('')}</div>
        <div class="slots tnum" id="slots">${Array(8).fill('<div class="skel"></div>').join('')}</div>`;
      f = `<button class="btn btn-accent press" ${B.time ? '' : 'disabled'} data-act="next" id="b2">Далее</button>${backBtn}`;
      setTimeout(renderSlots, 260);
    }
    if (s === 3) {
      h = `<div class="sumline"><span>${esc(B.svc.name)}</span><span class="tnum">${niceDate(B.date)}, ${B.time}</span></div>
        <label for="f-name">Имя</label><input class="field" id="f-name" autocomplete="name" value="${esc(B.name)}" placeholder="Как к вам обращаться">
        <label for="f-phone">Телефон</label><input class="field tnum" id="f-phone" inputmode="tel" autocomplete="tel" value="${esc(B.phone)}">`;
      f = `<button class="btn btn-accent press" id="b3" disabled data-act="next">Проверить запись</button>${backBtn}`;
    }
    if (s === 4) {
      h = `<div class="review"><h4>${esc(B.svc.name)}</h4>
        <div class="rv"><span>Когда</span><span class="tnum">${niceDate(B.date)} в ${B.time}</span></div>
        ${mastersFor(B.svc).length ? `<div class="rv"><span>Мастер</span><span>${esc(masterName(B.master))}</span></div>` : ''}
        <div class="rv"><span>Длительность</span><span>${fmtMin(B.svc.min || 60)}</span></div>
        <div class="rv"><span>Стоимость</span><span class="tnum">${price(B.svc)}</span></div>
        <div class="rv"><span>Имя</span><span>${esc(B.name)}</span></div>
        <div class="rv"><span>Телефон</span><span class="tnum">${esc(B.phone)}</span></div>
        <div class="rv"><span>Адрес</span><span style="text-align:right">${esc(C.address || '')}</span></div>
        ${INSPO.size ? `<div class="rv"><span>Референсы</span><span class="st-avs">${[...INSPO].filter(i => (C.gallery || [])[i]).slice(0, 4).map(i => `<img src="${esc(C.gallery[i].src)}" alt="">`).join('')}${INSPO.size > 4 ? `<span>+${INSPO.size - 4}</span>` : ''}</span></div>` : ''}</div>
        <p class="note">${esc(C.cancelRule || 'Перенос и отмена онлайн — не позднее чем за 3 часа до визита.')} Время — по Минску.</p>
        <label class="check"><input type="checkbox" id="agree" ${B.agree ? 'checked' : ''}>Согласен(на) на обработку имени и телефона для записи</label>`;
      f = `<button class="btn btn-accent press" id="b4" ${B.agree ? '' : 'disabled'} data-act="confirm">Записаться</button>${backBtn}`;
    }
    if (s === 5) {
      h = `<div class="done"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36"/><path d="M25 41l10 10 20-22"/></svg><h3>Вы записаны</h3>
        <p class="lead" style="margin-top:6px">${esc(B.svc.name)} · ${niceDate(B.date)} в ${B.time}</p>
        <p class="note">Демо: в настоящей версии подтверждение сразу увидит мастер в своём кабинете.</p></div>`;
      f = `<button class="btn btn-accent press" data-act="visits">Мои записи</button><button class="btn btn-ghost press" data-act="close">На главную</button>`;
    }
    $('#sh-body').innerHTML = `<div class="step">${h}</div>`; $('#sh-foot').innerHTML = f;
    if (s === 3) { const n = $('#f-name'), p = $('#f-phone'); n.oninput = () => { B.name = n.value; valid3(); }; p.oninput = () => { maskPhone(p); valid3(); }; valid3(); }
    if (s === 4) $('#agree').onchange = e => { B.agree = e.target.checked; $('#b4').disabled = !B.agree; };
    $('#sh-body').scrollTop = 0;
  }
  function renderSlots() {
    const el = $('#slots'); if (!el) return;
    const sl = slotsFor(B.date, B.svc, B.master);
    if (!sl.length) {
      let nd = null, nt = null;
      for (const d of days()) { const k = ymd(d); const x = slotsFor(k, B.svc, B.master); if (x.length && k > B.date) { nd = k; nt = x[0]; break; } }
      el.innerHTML = `<div class="empty">В этот день мест нет.${nd ? ` Ближайшее свободное: <button data-act="jump" data-d="${nd}" data-t="${nt}">${niceDate(nd)}, ${nt}</button>` : ''}</div>`;
      return;
    }
    el.innerHTML = sl.map(t => `<button class="slot press ${t === B.time ? 'sel' : ''}" data-act="slot" data-t="${t}">${t}</button>`).join('');
  }
  function masterName(id) { return id === 'any' || !id ? 'Любой свободный' : ((C.staff || []).find(m => m.id === id) || {}).name || 'Мастер'; }
  function valid3() { const ok = B.name.trim().length > 1 && B.phone.replace(/\D/g, '').length === 12; const b = $('#b3'); if (b) b.disabled = !ok; }
  function maskPhone(el) {
    let d = el.value.replace(/\D/g, ''); if (!d.startsWith('375')) d = '375' + d.replace(/^3?7?5?/, ''); d = d.slice(0, 12);
    const p = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)];
    el.value = '+' + p[0] + (p[1] ? ' ' + p[1] : '') + (p[2] ? ' ' + p[2] : '') + (p[3] ? '-' + p[3] : '') + (p[4] ? '-' + p[4] : ''); B.phone = el.value;
  }
  function confirmB() {
    const v = store.get();
    if (v.some(x => x.date === B.date && x.time === B.time)) { toast('Это время только что заняли — выберите другое'); B.step = 2; B.time = null; render(); return; }
    v.push({ id: Date.now(), svc: B.svc.id, svcName: B.svc.name, price: B.svc.price, from: B.svc.from, min: B.svc.min, date: B.date, time: B.time, name: B.name, phone: B.phone, refs: [...INSPO], master: B.master, masterName: (C.staff || []).length ? masterName(B.master) : '' });
    SEL.clear(); syncSel();
    store.set(v); B.step = 5; render(); renderQuick();
  }
  $('#sheet').addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'svc') { // выбор без перерисовки — список не прыгает
      const id = t.dataset.id; B.ids = B.ids.includes(id) ? B.ids.filter(x => x !== id) : [...B.ids, id];
      const on = B.ids.includes(id); t.classList.toggle('sel', on); t.querySelector('.tick').textContent = on ? '✓' : '';
      const cs = comboOf(B.ids); const b1 = $('#b1'); b1.disabled = !cs; b1.textContent = cs ? `Далее · ${cs.count} ${plural(cs.count)} · ${price(cs)}` : 'Выберите услугу';
      return;
    }
    if (a === 'next') { if (B.step === 1) { B.svc = comboOf(B.ids); B.date = firstDay(B.svc); B.time = null; } B.step++; render(); }
    if (a === 'back') { B.step--; render(); }
    if (a === 'day') { B.date = t.dataset.d; B.time = null; render(); }
    if (a === 'master') { B.master = t.dataset.id; B.time = null; if (!slotsFor(B.date, B.svc, B.master).length) B.date = firstDay(B.svc, B.master); const st = $('#sh-body').scrollTop; render(); $('#sh-body').scrollTop = st; }
    if (a === 'slot') { B.time = t.dataset.t; renderSlots(); $('#b2').disabled = false; }
    if (a === 'jump') { B.date = t.dataset.d; B.time = t.dataset.t; render(); }
    if (a === 'confirm') confirmB();
    if (a === 'visits') { closeBooking(); go('visits'); }
    if (a === 'close') closeBooking();
  });
  $('#sh-close').onclick = closeBooking; $('#scrim').onclick = closeBooking;
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeBooking(); $('#lb').classList.remove('on'); } });

  /* ---------- visits ---------- */
  function renderVisits() {
    const v = store.get().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $('#v-visits').innerHTML = `<h1 style="font-size:36px;margin-top:20px">Мои записи</h1><p class="lead" style="margin-bottom:18px">Записи хранятся на этом устройстве.</p>` +
      (v.length ? v.map(x => { const s = visitSvc(x); return `<div class="visit"><div class="t">${esc(s.name)}</div><div class="m tnum">${niceDate(x.date)} в ${x.time} · ${price(s)}${x.masterName ? ' · ' + esc(x.masterName) : ''} · ${esc(C.address || '')}</div>
        <div class="two"><button class="btn btn-ghost press" style="height:46px" data-move="${x.id}">Перенести</button><button class="btn btn-ghost press" style="height:46px" data-cancel="${x.id}">Отменить</button></div></div>`; }).join('')
        : `<div class="visit"><div class="t">Пока нет записей</div><div class="m">Выберите время — это займёт меньше минуты.</div><button class="btn btn-accent press" data-book="">Записаться</button></div>`);
  }
  $('#v-visits').addEventListener('click', e => {
    const c = e.target.closest('[data-cancel]'), m = e.target.closest('[data-move]');
    if (c) { store.set(store.get().filter(x => x.id != c.dataset.cancel)); renderVisits(); renderQuick(); toast('Запись отменена'); }
    if (m) { const x = store.get().find(y => y.id == m.dataset.move); store.set(store.get().filter(y => y.id != m.dataset.move)); renderVisits(); openBooking(x.svc); }
  });

  /* ---------- cabinet (demo) ---------- */
  const cab = { d: new Date(), mode: 'day' };
  function renderCab() {
    const from = new Date(cab.d); from.setHours(12, 0, 0, 0);
    const n = cab.mode === 'week' ? 7 : 1; const range = [];
    for (let i = 0; i < n; i++) { const d = new Date(from); d.setDate(from.getDate() + i); range.push(ymd(d)); }
    const v = store.get().filter(x => range.includes(x.date)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const sum = v.reduce((a, x) => a + (visitSvc(x).price || 0), 0);
    const free = range.reduce((a, d) => a + slotsFor(d, SERVICES[0] || { min: 60 }).length, 0);
    $('#v-cabinet').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:18px">
        <div><h1 style="font-size:36px;margin:0">Расписание</h1><div class="lead">${esc(C.name)} · демо-кабинет</div></div>
        <a class="icon-btn press" href="./" aria-label="Открыть сайт для клиентов" title="Сайт для клиентов" style="text-decoration:none">↗</a></div>
      <label>Дата</label>
      <div class="datebar"><button class="icon-btn press" data-cab="-1">‹</button><div class="mid tnum">${cab.mode === 'week' ? `${niceDate(range[0])} — ${niceDate(range[6])}` : `${niceDate(range[0])}, ${WD[parseYmd(range[0]).getDay()]}`}</div><button class="icon-btn press" data-cab="1">›</button></div>
      <div class="seg"><button class="${cab.mode === 'day' ? 'on' : ''}" data-mode="day">День</button><button class="${cab.mode === 'week' ? 'on' : ''}" data-mode="week">Неделя</button></div>
      <div class="metrics">
        <div class="tile"><div class="k">Записи</div><div class="v tnum">${v.length}</div></div>
        <div class="tile"><div class="k">Свободно</div><div class="v tnum">${free}</div></div>
        <div class="tile"><div class="k">BYN</div><div class="v tnum">${sum}</div></div></div>
      <div class="actions">
        <button class="pri press" data-book="">+ Добавить запись</button>
        <button class="press" data-soon="Часы работы">Часы работы</button>
        <button class="press" data-soon="Услуги и цены">Услуги и цены</button>
        <button class="press" data-soon="Перерыв / выходной">Перерыв</button>
        <button class="press" data-soon="Фото работ">Фото работ</button>
        <button class="press" data-soon="Клиенты">Клиенты</button></div>
      <div class="sec timeline"><h2 style="margin-bottom:12px">Визиты</h2>${v.length ? v.map(x => { const s = visitSvc(x); return `<div class="visit"><div class="t tnum">${x.time} · ${esc(s.name)}</div><div class="m tnum">${niceDate(x.date)}${x.masterName ? ' · ' + esc(x.masterName) : ''} · ${esc(x.name)} · ${esc(x.phone)} · ${price(s)}</div></div>`; }).join('') : '<p class="lead">Визитов нет. Запишитесь сами через «+ Добавить запись», чтобы увидеть, как это выглядит у мастера.</p>'}</div>`;
  }
  $('#v-cabinet').addEventListener('click', e => {
    const t = e.target.closest('[data-cab],[data-mode],[data-soon]'); if (!t) return;
    if (t.dataset.cab) { cab.d.setDate(cab.d.getDate() + (cab.mode === 'week' ? 7 : 1) * Number(t.dataset.cab)); renderCab(); }
    if (t.dataset.mode) { cab.mode = t.dataset.mode; renderCab(); }
    if (t.dataset.soon) toast(`«${t.dataset.soon}» — настраивается в полной версии`);
  });

  /* ---------- global clicks ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-book]');
    if (b && !b.closest('#sheet')) { openBooking(b.dataset.book || null, b.dataset.date, b.dataset.time); return; }
    const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
    const n = e.target.closest('[data-nav]'); if (n) { if (n.dataset.nav === 'services') { theme.layout === 'studio' ? openBooking(null) : go('home', 'services'); } else go(n.dataset.nav); return; }
    const c = e.target.closest('[data-cat]'); if (c) { $$('.cat').forEach(x => x.classList.toggle('on', x === c)); renderServices(c.dataset.cat); return; }
    const sw = e.target.closest('.sw'); if (sw) { $$('.sw').forEach(x => x.classList.toggle('on', x === sw)); setAccent(sw.dataset.hex); toast(`Оттенок «${sw.textContent.trim()}» — сохраним в заметке к записи`); return; }
    const w = e.target.closest('[data-lb]'); if (w) { const g2 = C.gallery[+w.dataset.lb]; $('#lb-img').src = g2.src; $('#lb-cap').textContent = (g2.caption || '') + (g2.kind === 'ai' ? ' · иллюстрация' : ''); $('#lb').classList.add('on'); return; }
    if (e.target.id === 'pwa-btn') { deferredPrompt ? (deferredPrompt.prompt(), deferredPrompt = null) : toast(/iPhone|iPad/.test(navigator.userAgent) ? 'Поделиться → «На экран Домой»' : 'Меню браузера → «Установить приложение»'); }
  });
  $('#lb-close').onclick = () => $('#lb').classList.remove('on');
  $('#lb').onclick = e => { if (e.target.id === 'lb') $('#lb').classList.remove('on'); };
  let deferredPrompt = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });

  /* ---------- scroll effects ---------- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let io;
  function observeReveals() {
    if (reduce || !('IntersectionObserver' in window)) { $$('.reveal').forEach(el => el.classList.add('in')); return; }
    io = io || new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY; $('#top').classList.toggle('scrolled', y > 10);
      const max = document.documentElement.scrollHeight - innerHeight; $('#progress').style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      if (!reduce) {
        const hero = $('#hero'), img = $('#hero-img');
        if (hero && $('#v-home').classList.contains('on')) { const p = Math.min(1, y / 520); hero.style.transform = `scale(${1 - p * .08})`; hero.style.borderRadius = `${30 + p * 10}px`; if (img) img.style.transform = `scale(${1.06 - p * .06}) translateY(${p * 30}px)`; }
      }
      const works = $('#works'); if (works && $('#wcount')) { const i = Math.round(works.scrollLeft / (works.firstElementChild.offsetWidth + 10)); $('#wcount').textContent = `${pad(i + 1)} / ${pad(works.children.length)}`; }
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', e => { if (e.target.id === 'works') onScroll(); }, { passive: true, capture: true });

  /* ---------- init ---------- */
  $('#mono').textContent = (C.monogram || C.name || '').slice(0, 2);
  $('#brand-name').textContent = C.name || '';
  renderHome(); observeReveals(); onScroll();
  // Кабинет руководителя открывается только по своей ссылке: /owner/ (→ #owner)
  if (location.hash === '#owner') { document.title = `Кабинет — ${C.name || ''}`; go('cabinet'); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
