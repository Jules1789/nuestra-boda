/* Plano de mesas: solo visible para los organizadores. */
(function () {
  'use strict';
  const B = window.Boda;
  const { $, $$, esc, norm, partySize, memberName, initials, hueOf, STATUS_LABEL } = B;
  const A = () => window.Admin;
  const st = () => A().state;
  const plan = () => st().plan;
  const guests = () => st().guests;

  const SEAT_R = 13;
  const SNAP_DEG = 8;
  const PREF_KEY = 'boda_plano_prefs';

  let root, stage, svg, world, listBox, panelEl;
  let mounted = false, visible = false, fittedOnce = false;
  let view = { s: 1, tx: 0, ty: 0 };
  let mode = 'sentar';
  let selection = new Set();        // claves "idInvitado#n" seleccionadas
  let moveMsg = '';                 // texto para la barra de selección
  let selTable = null;
  let panel = { type: 'home' };
  let homeTab = 'sin';
  let sinFilter = 'all', sinSearch = '', pickSearch = '';
  let expanded = new Set();
  let listView = false;
  let showNames = false;
  const undoStack = [], redoStack = [];

  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); showNames = !!p.names; } catch (e) { /* nada */ }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ names: showNames })); } catch (e) { /* nada */ } }

  /* ====================== Modelo ====================== */
  const table = (id) => plan().tables.find((t) => t.id === id);
  const items = () => (plan().items = Array.isArray(plan().items) ? plan().items : []);
  const item = (id) => items().find((x) => x.id === id);
  const obj = (id) => table(id) || item(id);     // mesa o elemento (para mover y girar)

  // Elementos del salón: áreas, paredes, ventanas, entrada, baños, sonido, meseros, chimenea…
  const ITEM_KINDS = {
    area: { name: 'Área', icon: '⬚', w: 420, h: 280, desc: 'Delimita una zona (salón, terraza, jardín…)' },
    wall: { name: 'Pared', icon: '▬', w: 300, h: 10, desc: 'Muro: ajusta el largo y gíralo' },
    window: { name: 'Ventana', icon: '🪟', w: 160, h: 10, desc: 'Ventana en la pared' },
    door: { name: 'Entrada', icon: '🚪', w: 90, h: 18, desc: 'Puerta de acceso de los invitados' },
    bath: { name: 'Baños', icon: '🚻', w: 110, h: 80, desc: 'Puerta de los baños' },
    sound: { name: 'Sonido / DJ', icon: '🔊', w: 120, h: 80, desc: 'Cabina de sonido o grupo' },
    waiters: { name: 'Meseros', icon: '🍽️', w: 120, h: 70, desc: 'Por dónde sale el servicio' },
    fireplace: { name: 'Chimenea', icon: '🔥', w: 120, h: 60, desc: 'Chimenea del lugar' },
    dance: { name: 'Pista de baile', icon: '💃', w: 260, h: 200, desc: 'Zona de baile' },
    bar: { name: 'Barra', icon: '🍸', w: 160, h: 60, desc: 'Barra de bebidas' },
    cake: { name: 'Pastel', icon: '🎂', w: 80, h: 80, desc: 'Mesa del pastel' },
    other: { name: 'Otro', icon: '📌', w: 100, h: 70, desc: 'Cualquier otra cosa' }
  };
  const itemExt = (it) => Math.hypot((it.w || 100) / 2, (it.h || 60) / 2);
  const guestById = (id) => guests().find((g) => g.id === id);
  const keyGuest = (k) => guestById(k.split('#')[0]);
  const keyIdx = (k) => parseInt(k.split('#')[1], 10) || 0;
  function keyName(k) { const g = keyGuest(k); return g ? memberName(g, keyIdx(k)) : '¿?'; }
  function keyLabel(k) {
    const g = keyGuest(k); if (!g) return '?';
    const i = keyIdx(k);
    const nm = memberName(g, i);
    if (i > 0 && /^acompa[nñ]ante/i.test(nm)) return '+' + i;
    return initials(nm);
  }
  const colorOf = (g) => 'hsl(' + hueOf((g && (g.group || g.id)) || 'x') + ' 48% 54%)';

  function occupancy() {
    const o = {};
    plan().tables.forEach((t) => { o[t.id] = new Array(Math.max(0, t.seats | 0)).fill(null); });
    Object.entries(plan().seats).forEach(([k, a]) => { const arr = o[a.t]; if (arr && a.s < arr.length && !arr[a.s]) arr[a.s] = k; });
    return o;
  }

  // Limpia asignaciones imposibles (mesa borrada, asiento inexistente, invitado eliminado, duplicados)
  function sanitize() {
    if (!guests()) return false;
    const seen = new Set();
    let changed = false;
    Object.entries(plan().seats).forEach(([k, a]) => {
      const t = table(a.t);
      const slot = a.t + ':' + a.s;
      if (!t || a.s >= t.seats || a.s < 0 || seen.has(slot) || !keyGuest(k)) { delete plan().seats[k]; changed = true; return; }
      seen.add(slot);
    });
    return changed;
  }

  function unseatedGroups() {
    const seats = plan().seats;
    const out = [];
    guests().forEach((g) => {
      // Solo quienes asistirán (las casillas marcadas); la clave usa su posición en la familia
      const idx = B.attendingIdx(g);
      const n = idx.length;
      if (!n) return;
      const keys = idx.map((i) => g.id + '#' + i).filter((k) => !seats[k]);
      if (keys.length) out.push({ g, keys, total: n, partial: keys.length < n });
    });
    return out;
  }

  function tablesOfKeys(keys) {
    return Array.from(new Set(keys.map((k) => { const a = plan().seats[k]; const t = a && table(a.t); return t ? t.name : null; }).filter(Boolean))).join(', ');
  }

  function computeAlerts() {
    const byKey = {}, list = [];
    const byGuest = {};
    Object.keys(plan().seats).forEach((k) => { (byGuest[k.split('#')[0]] = byGuest[k.split('#')[0]] || []).push(k); });
    guests().forEach((g) => {
      const idx = B.attendingIdx(g);
      const n = idx.length;
      const assigned = byGuest[g.id] || [];
      let had = false;
      if (g.status === 'no' && assigned.length) {
        assigned.forEach((k) => { byKey[k] = 'no'; });
        list.push({ type: 'no', g, keys: assigned, text: '<b>' + esc(g.name) + '</b> avisó que <b>no viene</b> y ocupa ' + assigned.length + (assigned.length > 1 ? ' sillas' : ' silla') + ' en ' + esc(tablesOfKeys(assigned)) + '.' });
        had = true;
      } else if (assigned.length) {
        const extra = assigned.filter((k) => !idx.includes(keyIdx(k)));
        if (extra.length) {
          extra.forEach((k) => { byKey[k] = 'sobra'; });
          list.push({ type: 'sobra', g, keys: extra, text: '<b>' + esc(g.name) + '</b>: ya no vienen ' + esc(extra.map(keyName).join(', ')) + '. ' + (extra.length > 1 ? 'Sobran ' + extra.length + ' sillas' : 'Sobra 1 silla') + ' en ' + esc(tablesOfKeys(extra)) + '.' });
          had = true;
        }
        const missing = [];
        idx.forEach((i) => { const k = g.id + '#' + i; if (!plan().seats[k]) missing.push(k); });
        if (missing.length) {
          list.push({ type: 'falta', g, keys: missing, text: '<b>' + esc(g.name) + '</b> viene con ' + n + ': ' + (missing.length > 1 ? 'faltan ' + missing.length + ' sillas' : 'falta 1 silla') + ' para su grupo (está en ' + esc(tablesOfKeys(assigned)) + ').' });
          had = true;
        }
      }
      if (g.change && !had) list.push({ type: 'info', g, keys: [], text: '<b>' + esc(g.name) + '</b> cambió su respuesta. ' + esc(g.change) });
      else if (g.change && had) list[list.length - 1].change = g.change;
    });
    return { byKey, list };
  }

  /* ====================== Deshacer ====================== */
  function snapshot() { return JSON.stringify({ tables: plan().tables, seats: plan().seats, items: items() }); }
  function restore(s) { const o = JSON.parse(s); plan().tables = o.tables; plan().seats = o.seats; plan().items = o.items || []; }
  function pushUndo(snap) { undoStack.push(snap || snapshot()); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; }
  function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); commit(false); B.toast('Deshecho ↶', 'info', 1400); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); commit(false); B.toast('Rehecho ↷', 'info', 1400); }

  function commit() {
    A().savePlan();
    renderAll();
  }

  /* ====================== Geometría ====================== */
  function geom(t) {
    const n = Math.max(1, t.seats | 0);
    const sp = 34;
    if (t.shape === 'rect') {
      const top = Math.ceil(n / 2), bot = n - top;
      const w = Math.max(top, 1) * sp + 18, h = 66;
      const seats = [];
      for (let i = 0; i < top; i++) seats.push({ x: -(top - 1) * sp / 2 + i * sp, y: -h / 2 - 19, ox: 0, oy: -1 });
      for (let j = bot - 1; j >= 0; j--) seats.push({ x: -(bot - 1) * sp / 2 + j * sp, y: h / 2 + 19, ox: 0, oy: 1 });
      return { kind: 'rect', w, h, seats, ext: Math.hypot(w / 2, h / 2 + 32) };
    }
    if (t.shape === 'novios') {
      const sp2 = 28;
      const w = Math.max(n * sp2 + 12, 66), h = 36;
      const seats = [];
      for (let i = 0; i < n; i++) seats.push({ x: -(n - 1) * sp2 / 2 + i * sp2, y: -h / 2 - 17, ox: 0, oy: -1 });
      return { kind: 'novios', w, h, seats, ext: Math.hypot(w / 2, h / 2 + 30) };
    }
    if (t.shape === 'presidential') {
      const w = n * sp + 24, h = 48;
      const seats = [];
      for (let i = 0; i < n; i++) seats.push({ x: -(n - 1) * sp / 2 + i * sp, y: -h / 2 - 19, ox: 0, oy: -1 });
      return { kind: 'presidential', w, h, seats, ext: Math.hypot(w / 2, h / 2 + 32) };
    }
    const r = Math.max(30, n * 5.6);
    const R = r + 20;
    const seats = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      seats.push({ x: R * Math.cos(a), y: R * Math.sin(a), ox: Math.cos(a), oy: Math.sin(a) });
    }
    return { kind: 'round', r, seats, ext: R + SEAT_R };
  }

  function bbox(tables, withItems = true) {
    const its = withItems ? items() : [];
    if (!tables.length && !its.length) return { x: -300, y: -200, w: 600, h: 400 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    tables.forEach((t) => { const e = geom(t).ext + (showNames ? 30 : 6); x0 = Math.min(x0, t.x - e); y0 = Math.min(y0, t.y - e); x1 = Math.max(x1, t.x + e); y1 = Math.max(y1, t.y + e); });
    its.forEach((it) => { const e = itemExt(it) + 20; x0 = Math.min(x0, it.x - e); y0 = Math.min(y0, it.y - e); x1 = Math.max(x1, it.x + e); y1 = Math.max(y1, it.y + e); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ====================== Dibujo SVG ====================== */
  function tablesMarkup(opts = {}) {
    const occ = occupancy();
    const { byKey } = computeAlerts();
    const need = selection.size;
    const names = opts.names != null ? opts.names : showNames;
    let html = '';
    plan().tables.forEach((t) => {
      const g = geom(t);
      const rot = t.rot || 0;
      const arr = occ[t.id] || [];
      const selKeysHere = arr.filter((k) => k && selection.has(k)).length;
      const used = arr.filter(Boolean).length;
      const free = t.seats - used + selKeysHere;
      let cls = 'tbl';
      if (!opts.export) {
        if (selTable === t.id) cls += ' selected';
        if (need && mode === 'sentar') cls += free >= need ? ' fits' : ' nofit';
      }
      html += '<g class="' + cls + '" data-table="' + t.id + '" data-obj="' + t.id + '" transform="translate(' + t.x + ' ' + t.y + ') rotate(' + rot + ')">';
      if (g.kind === 'round') html += '<circle class="tshape" r="' + g.r + '"/>';
      else html += '<rect class="tshape" x="' + (-g.w / 2) + '" y="' + (-g.h / 2) + '" width="' + g.w + '" height="' + g.h + '" rx="' + (g.kind === 'presidential' ? 4 : g.kind === 'novios' ? 10 : 8) + '"/>' + (g.kind === 'novios' ? '<text class="heart" y="2">♥</text>' : '');
      g.seats.forEach((p, i) => {
        const k = arr[i];
        const gu = k && keyGuest(k);
        const flag = k && byKey[k];
        let c = 'seat ' + (k ? 'taken' : 'free');
        if (flag === 'no') c += ' flag'; else if (flag === 'sobra') c += ' flag-sobra';
        if (!opts.export && k && selection.has(k)) c += ' picked';
        html += '<g class="' + c + '" data-table="' + t.id + '" data-seat="' + i + '" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')">' +
          '<title>' + esc(k ? keyName(k) + (gu ? ' · ' + gu.name : '') : t.name + ' · asiento ' + (i + 1) + ' libre') + '</title>' +
          '<circle r="' + SEAT_R + '"' + (gu ? ' style="fill:' + colorOf(gu) + ';stroke:#fff"' : '') + '/>' +
          (k ? '<text class="ini" transform="rotate(' + (-rot) + ')">' + esc(keyLabel(k)) + '</text>' : '<text class="ini" style="fill:#c9b691" transform="rotate(' + (-rot) + ')">' + (i + 1) + '</text>') +
          (flag ? '<circle class="flagdot" cx="9" cy="-9" r="4.5"/>' : '') + '</g>';
        if (names && k) {
          const d = SEAT_R + 12;
          // posición exterior en coordenadas de la mesa, texto siempre derecho
          html += '<text class="nm" transform="translate(' + (p.x + p.ox * d).toFixed(1) + ' ' + (p.y + p.oy * d).toFixed(1) + ') rotate(' + (-rot) + ')">' + esc(shortName(keyName(k))) + '</text>';
        }
      });
      // Etiqueta central
      let countTxt = used + '/' + t.seats, countCls = 'tcount' + (used >= t.seats ? ' full' : '');
      if (!opts.export && need && mode === 'sentar') {
        countTxt = free >= need ? '✓ cabe · ' + free + ' libres' : '✗ faltan ' + (need - free);
        countCls = 'tcount' + (free >= need ? ' full' : ' over');
      }
      if (g.kind === 'novios') html += '<g transform="rotate(' + (-rot) + ')"><text class="tname small" y="' + (g.h / 2 + 14) + '">' + esc(t.name) + '</text></g>';
      else html += '<g transform="rotate(' + (-rot) + ')"><text class="tname" y="-7">' + esc(t.name) + '</text><text class="' + countCls + '" y="9">' + countTxt + '</text></g>';
      if (!opts.export && mode === 'organizar' && selTable === t.id) {
        const hy = -(g.ext + 28);
        html += '<g class="handle" data-handle="' + t.id + '"><line x1="0" y1="' + (-g.ext + 6) + '" x2="0" y2="' + hy + '"/><circle cx="0" cy="' + hy + '" r="13"/><text x="0" y="' + hy + '" transform="rotate(' + (-rot) + ' 0 ' + hy + ')">↻</text></g>';
      }
      html += '</g>';
    });
    return html;
  }

  function itemsMarkup(opts = {}) {
    // Primero las áreas (al fondo), luego paredes/ventanas y al final lo demás
    const order = { area: 0, dance: 1, wall: 2, window: 2 };
    return items().slice().sort((a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3)).map((it) => {
      const k = ITEM_KINDS[it.kind] || ITEM_KINDS.other;
      const w = it.w || k.w, h = it.h || k.h, rot = it.rot || 0;
      const label = it.label != null && it.label !== '' ? it.label : k.name;
      const sel = !opts.export && selTable === it.id ? ' selected' : '';
      let body = '';
      if (it.kind === 'area') {
        body = '<rect class="i-area" x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="6"/>' +
          '<g transform="rotate(' + (-rot) + ')"><text class="i-area-lbl" y="' + (-h / 2 + 18) + '">' + esc(label) + '</text></g>';
      } else if (it.kind === 'wall') {
        body = '<rect class="i-wall" x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '"/>';
      } else if (it.kind === 'window') {
        body = '<rect class="i-window" x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '"/>' +
          '<line class="i-window-line" x1="' + (-w / 2) + '" y1="0" x2="' + (w / 2) + '" y2="0"/>';
      } else if (it.kind === 'door') {
        // Hueco de la puerta con su abatimiento
        body = '<rect class="i-door" x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '"/>' +
          '<path class="i-door-arc" d="M' + (-w / 2) + ' ' + (h / 2) + ' A ' + w + ' ' + w + ' 0 0 0 ' + (w / 2) + ' ' + (h / 2 - w) + ' L ' + (-w / 2) + ' ' + (h / 2 - w) + '"/>' +
          '<g transform="rotate(' + (-rot) + ')"><text class="i-lbl" y="' + (h / 2 + 16) + '">🚪 ' + esc(label) + '</text></g>';
      } else {
        body = '<rect class="i-box i-' + esc(it.kind) + '" x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="10"/>' +
          '<g transform="rotate(' + (-rot) + ')"><text class="i-ico" y="' + (h > 50 ? -8 : 0) + '">' + k.icon + '</text>' +
          (h > 50 ? '<text class="i-lbl" y="16">' + esc(label) + '</text>' : '') + '</g>';
      }
      let handle = '';
      if (!opts.export && mode === 'organizar' && selTable === it.id) {
        const hy = -(h / 2 + 30);
        handle = '<g class="handle" data-handle="' + it.id + '"><line x1="0" y1="' + (-h / 2) + '" x2="0" y2="' + hy + '"/><circle cx="0" cy="' + hy + '" r="13"/><text x="0" y="' + hy + '" transform="rotate(' + (-rot) + ' 0 ' + hy + ')">↻</text></g>';
      }
      return '<g class="itm' + sel + '" data-item="' + it.id + '" data-obj="' + it.id + '" transform="translate(' + it.x + ' ' + it.y + ') rotate(' + rot + ')"><title>' + esc(label) + '</title>' + body + handle + '</g>';
    }).join('');
  }

  function shortName(n) {
    const p = String(n).replace(/\(.*?\)/g, '').trim().split(/\s+/);
    if (/^acompa/i.test(n)) return 'Acomp. ' + (p[p.length - 1] || '');
    return p.length > 1 ? p[0] + ' ' + p[1][0] + '.' : p[0];
  }

  function applyView() { world.setAttribute('transform', 'translate(' + view.tx + ' ' + view.ty + ') scale(' + view.s + ')'); }

  function render() {
    if (!mounted) return;
    world.innerHTML = itemsMarkup() + tablesMarkup();
    applyView();
    stage.classList.toggle('organize', mode === 'organizar');
  }

  function fit() {
    const r = stage.getBoundingClientRect();
    if (r.width < 10) return;
    const b = bbox(plan().tables);
    const s = Math.max(0.2, Math.min(1.6, Math.min(r.width / b.w, r.height / b.h) * 0.9));
    view.s = s;
    view.tx = r.width / 2 - (b.x + b.w / 2) * s;
    view.ty = r.height / 2 - (b.y + b.h / 2) * s;
    applyView();
  }

  function centerOn(t) {
    const r = stage.getBoundingClientRect();
    if (r.width < 10) return;
    view.s = Math.max(view.s, 1);
    view.tx = r.width / 2 - t.x * view.s;
    view.ty = r.height / 2 - t.y * view.s;
    applyView();
  }

  function zoomAt(cx, cy, f) {
    const r = svg.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const ns = Math.max(0.15, Math.min(4, view.s * f));
    view.tx = px - (px - view.tx) * (ns / view.s);
    view.ty = py - (py - view.ty) * (ns / view.s);
    view.s = ns;
    applyView();
  }

  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - view.tx) / view.s, y: (cy - r.top - view.ty) / view.s };
  }

  function snapAngle(a) {
    a = ((Math.round(a) % 360) + 360) % 360;
    const near = Math.round(a / 45) * 45;
    return Math.abs(a - near) <= SNAP_DEG ? near % 360 : a;
  }

  /* ====================== Gestos (ratón y dedos) ====================== */
  const ptrs = new Map();
  let gest = null;

  function hitTest(el) {
    const h = el.closest && el.closest('[data-handle]');
    if (h) return { kind: 'handle', tid: h.getAttribute('data-handle') };
    const s = el.closest && el.closest('[data-seat]');
    if (s) return { kind: 'seat', tid: s.getAttribute('data-table'), seat: +s.getAttribute('data-seat') };
    const t = el.closest && el.closest('[data-table]');
    if (t) return { kind: 'table', tid: t.getAttribute('data-table') };
    const it = el.closest && el.closest('[data-item]');
    if (it) return { kind: 'item', tid: it.getAttribute('data-item') };
    return { kind: 'bg' };
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function setupGestures() {
    svg.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        const hit = hitTest(e.target);
        gest = { type: 'pan', start: { x: e.clientX, y: e.clientY }, moved: false, hit, tx: view.tx, ty: view.ty };
        if (mode === 'organizar' && hit.tid) {
          const t = obj(hit.tid);
          if (hit.kind === 'handle') { gest.type = 'rotate'; gest.tid = t.id; gest.snap = snapshot(); }
          else { const w = toWorld(e.clientX, e.clientY); gest.type = 'drag'; gest.tid = t.id; gest.off = { x: w.x - t.x, y: w.y - t.y }; gest.snap = snapshot(); }
        }
        svg.classList.add('grabbing');
      } else if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        if (gest && mode === 'organizar' && gest.tid && (gest.type === 'drag' || gest.type === 'rotate')) {
          const t = obj(gest.tid);
          gest = { type: 'rotate2', tid: t.id, a0: ang(a, b), r0: t.rot || 0, snap: gest.snap, moved: true };
        } else {
          const m = mid(a, b);
          gest = { type: 'pinch', d0: dist(a, b) || 1, s0: view.s, w0: toWorld(m.x, m.y), moved: true };
        }
      }
    });

    svg.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId) || !gest) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = { x: e.clientX, y: e.clientY };
      if (gest.start && !gest.moved && dist(p, gest.start) > 7) gest.moved = true;
      if (!gest.moved) return;
      if (gest.type === 'pan' || gest.type === 'pinch') fittedOnce = true;
      switch (gest.type) {
        case 'pan':
          view.tx = gest.tx + (p.x - gest.start.x);
          view.ty = gest.ty + (p.y - gest.start.y);
          applyView();
          break;
        case 'drag': {
          const t = obj(gest.tid); const w = toWorld(p.x, p.y);
          t.x = Math.round((w.x - gest.off.x) / 10) * 10;
          t.y = Math.round((w.y - gest.off.y) / 10) * 10;
          const el = world.querySelector('[data-obj="' + t.id + '"]');
          if (el) el.setAttribute('transform', 'translate(' + t.x + ' ' + t.y + ') rotate(' + (t.rot || 0) + ')');
          break;
        }
        case 'rotate': {
          const t = obj(gest.tid); const w = toWorld(p.x, p.y);
          t.rot = snapAngle(Math.atan2(w.y - t.y, w.x - t.x) * 180 / Math.PI + 90);
          render(); hint('Giro: ' + t.rot + '°' + (t.rot % 45 === 0 ? ' (encajada)' : ''));
          break;
        }
        case 'rotate2': {
          if (ptrs.size < 2) break;
          const [a, b] = Array.from(ptrs.values());
          const t = obj(gest.tid);
          t.rot = snapAngle(gest.r0 + (ang(a, b) - gest.a0));
          render(); hint('Giro: ' + t.rot + '°' + (t.rot % 45 === 0 ? ' (encajada)' : ''));
          break;
        }
        case 'pinch': {
          if (ptrs.size < 2) break;
          const [a, b] = Array.from(ptrs.values());
          const m = mid(a, b);
          const r = svg.getBoundingClientRect();
          const ns = Math.max(0.15, Math.min(4, gest.s0 * dist(a, b) / gest.d0));
          view.s = ns;
          view.tx = (m.x - r.left) - gest.w0.x * ns;
          view.ty = (m.y - r.top) - gest.w0.y * ns;
          applyView();
          break;
        }
      }
    });

    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (!gest) return;
      if (ptrs.size === 0) {
        svg.classList.remove('grabbing');
        const g = gest; gest = null;
        if (!g.moved && e.type === 'pointerup' && g.hit) onTap(g.hit);
        else if (g.moved && g.snap && ['drag', 'rotate', 'rotate2'].includes(g.type)) {
          if (g.snap !== snapshot()) { pushUndo(g.snap); commit(); }
          hint();
        }
      } else if (ptrs.size === 1) {
        const p = Array.from(ptrs.values())[0];
        if (gest.type === 'rotate2') {
          if (gest.snap !== snapshot()) { pushUndo(gest.snap); commit(); }
          gest = { type: 'none', moved: true };
        } else {
          gest = { type: 'pan', start: p, moved: true, tx: view.tx, ty: view.ty };
        }
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); fittedOnce = true; zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
    // Safari (iOS) envía gestos propios: los anulamos para que no haga zoom a la página
    ['gesturestart', 'gesturechange'].forEach((n) => svg.addEventListener(n, (e) => e.preventDefault()));
  }

  /* ====================== Toques ====================== */
  function onTap(hit) {
    if (hit.kind === 'item' && mode !== 'organizar') hit = { kind: 'bg' };
    if (mode === 'organizar') {
      if (hit.tid && item(hit.tid)) { selTable = hit.tid; openPanel({ type: 'item', id: hit.tid }); }
      else if (hit.tid) { selTable = hit.tid; openPanel({ type: 'table', id: hit.tid }); }
      else { selTable = null; openPanel({ type: 'home' }); }
      return;
    }
    if (hit.kind === 'seat') {
      const occ = occupancy()[hit.tid];
      const k = occ[hit.seat];
      if (selection.size) {
        if (!k) { seatKeys(Array.from(selection), hit.tid, hit.seat); return; }
        if (selection.has(k)) { clearSelection(); return; }
        if (selection.size === 1) {
          const mine = Array.from(selection)[0];
          const myA = plan().seats[mine];
          if (myA) { swap(mine, k); return; }
          B.toast('Ese asiento es de <b>' + esc(keyName(k)) + '</b>. Toca un asiento libre o la mesa.', 'warn');
          return;
        }
        B.toast('Ese asiento está ocupado. Toca un asiento libre o el centro de la mesa.', 'warn');
        return;
      }
      selTable = hit.tid;
      if (k) openPanel({ type: 'member', key: k });
      else openPanel({ type: 'pick', tid: hit.tid, seat: hit.seat });
      return;
    }
    if (hit.kind === 'table') {
      if (selection.size) { seatKeys(Array.from(selection), hit.tid, null); return; }
      selTable = hit.tid;
      openPanel({ type: 'table', id: hit.tid });
      return;
    }
    if (!selection.size) { selTable = null; if (panel.type !== 'home') openPanel({ type: 'home' }); else render(); }
  }

  /* ====================== Sentar / mover ====================== */
  function sortKeys(keys) {
    const order = new Map(guests().map((g, i) => [g.id, i]));
    return keys.slice().sort((a, b) => (order.get(a.split('#')[0]) - order.get(b.split('#')[0])) || (keyIdx(a) - keyIdx(b)));
  }

  function pickSeats(t, free, k, start) {
    const n = t.seats;
    const circ = t.shape !== 'presidential';
    const walk = (st0) => { const out = []; let span = 0; for (let j = 0; j < n && out.length < k; j++) { const s = circ ? (st0 + j) % n : st0 + j; if (s >= n) break; span++; if (free.has(s)) out.push(s); } return { out, span }; };
    if (start != null) {
      const r = walk(start).out;
      for (let s = 0; s < n && r.length < k; s++) if (free.has(s) && !r.includes(s)) r.push(s);
      return r;
    }
    let best = null;
    for (let s0 = 0; s0 < n; s0++) {
      if (!free.has(s0)) continue;
      const r = walk(s0);
      if (r.out.length === k && (!best || r.span < best.span)) best = r;
      if (best && best.span === k) break;
    }
    if (best) return best.out;
    return Array.from(free).sort((a, b) => a - b).slice(0, k);
  }

  function seatKeys(keys, tid, startSeat, opts = {}) {
    const t = table(tid);
    if (!t || !keys.length) return false;
    keys = sortKeys(keys);
    const occ = occupancy()[tid];
    const moving = new Set(keys);
    const free = new Set();
    occ.forEach((k, i) => { if (!k || moving.has(k)) free.add(i); });
    if (free.size < keys.length) {
      if (!opts.silent) {
        B.toast('⚠️ <b>' + esc(t.name) + '</b> tiene ' + free.size + (free.size === 1 ? ' silla libre' : ' sillas libres') + ' y el grupo necesita ' + keys.length + '. <b>Faltan ' + (keys.length - free.size) + '.</b> Elige otra mesa o agranda esta.', 'warn', 5500);
      }
      return false;
    }
    const chosen = pickSeats(t, free, keys.length, startSeat);
    if (!opts.noUndo) pushUndo();
    // primero liberar a los que se mueven para que no choquen
    keys.forEach((k) => { delete plan().seats[k]; });
    keys.forEach((k, i) => { plan().seats[k] = { t: tid, s: chosen[i] }; });
    if (!opts.silent) {
      const left = t.seats - occupancy()[tid].filter(Boolean).length;
      B.toast('✓ ' + (keys.length === 1 ? esc(keyName(keys[0])) : keys.length + ' personas') + ' en <b>' + esc(t.name) + '</b> · quedan ' + left + ' libres', 'ok', 2600);
    }
    selection.clear(); moveMsg = '';
    if (!opts.keepPanel && panel.type === 'pick') openPanel({ type: 'table', id: tid }, true);
    commit();
    return true;
  }

  function swap(a, b) {
    const pa = plan().seats[a], pb = plan().seats[b];
    if (!pa || !pb) return;
    pushUndo();
    plan().seats[a] = pb; plan().seats[b] = pa;
    selection.clear(); moveMsg = '';
    B.toast('Intercambiados ✓ ' + esc(keyName(a)) + ' ⇄ ' + esc(keyName(b)), 'ok', 2200);
    commit();
  }

  function unseat(keys, msg) {
    if (!keys.length) return;
    pushUndo();
    keys.forEach((k) => delete plan().seats[k]);
    selection.clear(); moveMsg = '';
    B.toast(msg || ('Silla liberada ✓'), 'ok', 2200);
    commit();
  }

  function selectKeys(keys, msg) {
    selection = new Set(keys);
    moveMsg = msg || '';
    renderAll();
  }
  function toggleKeys(keys) {
    const allIn = keys.every((k) => selection.has(k));
    keys.forEach((k) => (allIn ? selection.delete(k) : selection.add(k)));
    moveMsg = '';
    renderAll();
  }
  function clearSelection() { selection.clear(); moveMsg = ''; renderAll(); }

  function autoSeat() {
    const groups = unseatedGroups().filter((x) => x.g.status === 'si');
    if (!groups.length) { B.toast('No hay confirmados sin mesa 👌', 'info'); return; }
    if (!plan().tables.length) { B.toast('Primero añade mesas', 'warn'); return; }
    pushUndo();
    let ok = 0, fail = [];
    groups.sort((a, b) => String(a.g.group).localeCompare(String(b.g.group)) || b.keys.length - a.keys.length);
    groups.forEach(({ g, keys }) => {
      const occ = occupancy();
      const freeOf = (t) => occ[t.id].filter((x) => !x).length;
      const sameFam = plan().tables.filter((t) => occ[t.id].some((k) => { const o = k && keyGuest(k); return o && (o.id === g.id || (g.group && o.group === g.group)); }));
      const cands = (sameFam.filter((t) => freeOf(t) >= keys.length).length ? sameFam : plan().tables).filter((t) => freeOf(t) >= keys.length && t.shape !== 'presidential' && t.shape !== 'novios');
      cands.sort((a, b) => freeOf(a) - freeOf(b));
      const t = cands[0];
      if (t && seatKeys(keys, t.id, null, { silent: true, noUndo: true, keepPanel: true })) ok++;
      else fail.push(g.name);
    });
    B.toast('✨ Sentados ' + ok + ' grupos juntos por familia.' + (fail.length ? ' Sin sitio: ' + esc(fail.slice(0, 4).join(', ')) + (fail.length > 4 ? '…' : '') + '. Añade mesas o sillas.' : ''), fail.length ? 'warn' : 'ok', 6000);
    commit();
  }

  /* ====================== Mesas: crear / editar ====================== */
  const SHAPES = [
    ['round', 'Redonda', '<svg width="34" height="34" viewBox="-17 -17 34 34"><circle r="9" fill="none" stroke="currentColor" stroke-width="2"/>' + [0, 1, 2, 3, 4, 5].map((i) => '<circle r="2.6" cx="' + (14 * Math.cos(i * Math.PI / 3)).toFixed(1) + '" cy="' + (14 * Math.sin(i * Math.PI / 3)).toFixed(1) + '" fill="currentColor"/>').join('') + '</svg>'],
    ['rect', 'Rectangular', '<svg width="40" height="34" viewBox="-20 -17 40 34"><rect x="-15" y="-7" width="30" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' + [-10, 0, 10].map((x) => '<circle r="2.6" cx="' + x + '" cy="-12" fill="currentColor"/><circle r="2.6" cx="' + x + '" cy="12" fill="currentColor"/>').join('') + '</svg>'],
    ['presidential', 'Presidencial', '<svg width="44" height="34" viewBox="-22 -17 44 34"><rect x="-20" y="-3" width="40" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' + [-15, -5, 5, 15].map((x) => '<circle r="2.6" cx="' + x + '" cy="-8" fill="currentColor"/>').join('') + '</svg>'],
    ['novios', 'De novios', '<svg width="34" height="34" viewBox="-17 -17 34 34"><rect x="-9" y="-2" width="18" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle r="2.6" cx="-4" cy="-7" fill="currentColor"/><circle r="2.6" cx="4" cy="-7" fill="currentColor"/><text x="0" y="6" font-size="7" text-anchor="middle" fill="currentColor">♥</text></svg>']
  ];
  const DEFAULT_SEATS = { round: 10, rect: 12, presidential: 8, novios: 2 };

  function shapePicker(cur) {
    return '<div class="seg">' + SHAPES.map(([v, l, ic]) => '<label><input type="radio" name="tShape" value="' + v + '"' + (v === cur ? ' checked' : '') + '><span>' + ic + l + '</span></label>').join('') + '</div>';
  }
  function stepper(id, val, min, max) {
    return '<div class="stepper"><button type="button" data-step="-1" data-for="' + id + '">−</button><input id="' + id + '" type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + val + '"><button type="button" data-step="1" data-for="' + id + '">＋</button></div>';
  }
  function wireSteppers(m, onChange) {
    $$('[data-step]', m).forEach((b) => {
      b.onclick = () => {
        const inp = $('#' + b.dataset.for, m);
        const v = Math.max(+inp.min, Math.min(+inp.max, (parseInt(inp.value, 10) || 0) + +b.dataset.step));
        inp.value = v; if (onChange) onChange();
      };
    });
  }

  function nextNumber(prefix) {
    const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\d+)$', 'i');
    let max = 0;
    plan().tables.forEach((t) => { const m = t.name.match(re); if (m) max = Math.max(max, +m[1]); });
    return max + 1;
  }

  function openAddTables() {
    A().openModal(
      '<h3>Añadir mesas</h3>' +
      '<label class="frow"><span>Forma</span>' + shapePicker('round') + '</label>' +
      '<div class="form-grid">' +
      '<label><span>Nombre</span><input id="tName" value="Mesa"></label>' +
      '<label><span>¿Cuántas mesas iguales?</span>' + stepper('tQty', 1, 1, 40) + '</label>' +
      '<label><span>Plazas por mesa</span>' + stepper('tSeats', 10, 1, 40) + '</label>' +
      '</div><p class="muted small" id="tPrev"></p>' +
      '<div class="modal-actions"><button class="btn" id="tCancel">Cancelar</button><button class="btn btn-primary" id="tOk">Añadir</button></div>',
      (m) => {
        let seatsTouched = false;
        const prev = () => {
          const shape = $('input[name=tShape]:checked', m).value;
          const q = +$('#tQty', m).value || 1, s = +$('#tSeats', m).value || 1;
          const base = $('#tName', m).value.trim() || 'Mesa';
          const n0 = nextNumber(base);
          const names = q === 1 && (shape === 'presidential' || shape === 'novios' || !/^mesa$/i.test(base)) && !plan().tables.some((t) => t.name === base) ? [base] : Array.from({ length: q }, (_, i) => base + ' ' + (n0 + i));
          $('#tPrev', m).textContent = 'Se crearán: ' + names.slice(0, 8).join(', ') + (names.length > 8 ? '…' : '') + ' · ' + q * s + ' plazas en total.';
          $('#tOk', m).textContent = 'Añadir ' + q + (q > 1 ? ' mesas' : ' mesa');
          return { shape, q, s, names };
        };
        $$('input[name=tShape]', m).forEach((r) => r.onchange = () => {
          if (!seatsTouched) $('#tSeats', m).value = DEFAULT_SEATS[r.value];
          const nm = $('#tName', m).value.trim();
          const generic = /^(mesa|presidencial|mesa de novios)$/i.test(nm);
          if (generic) $('#tName', m).value = r.value === 'presidential' ? 'Presidencial' : r.value === 'novios' ? 'Mesa de novios' : 'Mesa';
          if (r.value === 'novios') $('#tQty', m).value = 1;
          prev();
        });
        $('#tSeats', m).addEventListener('input', () => { seatsTouched = true; prev(); });
        $('#tQty', m).addEventListener('input', prev);
        $('#tName', m).addEventListener('input', prev);
        wireSteppers(m, () => { seatsTouched = true; prev(); });
        prev();
        $('#tCancel', m).onclick = A().closeModal;
        $('#tOk', m).onclick = () => {
          const { shape, s, names } = prev();
          A().closeModal();
          addTables(names, shape, s);
        };
      });
  }

  function openAddItem() {
    A().openModal('<h3>Agregar al plano</h3><p class="muted small">Elige qué quieres poner. Aparece en el centro de la pantalla; después lo mueves, lo giras y le cambias el tamaño en <b>Organizar</b>.</p>' +
      '<div class="kinds">' + Object.entries(ITEM_KINDS).map(([key, k]) => '<button type="button" class="kind" data-kind="' + key + '"><span>' + k.icon + '</span><b>' + esc(k.name) + '</b><small>' + esc(k.desc) + '</small></button>').join('') + '</div>' +
      '<p class="muted small">¿La <b>mesa de novios</b>? Está en <b>＋ Mesa → De novios</b> (tiene sillas para sentarlos).</p>', (m) => {
      $$('[data-kind]', m).forEach((b) => {
        b.onclick = () => {
          A().closeModal();
          const kind = b.dataset.kind, k = ITEM_KINDS[kind];
          const r = stage.getBoundingClientRect();
          const c = toWorld(r.left + r.width / 2, r.top + r.height / 2);
          pushUndo();
          const it = { id: 'e' + B.newId(), kind, x: Math.round(c.x / 10) * 10, y: Math.round(c.y / 10) * 10, rot: 0, w: k.w, h: k.h, label: '' };
          items().push(it);
          mode = 'organizar';
          selTable = it.id;
          openPanel({ type: 'item', id: it.id }, true);
          commit();
          B.toast(k.icon + ' ' + esc(k.name) + ' agregado. Arrástralo a su lugar.', 'ok', 2500);
        };
      });
    });
  }

  function addTables(names, shape, seats) {
    pushUndo();
    const b = plan().tables.length ? bbox(plan().tables) : { x: -200, y: -150, w: 400, h: 0 };
    const tmp = { shape, seats };
    const cell = geom(tmp).ext * 2 + 50;
    const cols = Math.max(1, Math.min(names.length, Math.ceil(Math.sqrt(names.length * 1.6))));
    const totalW = cols * cell;
    const y0 = plan().tables.length ? b.y + b.h + cell / 2 + 10 : 0;
    const x0 = (plan().tables.length ? b.x + b.w / 2 : 0) - totalW / 2 + cell / 2;
    const created = [];
    names.forEach((name, i) => {
      const t = { id: 't' + B.newId(), name, shape, seats, x: Math.round((x0 + (i % cols) * cell) / 10) * 10, y: Math.round((y0 + Math.floor(i / cols) * cell) / 10) * 10, rot: 0 };
      plan().tables.push(t); created.push(t);
    });
    B.toast('✓ ' + (created.length > 1 ? created.length + ' mesas añadidas' : esc(created[0].name) + ' añadida') + '. Usa <b>Organizar</b> para moverlas.', 'ok', 3500);
    commit();
    fit();
  }

  function openEditTable(tid) {
    const t = table(tid);
    if (!t) return;
    A().openModal(
      '<h3>Editar mesa</h3>' +
      '<label class="frow"><span>Nombre</span><input id="tName" value="' + esc(t.name) + '"></label>' +
      '<label class="frow"><span>Forma</span>' + shapePicker(t.shape) + '</label>' +
      '<label class="frow"><span>Número de plazas</span>' + stepper('tSeats', t.seats, 1, 40) + '</label>' +
      '<div id="tWarn"></div>' +
      '<div class="modal-actions"><button class="btn btn-danger" id="tDel">Eliminar</button><span class="spacer"></span><button class="btn" id="tCancel">Cancelar</button><button class="btn btn-primary" id="tOk">Guardar</button></div>',
      (m) => {
        const warn = () => {
          const n = +$('#tSeats', m).value || 1;
          const lost = lostWithSeats(t, n);
          $('#tWarn', m).innerHTML = lost.length ? '<div class="alert no">⚠️ Con ' + n + ' plazas <b>se quedarían sin silla</b>: ' + lost.map((k) => esc(keyName(k))).join(', ') + '. Pasarán a “Sin mesa”.</div>' : '';
        };
        $('#tSeats', m).addEventListener('input', warn);
        wireSteppers(m, warn);
        warn();
        $('#tCancel', m).onclick = A().closeModal;
        $('#tDel', m).onclick = () => { A().closeModal(); deleteTable(tid); };
        $('#tOk', m).onclick = () => {
          const name = $('#tName', m).value.trim() || t.name;
          const shape = $('input[name=tShape]:checked', m).value;
          const n = Math.max(1, Math.min(40, +$('#tSeats', m).value || 1));
          A().closeModal();
          applyTableEdit(t, name, shape, n);
        };
      });
  }

  // Quién se queda sin silla si la mesa baja a n plazas (se reacomoda a los demás en sillas libres)
  function lostWithSeats(t, n) {
    const occ = occupancy()[t.id] || [];
    const occupants = occ.filter(Boolean);
    if (occupants.length <= n) return [];
    return occ.map((k, i) => (k && i >= n ? k : null)).filter(Boolean).slice(-(occupants.length - n));
  }

  function applyTableEdit(t, name, shape, n) {
    pushUndo();
    const occ = occupancy()[t.id];
    const lost = [];
    if (n < t.seats) {
      const keep = occ.slice(0, n);
      const overflow = occ.slice(n).filter(Boolean);
      overflow.forEach((k) => {
        const freeIdx = keep.findIndex((x) => !x);
        if (freeIdx >= 0) { keep[freeIdx] = k; plan().seats[k] = { t: t.id, s: freeIdx }; }
        else { delete plan().seats[k]; lost.push(k); }
      });
    }
    Object.assign(t, { name, shape, seats: n });
    if (lost.length) B.toast('⚠️ Se quedaron sin silla: <b>' + lost.map((k) => esc(keyName(k))).join(', ') + '</b>. Están en “Sin mesa”.', 'warn', 7000);
    else B.toast('Mesa actualizada ✓', 'ok', 1800);
    if (lost.length) { selection = new Set(lost); moveMsg = 'Se quedaron sin silla. Toca otra mesa para sentarlos.'; }
    commit();
  }

  async function deleteTable(tid) {
    const t = table(tid);
    const occupants = (occupancy()[tid] || []).filter(Boolean);
    const ok = await A().confirmBox('Eliminar ' + t.name, occupants.length ? 'Las ' + occupants.length + ' personas sentadas aquí pasarán a “Sin mesa”.' : '¿Eliminar esta mesa vacía?', 'Eliminar', true);
    if (!ok) return;
    pushUndo();
    occupants.forEach((k) => delete plan().seats[k]);
    plan().tables = plan().tables.filter((x) => x.id !== tid);
    selTable = null;
    openPanel({ type: 'home' }, true);
    B.toast('Mesa eliminada (puedes deshacer ↶)', 'ok');
    commit();
  }

  function duplicateTable(tid) {
    const t = table(tid);
    const base = t.name.replace(/\s*\d+$/, '') || 'Mesa';
    pushUndo();
    const nt = Object.assign({}, t, { id: 't' + B.newId(), name: base + ' ' + nextNumber(base), x: t.x + geom(t).ext * 2 + 40 });
    plan().tables.push(nt);
    selTable = nt.id;
    openPanel({ type: 'table', id: nt.id }, true);
    commit();
  }

  function rotateTable(tid, d) {
    const t = table(tid);
    pushUndo();
    t.rot = d === 0 ? 0 : (((Math.round(((t.rot || 0) + d) / 45) * 45) % 360) + 360) % 360;
    commit();
  }

  /* ====================== Panel ====================== */
  function openPanel(p, silent) {
    panel = p;
    if (p.type === 'pick') pickSearch = '';
    if (panelEl.classList.contains('peek')) panelEl.classList.remove('peek');
    renderAll();
    if (!silent && (p.type === 'table') && listView) { /* nada */ }
  }

  function groupRow(x, opts = {}) {
    const g = x.g;
    const allSel = x.keys.every((k) => selection.has(k));
    const someSel = x.keys.some((k) => selection.has(k));
    let fit = '';
    if (opts.free != null) fit = x.keys.length <= opts.free ? '<span class="fit ok">cabe ✓</span>' : '<span class="fit no">faltan ' + (x.keys.length - opts.free) + '</span>';
    const sub = [STATUS_LABEL[g.status] + (g.source === 'web' ? ' · web' : ''), x.partial ? 'faltan ' + x.keys.length + ' de ' + x.total : null, g.diet ? '🍽 ' + g.diet : null].filter(Boolean).join(' · ');
    let html = '<div class="grp' + (allSel ? ' sel' : someSel ? ' sel' : '') + '" data-g="' + g.id + '">' +
      '<span class="dot" style="background:' + colorOf(g) + '">' + esc(initials(g.name)) + '</span>' +
      '<span class="t"><b>' + esc(g.name) + (x.keys.length > 1 ? ' <span class="muted">+' + (x.keys.length - 1) + '</span>' : '') + '</b><small>' + esc(sub) + '</small></span>' +
      fit + '<span class="n">' + x.keys.length + '</span>' +
      (x.keys.length > 1 ? '<button class="exp" data-exp="' + g.id + '" title="Ver personas">' + (expanded.has(g.id) ? '▾' : '▸') + '</button>' : '') + '</div>';
    if (expanded.has(g.id) && x.keys.length > 1) {
      html += '<div class="members">' + x.keys.map((k) => '<div class="member' + (selection.has(k) ? ' sel' : '') + '" data-k="' + k + '">' + esc(keyName(k)) + '</div>').join('') + '</div>';
    }
    return html;
  }

  function filteredUnseated(search, filter) {
    const q = norm(search);
    return unseatedGroups().filter((x) => {
      if (filter === 'si' && x.g.status !== 'si') return false;
      if (filter === 'pendiente' && x.g.status !== 'pendiente') return false;
      if (!q) return true;
      return norm(x.g.name + ' ' + x.g.companionNames + ' ' + x.g.group).includes(q);
    });
  }

  function famGroupsHtml(list, opts) {
    const fams = new Map();
    list.forEach((x) => { const f = x.g.group || 'Sin grupo'; if (!fams.has(f)) fams.set(f, []); fams.get(f).push(x); });
    let html = '';
    Array.from(fams.keys()).sort((a, b) => (a === 'Sin grupo') - (b === 'Sin grupo') || a.localeCompare(b)).forEach((f) => {
      const items = fams.get(f);
      const n = items.reduce((a, x) => a + x.keys.length, 0);
      html += '<div class="famhead"><span>' + esc(f) + ' · ' + n + '</span>' + (opts && opts.pick ? '' : '<button data-fam="' + esc(f) + '">Seleccionar grupo</button>') + '</div>';
      html += items.map((x) => groupRow(x, opts)).join('');
    });
    return html;
  }

  function renderPanel() {
    const head = $('.pp-head', panelEl), body = $('.pp-body', panelEl);
    const occ = occupancy();
    const alerts = computeAlerts();
    const back = '<button class="back" data-act="home" title="Volver">←</button>';

    if (panel.type === 'table' && !table(panel.id)) panel = { type: 'home' };
    if (panel.type === 'item' && !item(panel.id)) panel = { type: 'home' };
    if (panel.type === 'member' && !plan().seats[panel.key]) panel = { type: 'home' };
    if (panel.type === 'pick' && !table(panel.tid)) panel = { type: 'home' };

    if (panel.type === 'home') {
      const un = unseatedGroups();
      const unN = un.reduce((a, x) => a + x.keys.length, 0);
      head.innerHTML = '<h4>Invitados y mesas</h4>';
      let html = '<div class="pp-tabs"><button data-tab="sin" class="' + (homeTab === 'sin' ? 'on' : '') + '">Sin mesa (' + unN + ')</button>' +
        '<button data-tab="avisos" class="' + (homeTab === 'avisos' ? 'on' : '') + '">Avisos' + (alerts.list.length ? ' (' + alerts.list.length + ')' : '') + '</button>' +
        '<button data-tab="mesas" class="' + (homeTab === 'mesas' ? 'on' : '') + '">Mesas (' + plan().tables.length + ')</button></div>';
      if (homeTab === 'sin') {
        html += '<input class="searchbox" type="search" id="ppSearch" placeholder="Buscar por nombre…" value="' + esc(sinSearch) + '">';
        html += '<div class="filters"><button data-sf="all" class="' + (sinFilter === 'all' ? 'on' : '') + '">Todos</button><button data-sf="si" class="' + (sinFilter === 'si' ? 'on' : '') + '">Confirmados</button><button data-sf="pendiente" class="' + (sinFilter === 'pendiente' ? 'on' : '') + '">Pendientes</button></div>';
        html += '<p class="muted small" style="margin:4px 0 6px">Toca un grupo (o varios) y luego toca una mesa o un asiento. ' + (mode === 'organizar' ? '<b>Cambia a “Sentar” para sentar.</b>' : '') + '</p>';
        const list = filteredUnseated(sinSearch, sinFilter);
        html += list.length ? famGroupsHtml(list) : '<div class="empty-note">' + (unN ? 'Nadie coincide con la búsqueda.' : '🎉 ¡Todos tienen mesa!') + '</div>';
        if (un.some((x) => x.g.status === 'si')) html += '<div class="actions-col"><button class="btn" data-act="auto">✨ Sentar automáticamente a los confirmados</button></div>';
      } else if (homeTab === 'avisos') {
        html += alerts.list.length ? alerts.list.map((a, i) => alertHtml(a, i)).join('') : '<div class="empty-note">Sin avisos. Todo cuadra 👌</div>';
        const tight = plan().tables.filter((t) => occ[t.id].every(Boolean));
        if (tight.length) html += '<h5>Mesas llenas</h5><p class="small muted">' + tight.map((t) => esc(t.name)).join(', ') + '</p>';
      } else {
        html += plan().tables.length ? plan().tables.map((t) => {
          const used = occ[t.id].filter(Boolean).length;
          return '<div class="grp" data-open="' + t.id + '"><span class="dot" style="background:var(--accent)">' + (t.shape === 'round' ? '●' : t.shape === 'rect' ? '▬' : t.shape === 'novios' ? '♥' : '★') + '</span><span class="t"><b>' + esc(t.name) + '</b><small>' + (t.seats - used) + ' libres de ' + t.seats + '</small></span><span class="n">' + used + '/' + t.seats + '</span></div>';
        }).join('') : '<div class="empty-note">Aún no hay mesas.<br><button class="btn btn-primary" data-act="add" style="margin-top:8px">＋ Añadir mesas</button></div>';
      }
      body.innerHTML = html;
    }

    if (panel.type === 'item') {
      const it = item(panel.id);
      const k = ITEM_KINDS[it.kind] || ITEM_KINDS.other;
      const thin = it.kind === 'wall' || it.kind === 'window';
      head.innerHTML = back + '<h4>' + k.icon + ' ' + esc(it.label || k.name) + '</h4>';
      body.innerHTML = '<p class="small muted">' + esc(k.desc) + '. Arrástralo para moverlo y gíralo con el tirador ↻ (encaja cada 45°).</p>' +
        '<label class="frow"><span>Nombre</span><input id="iLabel" value="' + esc(it.label || '') + '" placeholder="' + esc(k.name) + '"></label>' +
        '<div class="form-grid"><label><span>' + (thin ? 'Largo' : 'Ancho') + '</span><input id="iW" type="number" min="10" max="3000" step="10" value="' + (it.w || k.w) + '"></label>' +
        '<label><span>' + (thin ? 'Grosor' : 'Alto') + '</span><input id="iH" type="number" min="4" max="3000" step="' + (thin ? 2 : 10) + '" value="' + (it.h || k.h) + '"></label></div>' +
        '<div class="actions-col" style="grid-template-columns:repeat(3,1fr)"><button class="btn btn-sm" data-act="irotl">⟲ 45°</button><button class="btn btn-sm" data-act="irot0">Enderezar</button><button class="btn btn-sm" data-act="irotr">⟳ 45°</button></div>' +
        '<div class="actions-col"><button class="btn btn-sm" data-act="idup">Duplicar</button><button class="btn btn-sm btn-danger" data-act="idel">Eliminar</button></div>';
    }

    if (panel.type === 'table') {
      const t = table(panel.id);
      const arr = occ[t.id];
      const used = arr.filter(Boolean).length;
      head.innerHTML = back + '<h4>' + esc(t.name) + '</h4><button class="btn btn-sm" data-act="edit">Editar</button>';
      let html = '<div class="tstat"><div><b>' + (t.seats - used) + '</b><span>libres</span></div><div><b>' + used + '</b><span>ocupadas</span></div><div><b>' + t.seats + '</b><span>plazas · ' + ({ round: 'redonda', rect: 'rectangular', presidential: 'presidencial', novios: 'de novios' })[t.shape] + '</span></div></div>';
      if (selection.size) {
        const free = t.seats - used + arr.filter((k) => k && selection.has(k)).length;
        html += '<button class="btn btn-block ' + (free >= selection.size ? 'btn-ok' : 'btn-danger') + '" data-act="seatsel">' + (free >= selection.size ? 'Sentar aquí a ' + selection.size + (selection.size > 1 ? ' personas' : ' persona') : '✗ No caben: faltan ' + (selection.size - free)) + '</button>';
      } else if (t.seats - used > 0) {
        html += '<button class="btn btn-primary btn-block" data-act="pick">＋ Sentar invitados aquí</button>';
      }
      if (mode === 'organizar') {
        html += '<div class="actions-col" style="grid-template-columns:repeat(3,1fr)"><button class="btn btn-sm" data-act="rotl">⟲ 45°</button><button class="btn btn-sm" data-act="rot0">Enderezar</button><button class="btn btn-sm" data-act="rotr">⟳ 45°</button></div>' +
          '<p class="muted small">Gira con el tirador ↻ (encaja sola cada 45°) o con dos dedos sobre la mesa. Arrastra para moverla.</p>';
      }
      html += '<h5>Asientos</h5>' + arr.map((k, i) => {
        const fl = k && alerts.byKey[k];
        return '<div class="seatrow' + (k ? '' : ' empty') + (fl ? ' flagged' : '') + '" data-seatrow="' + i + '"><span class="num">' + (i + 1) + '</span>' +
          (k ? '<span style="flex:1">' + esc(keyName(k)) + (fl === 'no' ? ' · ⚠️ no viene' : fl === 'sobra' ? ' · ⚠️ ya no viene' : '') + '</span><span class="dot" style="width:12px;height:12px;border-radius:50%;background:' + colorOf(keyGuest(k)) + '"></span>' : '<span style="flex:1">Libre · tocar para sentar</span>') + '</div>';
      }).join('');
      html += '<div class="actions-col"><button class="btn btn-sm" data-act="dup">Duplicar mesa</button><button class="btn btn-sm btn-danger" data-act="del">Eliminar mesa</button></div>';
      body.innerHTML = html;
    }

    if (panel.type === 'member') {
      const k = panel.key;
      const g = keyGuest(k);
      const a = plan().seats[k];
      const t = table(a.t);
      const fl = alerts.byKey[k];
      const groupHere = Object.keys(plan().seats).filter((x) => x.split('#')[0] === g.id && plan().seats[x].t === t.id);
      const groupAll = Object.keys(plan().seats).filter((x) => x.split('#')[0] === g.id);
      head.innerHTML = back + '<h4>' + esc(keyName(k)) + '</h4>';
      let html = '<p class="small"><span class="pill ' + g.status + '">' + STATUS_LABEL[g.status] + '</span> ' +
        (keyIdx(k) > 0 ? 'Acompañante de <b>' + esc(g.name) + '</b>' : 'Invitación de <b>' + esc(g.name) + '</b> (' + partySize(g) + (partySize(g) === 1 ? ' persona' : ' personas') + ')') +
        '<br>🪑 ' + esc(t.name) + ' · asiento ' + (a.s + 1) + (g.group ? '<br>🏷 ' + esc(g.group) : '') + (g.diet ? '<br>🍽 ' + esc(g.diet) : '') + '</p>';
      if (fl === 'no') html += '<div class="alert no">⚠️ Esta persona avisó que <b>no viene</b>. Libera la silla.</div>';
      if (fl === 'sobra') html += '<div class="alert">⚠️ Su grupo ahora es más pequeño: esta silla <b>sobra</b>.</div>';
      if (g.change) html += '<div class="alert info">' + esc(g.change) + '</div>';
      html += '<div class="actions-col">' +
        '<button class="btn" data-act="move">⇄ Cambiar de asiento</button>' +
        (partySize(g) > 1 || groupAll.length > 1 ? '<button class="btn" data-act="split">✂ Separar de su grupo y llevar a otra mesa</button>' : '') +
        (groupAll.length > 1 ? '<button class="btn" data-act="movegroup">⇄ Mover a todo su grupo (' + groupAll.length + ')</button>' : '') +
        '<button class="btn btn-danger" data-act="remove">Quitar de la mesa</button>' +
        (groupHere.length > 1 ? '<button class="btn btn-danger" data-act="removegroup">Quitar a todo su grupo de esta mesa (' + groupHere.length + ')</button>' : '') +
        '<button class="btn" data-act="editguest">✎ Editar invitado</button>' +
        '<button class="btn" data-act="opentable">Ver ' + esc(t.name) + '</button></div>';
      body.innerHTML = html;
    }

    if (panel.type === 'pick') {
      const t = table(panel.tid);
      const free = occ[t.id].filter((x) => !x).length;
      head.innerHTML = back + '<h4>Sentar en ' + esc(t.name) + '</h4>';
      let html = '<p class="small muted">' + (panel.seat != null ? 'Asiento ' + (panel.seat + 1) + ' · ' : '') + '<b>' + free + (free === 1 ? ' silla libre' : ' sillas libres') + '</b>. Toca un invitado para sentarlo (con su grupo, en sillas seguidas).</p>';
      html += '<input class="searchbox" type="search" id="ppPick" placeholder="Buscar invitado por nombre…" value="' + esc(pickSearch) + '">';
      const list = filteredUnseated(pickSearch, 'all');
      html += list.length ? famGroupsHtml(list, { pick: true, free }) : '<div class="empty-note">No hay invitados sin mesa' + (pickSearch ? ' con ese nombre' : '') + '.</div>';
      body.innerHTML = html;
    }

    wirePanel();
  }

  function alertHtml(a, i) {
    const cls = a.type === 'no' ? 'alert no' : a.type === 'info' ? 'alert info' : 'alert';
    let acts = '';
    if (a.type === 'no' || a.type === 'sobra') acts += '<button class="btn btn-sm btn-danger" data-alert="free" data-i="' + i + '">Liberar ' + (a.keys.length > 1 ? a.keys.length + ' sillas' : 'silla') + '</button>';
    if (a.type === 'falta') acts += '<button class="btn btn-sm btn-ok" data-alert="near" data-i="' + i + '">Buscar sitio junto a su grupo</button><button class="btn btn-sm" data-alert="select" data-i="' + i + '">Elegir mesa</button>';
    if (a.g.change) acts += '<button class="btn btn-sm" data-alert="ack" data-i="' + i + '">✓ Revisado</button>';
    return '<div class="' + cls + '">' + a.text + (a.change && a.type !== 'info' ? '<br><small class="muted">' + esc(a.change) + '</small>' : '') + '<div class="acts">' + acts + '</div></div>';
  }

  function wirePanel() {
    const body = $('.pp-body', panelEl);
    const head = $('.pp-head', panelEl);
    const on = (sel, fn) => $$(sel, panelEl).forEach((el) => { el.onclick = (e) => fn(el, e); });

    on('[data-act=home]', () => { selTable = null; openPanel({ type: 'home' }); });
    on('[data-tab]', (el) => { homeTab = el.dataset.tab; renderPanel(); });
    on('[data-sf]', (el) => { sinFilter = el.dataset.sf; renderPanel(); });
    on('[data-act=auto]', autoSeat);
    on('[data-act=add]', openAddTables);
    on('[data-open]', (el) => { selTable = el.dataset.open; openPanel({ type: 'table', id: el.dataset.open }); centerOn(table(el.dataset.open)); });

    const search = $('#ppSearch', body);
    if (search) search.oninput = () => { sinSearch = search.value; const pos = search.selectionStart; renderPanel(); const s2 = $('#ppSearch', panelEl); s2.focus(); s2.setSelectionRange(pos, pos); };
    const pick = $('#ppPick', body);
    if (pick) pick.oninput = () => { pickSearch = pick.value; const pos = pick.selectionStart; renderPanel(); const s2 = $('#ppPick', panelEl); s2.focus(); s2.setSelectionRange(pos, pos); };

    on('[data-exp]', (el, e) => { e.stopPropagation(); const id = el.dataset.exp; expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderPanel(); });
    on('.member[data-k]', (el) => {
      const k = el.dataset.k;
      if (panel.type === 'pick') { seatKeys([k], panel.tid, panel.seat); return; }
      toggleKeys([k]);
    });
    on('.grp[data-g]', (el) => {
      const x = unseatedGroups().find((u) => u.g.id === el.dataset.g);
      if (!x) return;
      if (panel.type === 'pick') { seatKeys(x.keys, panel.tid, panel.seat); return; }
      toggleKeys(x.keys);
      if (mode === 'organizar' && selection.size) { setMode('sentar'); }
    });
    on('[data-fam]', (el) => {
      const keys = filteredUnseated(sinSearch, sinFilter).filter((x) => (x.g.group || 'Sin grupo') === el.dataset.fam).flatMap((x) => x.keys);
      toggleKeys(keys);
    });

    // Elemento del salón
    if (panel.type === 'item') {
      const id = panel.id, it = item(id);
      let snap = null;
      const edit = (fn) => { if (!snap) snap = snapshot(); fn(); render(); };
      const done = () => { if (snap && snap !== snapshot()) { pushUndo(snap); A().savePlan(); } snap = null; renderToolbar(); };
      const lab = $('#iLabel', body), iw = $('#iW', body), ih = $('#iH', body);
      lab.oninput = () => edit(() => { it.label = lab.value.trim(); });
      lab.onchange = done;
      iw.oninput = () => edit(() => { it.w = Math.max(10, Math.min(3000, +iw.value || 10)); });
      ih.oninput = () => edit(() => { it.h = Math.max(4, Math.min(3000, +ih.value || 4)); });
      iw.onchange = done; ih.onchange = done;
      const rot = (d) => { pushUndo(); it.rot = d === 0 ? 0 : (((Math.round(((it.rot || 0) + d) / 45) * 45) % 360) + 360) % 360; commit(); };
      on('[data-act=irotl]', () => rot(-45));
      on('[data-act=irotr]', () => rot(45));
      on('[data-act=irot0]', () => rot(0));
      on('[data-act=idup]', () => { pushUndo(); const c = Object.assign({}, it, { id: 'e' + B.newId(), x: it.x + 30, y: it.y + 30 }); items().push(c); selTable = c.id; openPanel({ type: 'item', id: c.id }, true); commit(); });
      on('[data-act=idel]', () => { pushUndo(); plan().items = items().filter((x) => x.id !== id); selTable = null; openPanel({ type: 'home' }, true); B.toast('Elemento eliminado (puedes deshacer ↶)', 'ok', 2000); commit(); });
    }

    // Mesa
    if (panel.type === 'table') {
      const tid = panel.id;
      on('[data-act=edit]', () => openEditTable(tid));
      on('[data-act=pick]', () => openPanel({ type: 'pick', tid }));
      on('[data-act=seatsel]', () => seatKeys(Array.from(selection), tid, null));
      on('[data-act=rotl]', () => rotateTable(tid, -45));
      on('[data-act=rotr]', () => rotateTable(tid, 45));
      on('[data-act=rot0]', () => rotateTable(tid, 0));
      on('[data-act=dup]', () => duplicateTable(tid));
      on('[data-act=del]', () => deleteTable(tid));
      on('[data-seatrow]', (el) => {
        const i = +el.dataset.seatrow;
        const k = occupancy()[tid][i];
        if (selection.size) { onTap({ kind: 'seat', tid, seat: i }); return; }
        if (k) openPanel({ type: 'member', key: k }); else openPanel({ type: 'pick', tid, seat: i });
      });
    }

    // Persona sentada
    if (panel.type === 'member') {
      const k = panel.key;
      const g = keyGuest(k);
      const a = plan().seats[k];
      on('[data-act=move]', () => { selectKeys([k], 'Toca un asiento libre (o uno ocupado para intercambiar) o una mesa.'); });
      on('[data-act=split]', () => { selectKeys([k], 'Separado de su grupo: toca otra mesa o asiento. El resto se queda donde está.'); });
      on('[data-act=movegroup]', () => { selectKeys(Object.keys(plan().seats).filter((x) => x.split('#')[0] === g.id).concat(unseatedGroups().filter((u) => u.g.id === g.id).flatMap((u) => u.keys)), 'Toca la mesa a donde quieres mover a todo el grupo.'); });
      on('[data-act=remove]', () => { const name = keyName(k); openPanel({ type: 'table', id: a.t }, true); unseat([k], esc(name) + ' quitado de la mesa (el resto sigue en su sitio)'); });
      on('[data-act=removegroup]', () => { const keys = Object.keys(plan().seats).filter((x) => x.split('#')[0] === g.id && plan().seats[x].t === a.t); openPanel({ type: 'table', id: a.t }, true); unseat(keys, 'Grupo de ' + esc(g.name) + ' quitado de la mesa'); });
      on('[data-act=editguest]', () => A().openGuest(g.id));
      on('[data-act=opentable]', () => { selTable = a.t; openPanel({ type: 'table', id: a.t }); });
    }

    // Avisos
    const alerts = computeAlerts().list;
    on('[data-alert]', (el) => {
      const al = alerts[+el.dataset.i];
      if (!al) return;
      const act = el.dataset.alert;
      if (act === 'free') unseat(al.keys, 'Sillas liberadas ✓');
      if (act === 'ack') A().ackChange(al.g.id);
      if (act === 'select') { selectKeys(al.keys, 'Toca una mesa para sentar a ' + al.keys.length + ' de ' + esc(al.g.name) + '.'); }
      if (act === 'near') {
        const groupTables = Array.from(new Set(Object.keys(plan().seats).filter((x) => x.split('#')[0] === al.g.id).map((x) => plan().seats[x].t)));
        for (const tid of groupTables) { if (seatKeys(al.keys, tid, null, { silent: false })) return; }
        B.toast('No hay sitio en su mesa. Elige otra mesa (verde = cabe).', 'warn', 4500);
        selectKeys(al.keys, 'Su mesa está llena. Toca otra mesa para sentar a ' + al.keys.length + ' de ' + esc(al.g.name) + '.');
      }
    });
    void head;
  }

  /* ====================== Vista lista ====================== */
  function renderList() {
    if (!listView) return;
    const occ = occupancy();
    const { byKey } = computeAlerts();
    listBox.innerHTML = (plan().tables.length ? '' : '<div class="empty-note">Aún no hay mesas. <button class="btn btn-primary btn-sm" data-la="add">＋ Añadir mesas</button></div>') +
      plan().tables.map((t) => {
        const arr = occ[t.id];
        const used = arr.filter(Boolean).length;
        const fits = selection.size ? (t.seats - used >= selection.size) : null;
        return '<div class="tcard" style="' + (fits === true ? 'border-color:var(--ok)' : fits === false ? 'border-color:var(--bad)' : '') + '"><header data-lt="' + t.id + '"><b>' + esc(t.name) + '</b><span class="pill ' + (used >= t.seats ? 'si' : 'pendiente') + '">' + used + '/' + t.seats + ' · ' + (t.seats - used) + ' libres</span></header>' +
          (selection.size ? '<button class="btn btn-sm ' + (fits ? 'btn-ok' : 'btn-danger') + '" data-ls="' + t.id + '" style="margin-top:6px">' + (fits ? 'Sentar aquí la selección' : 'No cabe la selección (faltan ' + (selection.size - (t.seats - used)) + ')') + '</button>' : '') +
          '<div style="margin-top:6px">' + arr.map((k, i) => '<div class="seatrow' + (k ? '' : ' empty') + (k && byKey[k] ? ' flagged' : '') + '" data-lr="' + t.id + ':' + i + '"><span class="num">' + (i + 1) + '</span>' + (k ? esc(keyName(k)) + (byKey[k] ? ' ⚠️' : '') : 'Libre') + '</div>').join('') + '</div></div>';
      }).join('');
    $$('[data-la]', listBox).forEach((b) => { b.onclick = openAddTables; });
    $$('[data-lt]', listBox).forEach((h) => { h.onclick = () => { selTable = h.dataset.lt; openPanel({ type: 'table', id: h.dataset.lt }); }; });
    $$('[data-ls]', listBox).forEach((b) => { b.onclick = () => seatKeys(Array.from(selection), b.dataset.ls, null); });
    $$('[data-lr]', listBox).forEach((r) => {
      r.onclick = () => { const [tid, s] = r.dataset.lr.split(':'); onTap({ kind: 'seat', tid, seat: +s }); };
    });
  }

  /* ====================== Barra, selects y avisos ====================== */
  function hint(txt) {
    const el = $('#plHint');
    if (!el) return;
    el.textContent = txt || (mode === 'organizar'
      ? 'Organizar: arrastra una mesa para moverla · tócala para girarla con el tirador ↻ o con 2 dedos'
      : 'Sentar: toca un grupo y luego una mesa · arrastra para mover todo el plano · pellizca para zoom');
  }

  function renderToolbar() {
    const occ = occupancy();
    const selM = $('#plSelMesa');
    selM.innerHTML = '<option value="">Mesas (' + plan().tables.length + ')…</option>' + plan().tables.map((t) => {
      const used = occ[t.id].filter(Boolean).length;
      return '<option value="' + t.id + '">' + esc(t.name) + ' — ' + (t.seats - used) + ' libres de ' + t.seats + '</option>';
    }).join('');
    const un = unseatedGroups();
    const selS = $('#plSelSin');
    selS.innerHTML = '<option value="">Sin mesa (' + un.reduce((a, x) => a + x.keys.length, 0) + ')…</option>' + un.map((x) => '<option value="' + x.g.id + '">' + esc(x.g.name) + ' (' + x.keys.length + ')' + (x.g.status === 'si' ? ' ✓' : '') + '</option>').join('');
    $('#plUndo').disabled = !undoStack.length;
    $('#plRedo').disabled = !redoStack.length;
    $('#plView').classList.toggle('on', listView);
    $('#plNames').classList.toggle('on', showNames);
    $$('.mode-switch button', root).forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));

    const bar = $('#plSelbar');
    if (selection.size) {
      const names = Array.from(selection).slice(0, 3).map((k) => esc(shortName(keyName(k)))).join(', ') + (selection.size > 3 ? '…' : '');
      bar.hidden = false;
      bar.innerHTML = '<span><b>' + selection.size + '</b> ' + (selection.size === 1 ? 'persona' : 'personas') + ': ' + names + '<br><small style="opacity:.8">' + (moveMsg || 'Toca una mesa (verde = cabe) o un asiento exacto.') + '</small></span><button id="plSelCancel">Cancelar</button>';
      $('#plSelCancel').onclick = clearSelection;
    } else bar.hidden = true;

    const badge = document.getElementById('badgeMesas');
    if (badge) { const n = computeAlerts().list.length; badge.hidden = !n; badge.textContent = n; }
  }

  function renderAll() {
    if (!mounted) return;
    if (sanitize()) A().savePlan();
    render();
    renderPanel();
    renderToolbar();
    renderList();
    hint();
  }

  function setMode(m) {
    mode = m;
    if (m === 'organizar') { selection.clear(); moveMsg = ''; }
    renderAll();
  }

  /* ====================== Descargar ====================== */
  const EXPORT_STYLE = '.tshape{fill:#fff;stroke:#b9a27a;stroke-width:2}.tname{font:600 13px Helvetica,Arial,sans-serif;fill:#2f2a24;text-anchor:middle;dominant-baseline:middle}.tcount{font:500 11px Helvetica,Arial,sans-serif;fill:#7a6f63;text-anchor:middle;dominant-baseline:middle}.tcount.full{fill:#4f8a56}.seat circle{fill:#fff;stroke:#cbb894;stroke-width:1.6}.seat.free circle{stroke-dasharray:3 2.5}.ini{font:600 9.5px Helvetica,Arial,sans-serif;text-anchor:middle;dominant-baseline:central;fill:#fff}.nm{font:500 8.5px Helvetica,Arial,sans-serif;fill:#2f2a24;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:#fff;stroke-width:3px}.flagdot{fill:#b5544b}.seat.flag circle{stroke:#b5544b!important;stroke-width:3!important}.ttl{font:600 22px Georgia,serif;fill:#2f2a24}.i-area{fill:rgba(154,123,79,.06);stroke:#b9a27a;stroke-width:2;stroke-dasharray:10 6}.i-area-lbl{font:600 13px Helvetica,Arial,sans-serif;fill:#9a7b4f;text-anchor:middle}.i-wall{fill:#5b4a3a}.i-window{fill:#d6ebf7;stroke:#6aa0c8;stroke-width:2}.i-window-line{stroke:#6aa0c8;stroke-width:1.5}.i-door{fill:#fff;stroke:#8a6b4a;stroke-width:2}.i-door-arc{fill:none;stroke:#8a6b4a;stroke-width:1.5;stroke-dasharray:4 3}.i-box{fill:#f4efe6;stroke:#cbb894;stroke-width:1.5}.i-fireplace{fill:#f8e2d6;stroke:#c9764a}.i-dance{fill:#efe9f6;stroke:#9d8bbf}.i-ico{font:20px sans-serif;text-anchor:middle;dominant-baseline:central}.i-lbl{font:600 11px Helvetica,Arial,sans-serif;fill:#5a4f44;text-anchor:middle;dominant-baseline:central}.heart{font:14px sans-serif;fill:#c0567a;text-anchor:middle;dominant-baseline:middle}.tname.small{font-size:11px}.sub{font:400 11px Helvetica,Arial,sans-serif;fill:#7a6f63}';

  function exportSvg() {
    const b = bbox(plan().tables);
    const pad = 40, top = 56;
    const w = b.w + pad * 2, h = b.h + pad * 2 + top;
    const cfg = st().config;
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><style>' + EXPORT_STYLE + '</style>' +
      '<rect width="100%" height="100%" fill="#fffdf9"/>' +
      '<text class="ttl" x="' + pad + '" y="34">Plano de mesas · ' + esc(cfg.name1 + ' & ' + cfg.name2) + '</text>' +
      '<text class="sub" x="' + pad + '" y="50">' + esc(B.formatLongDate(cfg) + ' · ' + cfg.venueName + ' · ' + new Date().toLocaleDateString('es-MX')) + '</text>' +
      '<g transform="translate(' + (pad - b.x) + ' ' + (pad + top - b.y) + ')">' + itemsMarkup({ export: true }) + tablesMarkup({ export: true, names: true }) + '</g></svg>';
    return { svgStr, w, h };
  }

  function svgToCanvas(svgStr, w, h, scale) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function openDownload() {
    if (!plan().tables.length) { B.toast('Aún no hay mesas para descargar', 'warn'); return; }
    A().openModal('<h3>Descargar plano</h3><p class="muted small">Incluye los nombres de cada persona en su silla. Solo para ustedes.</p><div class="actions-col">' +
      '<button class="btn btn-primary" id="dlPng">🖼 Imagen (PNG)</button><button class="btn" id="dlPdf">📄 PDF: plano + lista por mesa</button><button class="btn" id="dlSvg">✏️ SVG (editable)</button></div>', (m) => {
      $('#dlPng', m).onclick = async () => {
        A().closeModal();
        const { svgStr, w, h } = exportSvg();
        const scale = Math.min(3, 4000 / Math.max(w, h));
        try { const c = await svgToCanvas(svgStr, w, h, scale); c.toBlob((b) => A().downloadBlob(b, A().fileBase() + '-plano.png'), 'image/png'); } catch (e) { B.toast('No se pudo crear la imagen', 'error'); }
      };
      $('#dlSvg', m).onclick = () => { A().closeModal(); const { svgStr } = exportSvg(); A().downloadBlob(new Blob([svgStr], { type: 'image/svg+xml' }), A().fileBase() + '-plano.svg'); };
      $('#dlPdf', m).onclick = async () => {
        A().closeModal();
        if (!window.jspdf) { B.toast('Cargando PDF… intenta de nuevo', 'warn'); return; }
        const { svgStr, w, h } = exportSvg();
        try {
          const c = await svgToCanvas(svgStr, w, h, Math.min(2.5, 3000 / Math.max(w, h)));
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: 'letter' });
          const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
          const s = Math.min((pw - 40) / w, (ph - 40) / h);
          doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - w * s) / 2, 20, w * s, h * s);
          const occ = occupancy();
          const rows = [];
          plan().tables.forEach((t) => occ[t.id].forEach((k, i) => {
            const g = k && keyGuest(k);
            rows.push([t.name, String(i + 1), k ? keyName(k) : '— libre —', g ? g.group || '' : '', g && keyIdx(k) === 0 ? g.diet || '' : '']);
          }));
          doc.addPage('letter', 'portrait');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Lista por mesa', 40, 44);
          doc.autoTable({ startY: 58, head: [['Mesa', 'Asiento', 'Invitado', 'Grupo / Familia', 'Restricciones']], body: rows, styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [154, 123, 79] } });
          const un = unseatedGroups();
          if (un.length) {
            doc.addPage('letter', 'portrait');
            doc.setFontSize(16); doc.text('Sin mesa todavía', 40, 44);
            doc.autoTable({ startY: 58, head: [['Persona', 'Invitación de', 'Asistencia']], body: un.flatMap((x) => x.keys.map((k) => [keyName(k), x.g.name, STATUS_LABEL[x.g.status]])), styles: { fontSize: 9 }, headStyles: { fillColor: [154, 123, 79] } });
          }
          doc.save(A().fileBase() + '-plano.pdf');
        } catch (e) { B.toast('No se pudo crear el PDF', 'error'); }
      };
    });
  }

  /* ====================== Pantalla completa ====================== */
  function toggleFullscreen() {
    const isFs = document.fullscreenElement === root || root.classList.contains('pseudo-fs');
    if (isFs) {
      if (document.fullscreenElement) document.exitFullscreen();
      root.classList.remove('pseudo-fs');
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => root.classList.add('pseudo-fs'));
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    } else {
      root.classList.add('pseudo-fs');
    }
    setTimeout(fit, 250);
  }

  /* ====================== Montaje ====================== */
  function mount() {
    root = document.getElementById('plano-root');
    root.innerHTML =
      '<div class="pl-toolbar">' +
      '<div class="mode-switch"><button data-mode="sentar" class="on" title="Sentar invitados">🪑 Sentar</button><button data-mode="organizar" title="Mover y girar mesas">✥ Organizar</button></div>' +
      '<span class="sep"></span>' +
      '<button class="tbtn" id="plAdd" title="Añadir mesas">＋ Mesa</button>' +
      '<button class="tbtn" id="plAddItem" title="Áreas, paredes, ventanas, entrada, baños, sonido, meseros, chimenea…">＋ Elemento</button>' +
      '<button class="tbtn" id="plUndo" title="Deshacer (Ctrl+Z)">↶</button>' +
      '<button class="tbtn" id="plRedo" title="Rehacer (Ctrl+Y)">↷</button>' +
      '<span class="sep"></span>' +
      '<select id="plSelMesa" title="Lista de mesas"></select>' +
      '<select id="plSelSin" title="Invitados sin mesa"></select>' +
      '<span class="sep"></span>' +
      '<button class="tbtn" id="plView" title="Ver como lista, sin el gráfico">☰ Lista</button>' +
      '<button class="tbtn" id="plNames" title="Mostrar nombres en las sillas">Aa Nombres</button>' +
      '<button class="tbtn" id="plDown" title="Descargar plano">⇩ Descargar</button>' +
      '<button class="tbtn" id="plFs" title="Pantalla completa">⛶</button>' +
      '<button class="tbtn" id="plPanelTg" title="Mostrar/ocultar panel">◨</button>' +
      '</div>' +
      '<div class="pl-stage" id="plStage">' +
      '<svg id="plSvg" xmlns="http://www.w3.org/2000/svg"><g id="plWorld"></g></svg>' +
      '<div class="pl-list" id="plList" hidden></div>' +
      '<div class="selbar" id="plSelbar" hidden></div>' +
      '<div class="modehint" id="plHint"></div>' +
      '<div class="zoomctl"><button id="plZin" title="Acercar">＋</button><button id="plZout" title="Alejar">−</button><button id="plFit" title="Ver todo">⤢</button></div>' +
      '</div>' +
      '<aside class="pl-panel" id="plPanel"><div class="pp-grip" id="plGrip"></div><div class="pp-head"></div><div class="pp-body"></div></aside>';
    stage = $('#plStage'); svg = $('#plSvg'); world = $('#plWorld'); listBox = $('#plList'); panelEl = $('#plPanel');
    mounted = true;
    setupGestures();

    $$('.mode-switch button', root).forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
    $('#plAdd').onclick = openAddTables;
    $('#plAddItem').onclick = openAddItem;
    $('#plUndo').onclick = undo;
    $('#plRedo').onclick = redo;
    $('#plZin').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); };
    $('#plZout').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); };
    $('#plFit').onclick = fit;
    $('#plFs').onclick = toggleFullscreen;
    $('#plDown').onclick = openDownload;
    $('#plNames').onclick = () => { showNames = !showNames; savePrefs(); renderAll(); };
    $('#plView').onclick = () => {
      listView = !listView;
      svg.style.display = listView ? 'none' : '';
      listBox.hidden = !listView;
      $$('.zoomctl, .modehint', root).forEach((el) => { el.style.display = listView ? 'none' : ''; });
      renderAll();
      if (!listView) fit();
    };
    $('#plPanelTg').onclick = () => {
      if (window.innerWidth <= 900) { panelEl.classList.toggle('peek'); panelEl.classList.remove('tall'); }
      else root.classList.toggle('panel-hidden');
      setTimeout(() => { if (!fittedOnce) fit(); }, 260);
    };
    $('#plGrip').onclick = () => {
      if (panelEl.classList.contains('peek')) panelEl.classList.remove('peek');
      else if (panelEl.classList.contains('tall')) { panelEl.classList.remove('tall'); panelEl.classList.add('peek'); }
      else panelEl.classList.add('tall');
    };
    $('#plSelMesa').onchange = (e) => {
      const id = e.target.value; e.target.value = '';
      if (!id) return;
      selTable = id;
      if (selection.size) { seatKeys(Array.from(selection), id, null); return; }
      openPanel({ type: 'table', id });
      if (!listView) centerOn(table(id));
    };
    $('#plSelSin').onchange = (e) => {
      const id = e.target.value; e.target.value = '';
      const x = unseatedGroups().find((u) => u.g.id === id);
      if (!x) return;
      if (mode === 'organizar') mode = 'sentar';
      homeTab = 'sin';
      panel = { type: 'home' };
      selectKeys(x.keys, 'Ahora toca la mesa (verde = cabe) o el asiento exacto.');
    };
    document.addEventListener('fullscreenchange', () => { root.classList.toggle('fs', document.fullscreenElement === root); setTimeout(fit, 200); });
    document.addEventListener('keydown', (e) => {
      if (!visible || !$('#modal').hidden) return;
      if (/input|textarea|select/i.test((e.target.tagName || ''))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Escape') { if (root.classList.contains('pseudo-fs')) { root.classList.remove('pseudo-fs'); fit(); } else clearSelection(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'organizar' && selTable) deleteTable(selTable);
    });
    // Mientras no muevas el plano a mano, se ajusta solo al tamaño de la pantalla
    if (window.ResizeObserver) new ResizeObserver(() => { if (visible && !fittedOnce) fit(); }).observe(stage);
    else window.addEventListener('resize', () => { if (visible && !fittedOnce) fit(); });
  }

  window.Plano = {
    show() {
      if (!mounted) mount();
      visible = true;
      renderAll();
      requestAnimationFrame(() => { if (!fittedOnce) fit(); });
    },
    hide() { visible = false; },
    refresh() { if (mounted) renderAll(); else { const b = document.getElementById('badgeMesas'); if (b && guests()) { const n = computeAlerts().list.length; b.hidden = !n; b.textContent = n; } } },
    alertCount() { return guests() ? computeAlerts().list.length : 0; },
    occupancy,
    focusGuest(id) {
      if (!mounted) this.show();
      const keys = Object.keys(plan().seats).filter((k) => k.split('#')[0] === id);
      if (keys.length) {
        const t = table(plan().seats[keys[0]].t);
        selTable = t.id;
        openPanel({ type: 'member', key: keys[0] });
        if (!listView) centerOn(t);
      } else {
        const x = unseatedGroups().find((u) => u.g.id === id);
        homeTab = 'sin'; panel = { type: 'home' };
        if (x) selectKeys(x.keys, 'Toca una mesa para sentar a ' + esc(x.g.name) + '.'); else renderAll();
      }
    }
  };
})();
