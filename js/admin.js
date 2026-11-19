/* Panel de organizadores: confirmaciones, invitados, compartir, ajustes. */
(function () {
  'use strict';
  const B = window.Boda;
  const { $, $$, esc, norm, partySize, memberName, STATUS_LABEL } = B;
  const KEY_STORE = 'boda_admin_key';
  const POLL_MS = 15000;

  const S = { key: '', config: B.withDefaults({}), guests: [], plan: { tables: [], seats: {}, updated: '' }, tab: 'resumen', filter: 'all', sendFilter: 'unsent', planDirty: false, lastSync: null };
  let pollTimer = null, planTimer = null;

  /* ------------------------- Acceso ------------------------- */
  // La clave se guarda solo si marcas "Recordarme"; si no, dura mientras tengas abierta la pestaña
  function storedKey() {
    try { return localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function storeKey(k, remember) {
    try {
      localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE);
      if (k) (remember ? localStorage : sessionStorage).setItem(KEY_STORE, k);
    } catch (e) { /* nada */ }
  }

  let loginTry = 0; // solo el intento más reciente puede abrir el panel
  async function login(key, auto) {
    const myTry = ++loginTry;
    const btn = $('#loginBtn');
    if (!auto) { btn.disabled = true; btn.textContent = 'Verificando…'; }
    try {
      const r = await B.api('admin_login', { key });
      if (myTry !== loginTry) return false; // llegó otro intento después: este se ignora
      if (r && r.ok) {
        S.key = key;
        if (!auto) storeKey(key, $('#rememberMe').checked);
        await start();
        return true;
      }
      if (auto) { storeKey(''); showLoginForm(); }
      else { B.toast('Clave incorrecta', 'error'); $('#pin').select(); }
    } catch (e) {
      if (myTry !== loginTry) return false;
      if (auto) showLoginForm();
      B.toast('No se pudo conectar con Google Sheets. Revisa tu internet.', 'error', 6000);
    } finally {
      if (!auto && myTry === loginTry) { btn.disabled = false; btn.textContent = 'Entrar'; }
    }
    return false;
  }

  function showLoginForm() {
    $('#loginWait').hidden = true;
    $('#loginFields').hidden = false;
    setTimeout(() => $('#pin').focus(), 50);
  }

  async function start() {
    $('#loginWait').hidden = false; $('#loginWait').textContent = 'Cargando tu boda…'; $('#loginFields').hidden = true;
    await loadAll();
    $('#login').hidden = true;
    $('#app').hidden = false;
    setupTabs();
    showTab(location.hash.replace('#', '') || 'resumen');
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    window.addEventListener('storage', (e) => { if (e.key === B.DEMO_KEY) poll(); });
  }

  async function loadAll() {
    const r = await B.api('admin_all', { key: S.key });
    if (!r || !r.ok) { B.toast('Error al cargar: ' + ((r && r.error) || ''), 'error'); return; }
    S.config = B.withDefaults(r.config);
    S.guests = r.guests || [];
    S.plan = normalizePlan(r.plan);
    S.lastSync = new Date();
    B.applyTheme(S.config);
    renderAll();
  }

  function normalizePlan(p) {
    p = p && typeof p === 'object' ? p : {};
    return { tables: Array.isArray(p.tables) ? p.tables : [], seats: p.seats && typeof p.seats === 'object' ? p.seats : {}, items: Array.isArray(p.items) ? p.items : [], updated: p.updated || '' };
  }

  /* --------------- Tiempo real: sondeo + avisos --------------- */
  async function poll() {
    if (!S.key) return;
    try {
      const r = await B.api('admin_guests', { key: S.key });
      if (!r || !r.ok) return;
      notifyChanges(S.guests, r.guests || []);
      S.guests = r.guests || [];
      S.lastSync = new Date();
      if (r.planUpdated && r.planUpdated > (S.plan.updated || '') && !S.planDirty) {
        const all = await B.api('admin_all', { key: S.key });
        if (all && all.ok) S.plan = normalizePlan(all.plan);
      }
      renderAll(true);
    } catch (e) {
      setSync('Sin conexión · reintentando…');
    }
  }

  function notifyChanges(oldList, newList) {
    const old = new Map(oldList.map((g) => [g.id, g]));
    newList.forEach((g) => {
      const o = old.get(g.id);
      const first = esc(g.name);
      if (!o) {
        if (g.source === 'web') B.toast(g.status === 'si' ? '🎉 <b>' + first + '</b> confirmó (' + partySize(g) + (partySize(g) > 1 ? ' personas' : ' persona') + ')' : '💌 <b>' + first + '</b> respondió que no podrá ir', g.status === 'si' ? 'ok' : 'info', 6000);
        return;
      }
      if (o.status !== g.status || partySize(o) !== partySize(g)) {
        if (g.status === 'si' && o.status === 'pendiente') B.toast('🎉 <b>' + first + '</b> confirmó (' + partySize(g) + ')', 'ok', 6000);
        else if (g.status === 'no') B.toast('⚠️ <b>' + first + '</b> avisó que no viene', 'warn', 7000);
        else B.toast('⚠️ <b>' + first + '</b> cambió su respuesta: ahora ' + partySize(g) + (partySize(g) === 1 ? ' persona' : ' personas'), 'warn', 7000);
      }
    });
  }

  function setSync(txt) { $('#syncState').textContent = txt; }

  /* ----------------------- Guardado ----------------------- */
  async function saveGuests(list, quiet) {
    list = [].concat(list);
    list.forEach((g) => {
      const i = S.guests.findIndex((x) => x.id === g.id);
      if (i >= 0) S.guests[i] = g; else S.guests.push(g);
    });
    renderAll(true);
    setSync('Guardando…');
    try {
      const r = await B.api('admin_upsert', { key: S.key, guests: list });
      if (!r || !r.ok) throw new Error(r && r.error);
      if (r.guests) S.guests = r.guests;
      setSync('Guardado ✓');
      if (!quiet) B.toast('Guardado ✓', 'ok', 1800);
      renderAll(true);
    } catch (e) {
      B.toast('No se pudo guardar. Revisa tu conexión.', 'error');
      setSync('Error al guardar');
    }
  }

  async function deleteGuests(ids) {
    const set = new Set(ids);
    S.guests = S.guests.filter((g) => !set.has(g.id));
    Object.keys(S.plan.seats).forEach((k) => { if (set.has(k.split('#')[0])) delete S.plan.seats[k]; });
    renderAll(true);
    try {
      const r = await B.api('admin_delete', { key: S.key, ids });
      if (r && r.guests) S.guests = r.guests;
      B.toast('Eliminado', 'ok', 1800);
      savePlan();
    } catch (e) { B.toast('No se pudo eliminar', 'error'); }
  }

  function savePlan() {
    S.planDirty = true;
    S.plan.updated = new Date().toISOString();
    setSync('Cambios sin guardar…');
    clearTimeout(planTimer);
    planTimer = setTimeout(async () => {
      try {
        const r = await B.api('admin_plan', { key: S.key, plan: S.plan });
        if (!r || !r.ok) throw new Error();
        S.planDirty = false;
        setSync('Plano guardado ✓');
      } catch (e) {
        setSync('Error al guardar el plano');
        B.toast('No se pudo guardar el plano. Se reintentará.', 'error');
        setTimeout(savePlan, 5000);
      }
    }, 900);
  }

  /* ----------------------- Pestañas ----------------------- */
  function setupTabs() {
    $$('#tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
    window.addEventListener('hashchange', () => showTab(location.hash.replace('#', '')));
  }

  function showTab(t) {
    if (!$('#tab-' + t)) t = 'resumen';
    S.tab = t;
    if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    $$('.tab').forEach((s) => { s.hidden = s.id !== 'tab-' + t; });
    $('#main').classList.toggle('full', t === 'mesas');
    if (t === 'mesas') window.Plano.show(); else window.Plano.hide();
    window.scrollTo(0, 0);
  }

  function renderAll(soft) {
    $('#appTitle').textContent = S.config.name1 + ' & ' + S.config.name2;
    $('#logo').textContent = (S.config.name1[0] || '') + '&' + (S.config.name2[0] || '');
    $('#openSite').href = B.siteBaseUrl(S.config);
    setSync((B.isDemo() ? 'Modo demostración' : 'Google Sheets') + ' · ' + (S.lastSync ? 'act. ' + S.lastSync.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''));
    renderResumen();
    renderGuests();
    renderShare();
    if (!soft || !$('#settingsForm').dataset.ready) renderSettings();
    window.Plano.refresh();
    const changes = S.guests.filter((g) => g.change).length;
    $('#badgeInv').hidden = !changes; $('#badgeInv').textContent = changes;
    const alerts = window.Plano.alertCount();
    $('#badgeMesas').hidden = !alerts; $('#badgeMesas').textContent = alerts;
  }

  /* ----------------------- Utilidades ----------------------- */
  function avatar(g) {
    const h = B.hueOf(g.group || g.id);
    return '<div class="avatar" style="background:hsl(' + h + ' 45% 55%)">' + esc(B.initials(g.name)) + '</div>';
  }

  function tableOf(key) {
    const a = S.plan.seats[key];
    if (!a) return null;
    const t = S.plan.tables.find((x) => x.id === a.t);
    return t ? { table: t, seat: a.s } : null;
  }

  function guestTables(g) {
    const names = new Set();
    Object.keys(S.plan.seats).forEach((k) => { if (k.split('#')[0] === g.id) { const r = tableOf(k); if (r) names.add(r.table.name); } });
    return Array.from(names);
  }

  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  function waUrlFor(g) {
    const text = B.fillTemplate(S.config, S.config.inviteTemplate, g);
    const phone = B.waPhone(g.phone, S.config.countryCode);
    return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
  }

  function sendInvite(id) {
    const g = S.guests.find((x) => x.id === id);
    if (!g) return;
    window.open(waUrlFor(g), '_blank', 'noopener');
    if (!g.invitedAt) saveGuests(Object.assign({}, g, { invitedAt: new Date().toISOString() }), true);
  }

  /* ----------------------- Resumen ----------------------- */
  function renderResumen() {
    const G = S.guests;
    const yes = G.filter((g) => g.status === 'si'), no = G.filter((g) => g.status === 'no'), pend = G.filter((g) => g.status === 'pendiente');
    const people = yes.reduce((a, g) => a + partySize(g), 0);
    const pendPeople = pend.reduce((a, g) => a + partySize(g), 0);
    const totalInvited = G.reduce((a, g) => a + Math.max(1, +g.invited || 1), 0);
    const answered = G.length ? Math.round(((yes.length + no.length) / G.length) * 100) : 0;
    const seated = Object.keys(S.plan.seats).filter((k) => { const g = G.find((x) => x.id === k.split('#')[0]); return g && g.status === 'si'; }).length;
    const sent = G.filter((g) => g.invitedAt).length;
    const kpi = (v, l, pct) => '<div class="kpi"><b>' + v + '</b><span>' + l + '</span>' + (pct != null ? '<div class="bar"><i style="width:' + Math.min(100, pct) + '%"></i></div>' : '') + '</div>';
    $('#kpis').innerHTML =
      kpi(people, 'personas confirmadas de ' + totalInvited + ' lugares', totalInvited ? (people / totalInvited) * 100 : 0) +
      kpi(answered + '%', 'invitaciones respondidas (' + (yes.length + no.length) + '/' + G.length + ')', answered) +
      kpi(pendPeople, 'personas sin responder (' + pend.length + ' invitaciones)') +
      kpi(no.length,'invitaciones que no asisten') +
      kpi(seated + '/' + people, 'confirmados ya sentados', people ? (seated / people) * 100 : 0) +
      kpi(sent + '/' + G.length, 'invitaciones enviadas', G.length ? (sent / G.length) * 100 : 0);

    const ch = G.filter((g) => g.change);
    $('#changesList').innerHTML = ch.length ? ch.map((g) =>
      '<div class="li"><div class="t"><b>' + esc(g.name) + '</b><small>' + esc(g.change) + '</small></div><div class="gactions">' +
      '<button class="btn btn-sm" data-seat="' + g.id + '">Ver en plano</button><button class="btn btn-sm" data-ack="' + g.id + '">✓ Revisado</button></div></div>').join('')
      : '<div class="empty">Nadie ha cambiado su respuesta. 👌</div>';

    const recent = G.filter((g) => g.status !== 'pendiente' && g.updated).sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 12);
    $('#recentList').innerHTML = recent.length ? recent.map((g) =>
      '<div class="li" data-edit="' + g.id + '"><div class="t"><b>' + esc(g.name) + '</b><small>' + (g.status === 'si' ? partySize(g) + (partySize(g) > 1 ? ' personas' : ' persona') : 'No asistirá') + ' · ' + relTime(g.updated) + '</small></div><span class="pill ' + g.status + '">' + STATUS_LABEL[g.status] + '</span></div>').join('')
      : '<div class="empty">Aún no hay respuestas. ¡Comparte tu enlace!</div>';

    const diets = yes.filter((g) => g.diet);
    $('#dietList').innerHTML = diets.length ? diets.map((g) => '<div class="li"><div class="t"><b>' + esc(g.name) + '</b><small>' + esc(g.diet) + '</small></div><span class="muted small">' + (guestTables(g).join(', ') || 'sin mesa') + '</span></div>').join('')
      : '<div class="empty">Sin restricciones registradas.</div>';

    const msgs = G.filter((g) => g.comments || g.song);
    $('#msgList').innerHTML = msgs.length ? msgs.map((g) => '<div class="li"><div class="t"><b>' + esc(g.name) + '</b>' + (g.comments ? '<small>💬 ' + esc(g.comments) + '</small>' : '') + (g.song ? '<small>🎵 ' + esc(g.song) + '</small>' : '') + '</div></div>').join('')
      : '<div class="empty">Todavía no hay mensajes.</div>';

    $$('#tab-resumen [data-ack]').forEach((b) => { b.onclick = () => ackChange(b.dataset.ack); });
    $$('#tab-resumen [data-seat]').forEach((b) => { b.onclick = () => { showTab('mesas'); window.Plano.focusGuest(b.dataset.seat); }; });
    $$('#tab-resumen [data-edit]').forEach((b) => { b.onclick = () => openGuest(b.dataset.edit); });
  }

  function ackChange(id) {
    const g = S.guests.find((x) => x.id === id);
    if (g) saveGuests(Object.assign({}, g, { change: '' }), true);
  }

  /* ----------------------- Invitados ----------------------- */
  function filteredGuests() {
    const q = norm($('#gSearch').value);
    const grp = $('#gGroupFilter').value;
    return S.guests.filter((g) => {
      if (grp && (g.group || '') !== grp) return false;
      switch (S.filter) {
        case 'si': case 'no': case 'pendiente': if (g.status !== S.filter) return false; break;
        case 'diet': if (!g.diet) return false; break;
        case 'change': if (!g.change) return false; break;
        case 'unsent': if (g.invitedAt) return false; break;
        case 'sent': if (!g.invitedAt) return false; break;
      }
      if (!q) return true;
      return norm([g.name, g.group, g.phone, g.email, g.companionNames, g.cabin, g.notes].join(' ')).includes(q);
    }).sort((a, b) => (b.change ? 1 : 0) - (a.change ? 1 : 0) || String(a.group).localeCompare(String(b.group)) || a.name.localeCompare(b.name));
  }

  function renderGuests() {
    const groups = Array.from(new Set(S.guests.map((g) => g.group).filter(Boolean))).sort();
    const sel = $('#gGroupFilter'), cur = sel.value;
    sel.innerHTML = '<option value="">Todos los grupos</option>' + groups.map((g) => '<option' + (g === cur ? ' selected' : '') + '>' + esc(g) + '</option>').join('');
    const list = filteredGuests();
    const people = list.reduce((a, g) => a + partySize(g), 0);
    $('#gCount').textContent = list.length + ' invitaciones · ' + people + ' personas';
    const picked = S.selected || (S.selected = new Set());
    $('#mergeBar').hidden = !S.selecting;
    $('#mergeCount').textContent = picked.size;
    $('#btnMergeGo').disabled = picked.size < 2;
    $('#btnMerge').classList.toggle('btn-primary', !!S.selecting);
    $('#guestList').innerHTML = list.length ? list.map((g) => {
      const tables = guestTables(g);
      const ms = B.members(g), att = B.attendingIdx(g);
      const famTxt = ms.length > 1 ? ms.map((n, i) => (g.status === 'si' ? (att.includes(i) ? '✓ ' : '✗ ') : '') + n).join(' · ') : '';
      return '<div class="gcard' + (g.change ? ' changed' : '') + (S.selecting && picked.has(g.id) ? ' picked' : '') + '"' + (S.selecting ? ' data-pick="' + g.id + '"' : '') + '>' +
        (S.selecting ? '<input type="checkbox" class="pickbox"' + (picked.has(g.id) ? ' checked' : '') + '>' : avatar(g)) +
        '<div class="gmain"' + (S.selecting ? '' : ' data-edit="' + g.id + '"') + '><b>' + esc(g.name) + '</b> <span class="pill ' + g.status + '">' + STATUS_LABEL[g.status] + '</span>' +
        (g.source === 'web' ? ' <span class="pill web">web</span>' : '') + (g.change ? ' <span class="pill warn">cambió</span>' : '') +
        '<div class="gmeta"><span>💌 ' + esc(B.groupLabel(g)) + '</span><span>👥 ' + (g.status === 'si' ? partySize(g) + ' de ' + ms.length + ' asistirán' : g.status === 'no' ? '0 de ' + ms.length : ms.length + (ms.length > 1 ? ' lugares' : ' lugar')) + '</span>' +
        (g.group ? '<span>🏷 ' + esc(g.group) + '</span>' : '') +
        (tables.length ? '<span>🪑 ' + esc(tables.join(', ')) + '</span>' : '') +
        (g.diet ? '<span>🍽 ' + esc(g.diet) + '</span>' : '') +
        (g.cabin ? '<span>🏡 ' + esc(g.cabin) + '</span>' : '') +
        (g.invitedAt ? '<span style="color:var(--ok)">✓ enviada ' + esc(fmtDate(g.invitedAt)) + '</span>' : '<span>✉ sin enviar</span>') +
        (g.change ? '<span style="color:var(--warn)">' + esc(g.change) + '</span>' : '') +
        '</div>' + (famTxt ? '<div class="gfam">' + esc(famTxt) + '</div>' : '') + '</div>' +
        '<div class="gactions"><button class="btn btn-wa btn-sm" data-wa="' + g.id + '" title="Enviar invitación por WhatsApp">WhatsApp</button></div></div>';
    }).join('') : '<p class="muted">No hay invitados con este filtro.</p>';
    $$('#guestList [data-edit]').forEach((el) => { el.onclick = () => openGuest(el.dataset.edit); });
    $$('#guestList [data-pick]').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.closest('[data-wa]')) return;
        const id = el.dataset.pick;
        picked.has(id) ? picked.delete(id) : picked.add(id);
        renderGuests();
      };
    });
    $$('#guestList [data-wa]').forEach((el) => { el.onclick = () => sendInvite(el.dataset.wa); });
  }

  function setupGuestUi() {
    $('#gSearch').addEventListener('input', renderGuests);
    $('#gGroupFilter').addEventListener('change', renderGuests);
    $$('#gFilters button').forEach((b) => {
      b.onclick = () => { S.filter = b.dataset.f; $$('#gFilters button').forEach((x) => x.classList.toggle('on', x === b)); renderGuests(); };
    });
    $('#btnAddGuest').onclick = () => openGuest(null);
    $('#btnMerge').onclick = () => { S.selecting = !S.selecting; S.selected = new Set(); renderGuests(); if (S.selecting) B.toast('Toca las invitaciones que quieres juntar en una familia', 'info', 3000); };
    $('#btnMergeCancel').onclick = () => { S.selecting = false; S.selected = new Set(); renderGuests(); };
    $('#btnMergeGo').onclick = () => openMerge(Array.from(S.selected || []));
    $('#btnPaste').onclick = openPaste;
    $('#btnExport').onclick = (e) => { e.stopPropagation(); $('#exportMenu').hidden = !$('#exportMenu').hidden; };
    document.addEventListener('click', () => { $('#exportMenu').hidden = true; });
    $$('#exportMenu button').forEach((b) => { b.onclick = () => exportList(b.dataset.exp); });
  }

  /* ----------------------- Modal ----------------------- */
  function openModal(html, onReady) {
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    if (onReady) onReady($('#modalBody'));
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
  $('#modalX').onclick = closeModal;
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  function confirmBox(title, text, okLabel, danger) {
    return new Promise((resolve) => {
      openModal('<h3>' + esc(title) + '</h3><p>' + text + '</p><div class="modal-actions"><button class="btn" id="cbNo">Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" id="cbYes">' + esc(okLabel || 'Aceptar') + '</button></div>', (m) => {
        $('#cbNo', m).onclick = () => { closeModal(); resolve(false); };
        $('#cbYes', m).onclick = () => { closeModal(); resolve(true); };
      });
    });
  }

  function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }

  // Mueve los asientos ya asignados cuando cambian los integrantes de una familia.
  // mapFn(idxViejo) → 'idNuevo#idxNuevo' o null (quitar asiento)
  function remapSeats(guestId, mapFn) {
    let changed = false;
    Object.keys(S.plan.seats).forEach((k) => {
      const [id, i] = k.split('#');
      if (id !== guestId) return;
      const nk = mapFn(+i);
      if (nk === k) return;
      const a = S.plan.seats[k];
      delete S.plan.seats[k];
      if (nk) S.plan.seats[nk] = a;
      changed = true;
    });
    return changed;
  }

  /* ---- Editar invitación = una familia con sus integrantes ---- */
  function openGuest(id) {
    const g = id ? S.guests.find((x) => x.id === id) : null;
    const v = g || { id: '', name: '', group: '', phone: '', email: '', invited: 1, status: 'pendiente', companions: 0, companionNames: '', attendees: '', diet: '', comments: '', cabin: '', song: '', notes: '', source: 'lista', invitedAt: '', change: '' };
    const groups = Array.from(new Set(S.guests.map((x) => x.group).filter(Boolean))).sort();
    const tables = g ? guestTables(g) : [];
    const att = g && g.status === 'si' ? B.attendingIdx(g) : [];
    // Filas de la familia: { name, old (posición anterior o null si es nuevo), att }
    let rows = (g ? B.members(g) : ['']).map((n, i) => ({ name: g && B.isPlaceholderName(n) && i > 0 ? '' : n, ph: n, old: g ? i : null, att: att.includes(i) }));
    const split = []; // integrantes que pasan a su propia invitación

    openModal(
      '<h3>' + (g ? esc(g.name) : 'Nueva invitación') + '</h3>' +
      (g && g.change ? '<div class="alert">⚠️ ' + esc(g.change) + '</div>' : '') +
      '<div class="form-grid">' +
      '<div class="full fam"><span class="lbl">Familia · integrantes de esta invitación</span><div id="famRows"></div>' +
      '<div class="fam-actions"><button type="button" class="btn btn-sm" id="famAdd">＋ Agregar integrante</button></div>' +
      '<small class="muted">El primero es el titular. Marca ✓ quiénes asistirán. “Separar” lo vuelve su propia invitación.</small></div>' +
      '<label class="full"><span>Nombre en la invitación (cómo se le saluda)</span><input id="eLabel" value="' + esc(v.label || '') + '" placeholder="' + esc(g ? B.groupLabel(Object.assign({}, g, { label: '' })) : 'Ej. Familia Bustos Hernández') + '"><small class="muted">Déjalo vacío para usar el automático (el que se ve en gris).</small></label>' +
      '<label><span>Asistencia</span><select id="eStatus">' + ['pendiente', 'si', 'no'].map((s) => '<option value="' + s + '"' + (v.status === s ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>').join('') + '</select></label>' +
      '<label><span>Familia / grupo (apellidos, ej. Bustos Reyna)</span><input id="eGroup" list="grpList" value="' + esc(v.group) + '"><datalist id="grpList">' + groups.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist></label>' +
      '<label class="full"><span>Celulares de la familia (separados por coma)</span><input id="ePhone" type="tel" value="' + esc(v.phone) + '" placeholder="Ej. 81 1234 5678, 81 8765 4321"><small class="muted">Con cualquiera de estos números pueden confirmar por toda la familia. Se agregan solos cuando alguien responde.</small></label>' +
      '<label class="full chk"><input type="checkbox" id="eSent"' + (v.invitedAt ? ' checked' : '') + '> Invitación enviada por WhatsApp' + (v.invitedAt ? ' <span class="muted">(' + esc(fmtDate(v.invitedAt)) + ')</span>' : '') + '</label>' +
      '<label class="full"><span>Restricciones alimentarias</span><input id="eDiet" value="' + esc(v.diet) + '"></label>' +
      '<label><span>Cabaña</span><input id="eCabin" value="' + esc(v.cabin || '') + '"></label>' +
      '<label><span>Canción sugerida</span><input id="eSong" value="' + esc(v.song || '') + '"></label>' +
      '<label class="full"><span>Comentarios del invitado</span><textarea id="eComments" rows="2">' + esc(v.comments) + '</textarea></label>' +
      '<label class="full"><span>Notas privadas (solo ustedes)</span><textarea id="eNotes" rows="2">' + esc(v.notes) + '</textarea></label>' +
      '</div>' +
      (g ? '<p class="muted small">' + (tables.length ? '🪑 Sentados en: ' + esc(tables.join(', ')) + ' · ' : '') + 'Enlace personal: <code>' + esc(B.guestLink(S.config, g)) + '</code></p>' : '') +
      '<div class="modal-actions">' +
      (g ? '<button class="btn btn-danger" id="eDel">Eliminar</button>' : '') +
      (g ? '<button class="btn" id="eCopy">Copiar enlace</button>' : '') +
      (g ? '<button class="btn btn-wa" id="eWa">WhatsApp</button>' : '') +
      '<span class="spacer"></span>' +
      (g && g.change ? '<button class="btn" id="eAck">✓ Cambio revisado</button>' : '') +
      '<button class="btn btn-primary" id="eSave">Guardar</button></div>',
      (m) => {
        const status = () => $('#eStatus', m).value;
        const drawRows = () => {
          $('#famRows', m).innerHTML = rows.map((r, i) =>
            '<div class="famrow">' +
            '<label class="att" title="Asistirá"><input type="checkbox" data-att="' + i + '"' + (r.att && status() === 'si' ? ' checked' : '') + (status() === 'no' ? ' disabled' : '') + '></label>' +
            '<input class="mname" data-name="' + i + '" value="' + esc(r.name) + '" placeholder="' + (i === 0 ? 'Nombre del titular' : esc(r.ph && B.isPlaceholderName(r.ph) ? r.ph : 'Nombre del integrante')) + '">' +
            (i > 0 ? '<button type="button" class="btn btn-sm" data-split="' + i + '" title="Hacerlo su propia invitación">Separar</button><button type="button" class="btn btn-sm btn-danger" data-del="' + i + '" title="Quitar">✕</button>' : '<span class="tit">Titular</span>') +
            '</div>').join('');
          $$('[data-name]', m).forEach((inp) => { inp.oninput = () => { rows[+inp.dataset.name].name = inp.value; }; });
          $$('[data-att]', m).forEach((cb) => {
            cb.onchange = () => {
              rows[+cb.dataset.att].att = cb.checked;
              if (cb.checked && status() !== 'si') { $('#eStatus', m).value = 'si'; drawRows(); }
            };
          });
          $$('[data-del]', m).forEach((b) => { b.onclick = () => { rows.splice(+b.dataset.del, 1); drawRows(); }; });
          $$('[data-split]', m).forEach((b) => {
            b.onclick = () => {
              const r = rows[+b.dataset.split];
              if (!(r.name || '').trim()) { B.toast('Escribe su nombre antes de separarlo', 'warn'); return; }
              split.push(r); rows.splice(+b.dataset.split, 1); drawRows();
              B.toast(esc(r.name) + ' tendrá su propia invitación al guardar', 'info', 2500);
            };
          });
        };
        drawRows();
        $('#famAdd', m).onclick = () => { rows.push({ name: '', ph: '', old: null, att: status() === 'si' }); drawRows(); $$('.mname', m).slice(-1)[0].focus(); };
        $('#eStatus', m).onchange = () => {
          if (status() === 'si' && !rows.some((r) => r.att)) rows.forEach((r) => { r.att = true; });
          drawRows();
        };

        $('#eSave', m).onclick = () => {
          const name = (rows[0].name || '').trim();
          if (!name) { B.toast('Escribe el nombre del titular', 'warn'); return; }
          const first = name.split(' ')[0];
          const names = rows.map((r, i) => (r.name || '').trim() || (i === 0 ? name : 'Acompañante ' + i + ' de ' + first));
          let st = status();
          let attIdx = st === 'si' ? rows.map((r, i) => (r.att ? i : -1)).filter((i) => i >= 0) : [];
          if (st === 'si' && !attIdx.length) st = 'no';
          const gid = v.id || B.newId();
          const ng = Object.assign({}, v, {
            id: gid, name, label: $('#eLabel', m).value.trim(), group: $('#eGroup', m).value.trim(), invited: rows.length, companionNames: names.slice(1).join(', '),
            phone: B.phoneList($('#ePhone', m).value).join(', ') || $('#ePhone', m).value.trim(), status: st,
            attendees: attIdx.join(','), companions: Math.max(0, attIdx.length - 1),
            invitedAt: $('#eSent', m).checked ? (v.invitedAt || new Date().toISOString()) : '',
            diet: $('#eDiet', m).value.trim(), cabin: $('#eCabin', m).value.trim(), song: $('#eSong', m).value.trim(),
            comments: $('#eComments', m).value.trim(), notes: $('#eNotes', m).value.trim(), updated: v.updated || new Date().toISOString()
          });
          // Los separados: cada uno con su propia invitación (misma categoría y cabaña)
          const now = new Date().toISOString();
          const news = split.map((r) => ({
            id: B.newId(), name: r.name.trim(), group: ng.group, phone: '', email: '', invited: 1,
            status: v.status === 'si' && r.att ? 'si' : (v.status === 'no' ? 'no' : 'pendiente'), attendees: v.status === 'si' && r.att ? '0' : '', companions: 0,
            companionNames: '', diet: '', comments: '', cabin: ng.cabin, song: '', source: 'lista', invitedAt: '', updated: now, change: '',
            notes: 'Separado de la invitación de ' + name + '.', _old: r.old
          }));
          closeModal();
          saveGuests([ng].concat(news.map((x) => { const c = Object.assign({}, x); delete c._old; return c; })));
          // Reacomodar asientos ya asignados según las nuevas posiciones
          if (g && remapSeats(g.id, (oi) => {
            const ni = rows.findIndex((r) => r.old === oi);
            if (ni >= 0) return g.id + '#' + ni;
            const sp = news.find((x) => x._old === oi);
            return sp ? sp.id + '#0' : null;
          })) savePlan();
        };
        if (g) {
          $('#eDel', m).onclick = async () => { if (await confirmBox('Eliminar invitación', '¿Seguro que quieres eliminar la invitación de <b>' + esc(g.name) + '</b>? Se liberarán sus asientos.', 'Eliminar', true)) deleteGuests([g.id]); };
          $('#eCopy', m).onclick = async () => { await B.copyText(B.guestLink(S.config, g)); B.toast('Enlace copiado ✓', 'ok'); };
          $('#eWa', m).onclick = () => sendInvite(g.id);
          if ($('#eAck', m)) $('#eAck', m).onclick = () => { closeModal(); ackChange(g.id); };
        }
      });
  }

  /* ---- Unir varias invitaciones en una sola familia ---- */
  function openMerge(ids) {
    const list = ids.map((id) => S.guests.find((x) => x.id === id)).filter(Boolean);
    if (list.length < 2) { B.toast('Selecciona al menos 2 invitaciones', 'warn'); return; }
    openModal('<h3>Unir en una familia</h3><p class="small">Se juntarán ' + list.reduce((a, g) => a + B.members(g).length, 0) + ' personas en una sola invitación. ¿Quién será el titular?</p>' +
      '<div class="actions-col">' + list.map((g, i) => '<label class="chk"><input type="radio" name="tit" value="' + g.id + '"' + (i === 0 ? ' checked' : '') + '> <b>' + esc(g.name) + '</b> <span class="muted small">(' + B.members(g).length + ')</span></label>').join('') + '</div>' +
      '<div class="modal-actions"><button class="btn" id="mgNo">Cancelar</button><button class="btn btn-primary" id="mgYes">Unir</button></div>', (m) => {
      $('#mgNo', m).onclick = closeModal;
      $('#mgYes', m).onclick = () => {
        const titId = $('input[name=tit]:checked', m).value;
        const tit = list.find((g) => g.id === titId);
        const others = list.filter((g) => g.id !== titId);
        const ms = B.members(tit).slice();
        // Quienes confirmaron o siguen pendientes cuentan como asistentes; solo los que dijeron "no" quedan fuera
        const att = B.attendingIdx(tit).slice();
        const offsets = {};
        others.forEach((o) => {
          offsets[o.id] = ms.length;
          const oms = B.members(o);
          B.attendingIdx(o).forEach((i) => att.push(ms.length + i));
          oms.forEach((n) => ms.push(n));
        });
        const anySi = list.some((g) => g.status === 'si');
        const allNo = list.every((g) => g.status === 'no');
        const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
        const merged = Object.assign({}, tit, {
          invited: ms.length, companionNames: ms.slice(1).join(', '),
          status: anySi ? 'si' : (allNo ? 'no' : 'pendiente'), attendees: anySi ? att.join(',') : '', companions: anySi ? Math.max(0, att.length - 1) : 0,
          phone: uniq(list.flatMap((g) => B.phoneList(g.phone))).join(', '),
          diet: uniq(list.map((g) => g.diet)).join(', '), cabin: uniq(list.map((g) => g.cabin)).join(' / '),
          comments: uniq(list.map((g) => g.comments)).join(' | '), notes: uniq(list.map((g) => g.notes)).join(' | '),
          invitedAt: list.map((g) => g.invitedAt).filter(Boolean).sort()[0] || ''
        });
        closeModal();
        others.forEach((o) => remapSeats(o.id, (oi) => titId + '#' + (offsets[o.id] + oi)));
        S.selecting = false; S.selected = new Set();
        saveGuests(merged, true).then(() => deleteGuests(others.map((o) => o.id))).then(() => B.toast('✓ Familia unida: ' + esc(tit.name) + ' (' + ms.length + ' personas)', 'ok', 3500));
      };
    });
  }

  /* -------------------- Pegar lista -------------------- */
  function parseList(text) {
    let group = '';
    const out = [];
    text.split(/\r?\n/).forEach((raw) => {
      let line = raw.replace(/ /g, ' ').trim();
      if (!line) return;
      if (/:\s*$/.test(line) && line.length < 60) { group = line.replace(/:\s*$/, '').trim(); return; }
      line = line.replace(/^(\d{1,3}[.)-]|[-•*·–])\s*/, '');
      let phone = '', invited = 1, extra = 0;
      const cells = line.split('\t').map((c) => c.trim()).filter(Boolean);
      if (cells.length > 1) {
        line = cells[0];
        cells.slice(1).forEach((c) => {
          if (/^\+?[\d\s().-]{8,}$/.test(c)) phone = c;
          else if (/^\+\s*\d{1,2}$/.test(c)) extra = parseInt(c.replace(/\D/g, ''), 10);
          else if (/^\d{1,2}$/.test(c)) invited = parseInt(c, 10);
        });
      }
      const pm = line.match(/(\+?\d[\d\s().-]{7,}\d)/);
      if (pm && pm[1].replace(/\D/g, '').length >= 8) { phone = pm[1].trim(); line = line.replace(pm[1], ' '); }
      const xm = line.match(/(?:\+|\by\b|\bmas\b|\bmás\b)\s*(\d{1,2})\s*(?:personas?|acompa\w*|invitad\w*)?\s*$/i);
      if (xm) { extra = parseInt(xm[1], 10); line = line.slice(0, xm.index); }
      const name = line.replace(/[,;|]+\s*$/, '').replace(/\s{2,}/g, ' ').trim();
      if (!name) return;
      out.push({ name, phone, group, invited: Math.max(invited, 1 + extra) });
    });
    return out;
  }

  function openPaste() {
    openModal(
      '<h3>Pegar mi lista</h3>' +
      '<p class="muted small">Copia tu lista de Excel, WhatsApp o las notas del móvil y pégala. <b>Una persona por línea.</b><br>' +
      '“<b>Ana López +2</b>” = Ana con 2 acompañantes (3 lugares). Puedes incluir su teléfono en la misma línea.<br>' +
      'Una línea que termina en dos puntos (ej. “<b>Familia Pérez:</b>”) agrupa a los de abajo.</p>' +
      '<textarea id="pText" rows="9" placeholder="Familia Pérez:\nAna López +2\nCarlos Ruiz 81 1234 5678\nTía Lupe + 1"></textarea>' +
      '<label class="frow" style="margin-top:8px"><span>Grupo para todos (opcional)</span><input id="pGroup" placeholder="Ej. Amigos del novio"></label>' +
      '<div id="pPrev" class="paste-preview" hidden></div>' +
      '<div class="modal-actions"><button class="btn" id="pCancel">Cancelar</button><button class="btn btn-primary" id="pAdd" disabled>Añadir</button></div>',
      (m) => {
        const upd = () => {
          const items = parseList($('#pText', m).value);
          const existing = new Set(S.guests.map((g) => norm(g.name)));
          const prev = $('#pPrev', m);
          prev.hidden = !items.length;
          const fresh = items.filter((i) => !existing.has(norm(i.name)));
          prev.innerHTML = items.map((i) => '<div>' + (existing.has(norm(i.name)) ? '⏭ <s>' : '✓ ') + '<b>' + esc(i.name) + '</b>' + (existing.has(norm(i.name)) ? '</s> <span class="muted">(ya está)</span>' : '') + ' · ' + i.invited + (i.invited > 1 ? ' lugares' : ' lugar') + (i.phone ? ' · 📱' + esc(i.phone) : '') + (i.group ? ' · 🏷 ' + esc(i.group) : '') + '</div>').join('');
          const ppl = fresh.reduce((a, i) => a + i.invited, 0);
          $('#pAdd', m).disabled = !fresh.length;
          $('#pAdd', m).textContent = fresh.length ? 'Añadir ' + fresh.length + ' (' + ppl + ' personas)' : 'Añadir';
          return fresh;
        };
        $('#pText', m).addEventListener('input', upd);
        $('#pCancel', m).onclick = closeModal;
        $('#pAdd', m).onclick = () => {
          const fresh = upd();
          const g0 = $('#pGroup', m).value.trim();
          const now = new Date().toISOString();
          const list = fresh.map((i) => ({ id: B.newId(), name: i.name, group: i.group || g0, phone: i.phone, email: '', invited: i.invited, status: 'pendiente', companions: 0, companionNames: '', diet: '', comments: '', cabin: '', song: '', source: 'lista', invitedAt: '', updated: now, change: '', notes: '' }));
          closeModal();
          saveGuests(list, true).then(() => B.toast('Añadidos ' + list.length + ' invitados ✓ Ya aparecen en el plano de mesas.', 'ok', 4500));
        };
      });
  }

  /* -------------------- Exportar -------------------- */
  function exportRows() {
    return S.guests.map((g) => ({
      'Nombre': g.name, 'Grupo / Familia': g.group, 'Asistencia': STATUS_LABEL[g.status], 'Lugares asignados': +g.invited || 1,
      'Personas confirmadas': g.status === 'si' ? partySize(g) : 0, 'Acompañantes': g.companionNames, 'Restricciones alimentarias': g.diet,
      'Comentarios': g.comments, 'Canción': g.song, 'Teléfono': g.phone, 'Email': g.email, 'Cabaña': g.cabin || '', 'Mesa(s)': guestTables(g).join(', '),
      'Origen': g.source === 'web' ? 'Web' : 'Lista', 'Invitación enviada': g.invitedAt ? 'Sí' : 'No', 'Cambio de respuesta': g.change, 'Última actualización': g.updated ? new Date(g.updated).toLocaleString('es-MX') : ''
    }));
  }

  function peopleRows() {
    const rows = [];
    S.guests.forEach((g) => {
      const att = B.attendingIdx(g);
      B.members(g).forEach((nm, i) => {
        const r = tableOf(g.id + '#' + i);
        const st = g.status === 'si' ? (att.includes(i) ? 'Confirmado' : 'No asiste') : STATUS_LABEL[g.status];
        rows.push({ 'Persona': nm, 'Invitación de': g.name, 'Categoría': g.group, 'Asistencia': st, 'Mesa': r ? r.table.name : '', 'Asiento': r ? r.seat + 1 : '', 'Restricciones': i === 0 ? g.diet : '' });
      });
    });
    return rows;
  }

  function fileBase() { return 'Boda-' + S.config.name1 + '-y-' + S.config.name2 + '-' + new Date().toISOString().slice(0, 10); }

  function exportList(kind) {
    $('#exportMenu').hidden = true;
    const rows = exportRows();
    if (kind === 'csv') {
      const cols = Object.keys(rows[0] || { Nombre: '' });
      const csv = '﻿' + [cols.join(',')].concat(rows.map((r) => cols.map((c) => '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"').join(','))).join('\n');
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileBase() + '.csv');
      return;
    }
    if (kind === 'xlsx') {
      if (!window.XLSX) { B.toast('Cargando Excel… intenta de nuevo en un segundo', 'warn'); return; }
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(rows); ws1['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.min(40, Math.max(12, k.length + 2)) }));
      XLSX.utils.book_append_sheet(wb, ws1, 'Invitaciones');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleRows()), 'Personas y mesas');
      const tRows = [];
      S.plan.tables.forEach((t) => {
        const occ = window.Plano.occupancy()[t.id] || [];
        for (let s = 0; s < t.seats; s++) {
          const k = occ[s]; const g = k && S.guests.find((x) => x.id === k.split('#')[0]);
          tRows.push({ Mesa: t.name, Asiento: s + 1, Invitado: g ? memberName(g, +k.split('#')[1]) : '', 'Grupo / Familia': g ? g.group : '' });
        }
      });
      if (tRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tRows), 'Mesas');
      XLSX.writeFile(wb, fileBase() + '.xlsx');
      return;
    }
    if (kind === 'pdf') {
      if (!window.jspdf) { B.toast('Cargando PDF… intenta de nuevo en un segundo', 'warn'); return; }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const yes = S.guests.filter((g) => g.status === 'si');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('Lista de invitados · ' + S.config.name1 + ' & ' + S.config.name2, 40, 44);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(B.formatLongDate(S.config) + ' · ' + S.config.venueName + '   |   Confirmados: ' + yes.reduce((a, g) => a + partySize(g), 0) + ' personas · Invitaciones: ' + S.guests.length + ' · Generado: ' + new Date().toLocaleString('es-MX'), 40, 62);
      const cols = ['Nombre', 'Grupo / Familia', 'Asistencia', 'Personas confirmadas', 'Acompañantes', 'Restricciones alimentarias', 'Mesa(s)', 'Comentarios'];
      doc.autoTable({
        startY: 76, head: [cols], body: rows.map((r) => cols.map((c) => String(r[c] == null ? '' : r[c]))),
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' }, headStyles: { fillColor: [154, 123, 79] },
        alternateRowStyles: { fillColor: [249, 245, 238] }, columnStyles: { 0: { cellWidth: 110 }, 4: { cellWidth: 130 }, 7: { cellWidth: 130 } }
      });
      doc.save(fileBase() + '.pdf');
    }
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* -------------------- Compartir -------------------- */
  function renderShare() {
    const url = B.siteBaseUrl(S.config);
    $('#siteLink').value = url;
    $('#copyLink').onclick = async () => { await B.copyText(url); B.toast('Enlace copiado ✓', 'ok'); };
    const text = '💍 ¡' + S.config.name1 + ' & ' + S.config.name2 + ' nos casamos! Detalles y confirmación aquí:';
    const L = B.shareLinks(url, text);
    const items = [['whatsapp', 'WhatsApp', '#25D366', 'W'], ['telegram', 'Telegram', '#2AABEE', 'T'], ['sms', 'SMS', '#6b7280', '✉'], ['email', 'Email', '#9a7b4f', '@'], ['facebook', 'Facebook', '#1877F2', 'f'], ['x', 'X', '#111', '𝕏']];
    $('#shareRowAdmin').innerHTML = items.map(([k, l, c, i]) => '<a class="share-btn" target="_blank" rel="noopener" href="' + esc(L[k]) + '"><i style="background:' + c + '">' + i + '</i>' + l + '</a>').join('') +
      (navigator.share ? '<button class="share-btn" id="nativeShare"><i style="background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af)">↗</i>Instagram y más</button>' : '');
    if ($('#nativeShare')) $('#nativeShare').onclick = () => navigator.share({ title: S.config.name1 + ' & ' + S.config.name2, text, url }).catch(() => {});

    const f = S.sendFilter;
    const list = S.guests.filter((g) => f === 'all' || (f === 'unsent' ? !g.invitedAt : f === 'sent' ? !!g.invitedAt : g.status === 'pendiente'))
      .sort((a, b) => (f === 'sent' ? String(b.invitedAt).localeCompare(String(a.invitedAt)) : 0) || a.name.localeCompare(b.name));
    const sentN = S.guests.filter((g) => g.invitedAt).length;
    $('#sentSummary').innerHTML = '<b>' + sentN + '</b> de ' + S.guests.length + ' invitaciones enviadas por WhatsApp.';
    $('#sendList').innerHTML = list.length ? list.map((g) => '<div class="li"><div class="t"><b>' + esc(g.name) + '</b><small>' + (g.phone ? '📱 ' + esc(g.phone) : 'Sin teléfono: elegirás el contacto en WhatsApp') + (g.invitedAt ? ' · ✓ enviada ' + esc(fmtDate(g.invitedAt)) : '') + ' · ' + STATUS_LABEL[g.status] + '</small></div>' +
      '<div class="gactions">' + (g.invitedAt ? '<button class="btn btn-sm" data-unsent="' + g.id + '" title="Marcar como NO enviada">↺</button>' : '<button class="btn btn-sm" data-mark="' + g.id + '" title="Ya se la mandé por otro lado: marcar como enviada">✓</button>') +
      '<button class="btn btn-sm" data-copy="' + g.id + '" title="Copiar enlace personal">⧉</button><button class="btn btn-wa btn-sm" data-wa="' + g.id + '">' + (g.invitedAt ? 'Reenviar' : 'Enviar') + '</button></div></div>').join('')
      : '<div class="empty">¡Nada pendiente aquí! 🎉</div>';
    $$('#sendList [data-wa]').forEach((b) => { b.onclick = () => sendInvite(b.dataset.wa); });
    $$('#sendList [data-mark]').forEach((b) => { b.onclick = () => { const g = S.guests.find((x) => x.id === b.dataset.mark); saveGuests(Object.assign({}, g, { invitedAt: new Date().toISOString() }), true); }; });
    $$('#sendList [data-unsent]').forEach((b) => { b.onclick = () => { const g = S.guests.find((x) => x.id === b.dataset.unsent); saveGuests(Object.assign({}, g, { invitedAt: '' }), true); }; });
    $$('#sendList [data-copy]').forEach((b) => { b.onclick = async () => { const g = S.guests.find((x) => x.id === b.dataset.copy); await B.copyText(B.fillTemplate(S.config, S.config.inviteTemplate, g)); B.toast('Mensaje con enlace copiado ✓', 'ok'); }; });
    $$('#sendFilters button').forEach((b) => { b.onclick = () => { S.sendFilter = b.dataset.s; $$('#sendFilters button').forEach((x) => x.classList.toggle('on', x === b)); renderShare(); }; });
  }

  /* -------------------- Ajustes -------------------- */
  function renderSettings() {
    const form = $('#settingsForm');
    const sections = [];
    B.FIELDS.forEach(([sec, key, label, type, help]) => {
      let s = sections.find((x) => x.name === sec);
      if (!s) { s = { name: sec, html: '' }; sections.push(s); }
      const v = S.config[key] == null ? '' : S.config[key];
      if (type === 'hidden') { s.html += '<input type="hidden" name="' + key + '" value="' + esc(v) + '">'; return; }
      if (type === 'palette') {
        s.html += '<div class="frow"><span>' + esc(label) + '</span><div class="palettes">' + B.PALETTES.map((pl, i) =>
          '<button type="button" class="pal" data-pal="' + i + '" title="' + esc(pl.name) + '">' +
          '<i style="background:' + pl.colorBg + '"></i><i style="background:' + pl.theme + '"></i><i style="background:' + pl.colorNature + '"></i><i style="background:' + pl.colorText + '"></i>' +
          '<small>' + esc(pl.name) + '</small></button>').join('') + '</div>' + (help ? '<small>' + esc(help) + '</small>' : '') + '</div>';
        return;
      }
      if (type === 'range') {
        const n = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
        s.html += '<label class="frow"><span>' + esc(label) + ': <b data-rangeval="' + key + '">' + n + '</b></span>' +
          '<input type="range" min="0" max="100" step="1" name="' + key + '" value="' + n + '" oninput="this.form.querySelector(\'[data-rangeval=' + key + ']\').textContent=this.value">' +
          (help ? '<small>' + esc(help) + '</small>' : '') + '</label>';
        return;
      }
      if (type === 'list') {
        s.html += '<div class="frow"><span>' + esc(label) + '</span><input type="hidden" name="' + key + '" value="' + esc(v) + '">' +
          '<div class="list-field" data-list="' + key + '"></div>' + (help ? '<small>' + esc(help) + '</small>' : '') + '</div>';
        return;
      }
      if (type === 'image' || type === 'gallery') {
        s.html += '<div class="frow"><span>' + esc(label) + '</span><input type="hidden" name="' + key + '" value="' + esc(v) + '">' +
          '<div class="photo-field" data-photo="' + key + '" data-multi="' + (type === 'gallery' ? '1' : '') + '"></div>' + (help ? '<small>' + esc(help) + '</small>' : '') + '</div>';
        return;
      }
      const input = type === 'textarea'
        ? '<textarea name="' + key + '" rows="' + (key === 'story' ? 6 : 3) + '">' + esc(v) + '</textarea>'
        : '<input name="' + key + '" type="' + type + '" value="' + esc(v) + '">';
      s.html += '<label class="frow"><span>' + esc(label) + '</span>' + input + (help ? '<small>' + esc(help) + '</small>' : '') + '</label>';
    });
    form.innerHTML = sections.map((s) => '<fieldset><legend>' + esc(s.name) + '</legend>' + s.html + '</fieldset>').join('') +
      '<div class="save-bar"><button class="btn btn-primary" type="submit">Guardar cambios</button></div>';
    form.dataset.ready = '1';
    $$('[data-photo]', form).forEach(renderPhotoField);
    $$('[data-list]', form).forEach(renderListField);
    // Paletas: llenan los colores para que los veas; se guardan con "Guardar cambios"
    const COLOR_KEYS = ['theme', 'colorBg', 'colorCard', 'colorText', 'colorNature'];
    const previewColors = () => { const o = {}; COLOR_KEYS.forEach((k) => { if (form.elements[k]) o[k] = form.elements[k].value; }); B.applyTheme(o); };
    $$('[data-pal]', form).forEach((b) => {
      b.onclick = () => {
        const pl = B.PALETTES[+b.dataset.pal];
        COLOR_KEYS.forEach((k) => { if (form.elements[k]) form.elements[k].value = pl[k]; });
        previewColors();
        $$('[data-pal]', form).forEach((x) => x.classList.toggle('on', x === b));
        B.toast('Paleta “' + esc(pl.name) + '” lista. Pulsa <b>Guardar cambios</b> para aplicarla en la web.', 'info', 3500);
      };
    });
    COLOR_KEYS.forEach((k) => { if (form.elements[k]) form.elements[k].addEventListener('input', previewColors); });
    // Fecha límite: al elegirla en el calendario se escribe (o se cambia) dentro del mensaje para quienes no asisten
    const dl = form.elements.declineDeadline, dm = form.elements.declineMessage;
    if (dl && dm) {
      const fmt = (iso) => { const d = new Date(iso + 'T12:00'); return isNaN(d) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }); };
      const RX = /\s*antes del \d{1,2} de [a-záéíóúñ]+ de \d{4}/i;
      dl.addEventListener('change', () => {
        let msg = dm.value;
        const txt = dl.value ? fmt(dl.value) : '';
        if (!txt) { dm.value = msg.replace(RX, ''); return; }
        if (RX.test(msg)) msg = msg.replace(RX, ' antes del ' + txt);
        else if (/puedes actualizar tu respuesta/i.test(msg)) msg = msg.replace(/puedes actualizar tu respuesta/i, '$& antes del ' + txt);
        else msg = msg.trim() + ' Puedes cambiar tu respuesta antes del ' + txt + '.';
        dm.value = msg;
        B.toast('Fecha agregada al mensaje. Pulsa <b>Guardar cambios</b>.', 'info', 2600);
      });
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {};
      B.FIELDS.forEach(([, key]) => { if (key[0] !== '_' && form.elements[key]) data[key] = form.elements[key].value; });
      if (!data.adminPin) { B.toast('La clave no puede quedar vacía', 'warn'); return; }
      const r = await B.api('admin_config', { key: S.key, config: data });
      if (r && r.ok) {
        S.config = B.withDefaults(r.config || data);
        if (data.adminPin !== S.key) {
          let remembered = false;
          try { remembered = !!localStorage.getItem(KEY_STORE); } catch (e) { /* nada */ }
          S.key = data.adminPin; storeKey(S.key, remembered);
        }
        B.applyTheme(S.config);
        B.toast('Ajustes guardados ✓ La web de la boda ya está actualizada.', 'ok');
        renderAll(true);
      } else B.toast('No se pudieron guardar los ajustes', 'error');
    };

    const demo = B.isDemo();
    $('#connPanel').innerHTML = '<h3>' + (demo ? '🧪 Modo demostración' : '✅ Conectado a Google Sheets') + '</h3>' +
      (demo
        ? '<p class="small">Ahora mismo los datos se guardan solo en este navegador para que puedas probar todo. Para conectar tu Google Sheets:</p>' +
          '<ol class="steps small"><li>Abre tu hoja → <b>Extensiones → Apps Script</b>.</li><li>Pega el código del archivo <code>apps-script/Codigo.gs</code> y guarda.</li><li>Ejecuta la función <b>configurarHoja</b> (importa tu pestaña “Invitados” sin modificarla).</li><li><b>Implementar → Nueva implementación → Aplicación web</b> · Ejecutar como: Yo · Acceso: Cualquier persona.</li><li>Copia la URL <code>…/exec</code> y ponla en <code>js/config.js</code>.</li></ol>' +
          '<button class="btn btn-danger btn-sm" id="resetDemo" type="button">Reiniciar datos de demostración</button>'
        : '<p class="small">Las confirmaciones llegan solas a las pestañas <b>App Invitados</b> y <b>App Mesas</b> de tu hoja. Esta pantalla se actualiza cada 15 segundos.</p>');
    if ($('#resetDemo')) $('#resetDemo').onclick = async () => { if (await confirmBox('Reiniciar demo', 'Se borrarán los datos de prueba de este navegador.', 'Reiniciar', true)) { B.demoReset(); location.reload(); } };
  }

  /* -------------------- Fotos: subir desde el celular o la compu -------------------- */
  // Reduce la foto en el navegador (más rápida de cargar) y la sube a Google Drive vía Apps Script
  function shrinkImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
      img.src = url;
    });
  }

  async function uploadPhoto(file, big) {
    const demo = B.isDemo();
    // En demostración las fotos se guardan dentro del navegador, más pequeñas para que quepan
    const data = await shrinkImage(file, demo ? (big ? 1400 : 900) : (big ? 2200 : 1600), demo ? 0.7 : 0.84);
    if (demo) return data;
    const r = await B.api('admin_upload', { key: S.key, name: file.name, data });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Error al subir');
    return r.url;
  }

  async function savePhotoConfig(key, value) {
    const r = await B.api('admin_config', { key: S.key, config: { [key]: value } });
    if (!r || !r.ok) throw new Error('No se guardó');
    S.config[key] = value;
  }

  // Punto de enfoque de la portada: tocas las caras y la foto se recorta alrededor de ese punto
  function drawFocus(box, url) {
    const form = $('#settingsForm');
    const input = form.elements.heroFocus;
    const cur = (input && input.value) || S.config.heroFocus || '50% 30%';
    const [fx, fy] = cur.split(/\s+/);
    const bg = 'background-image:url(&quot;' + esc(url) + '&quot;);background-position:' + esc(cur);
    box.insertAdjacentHTML('beforeend',
      '<div class="focus-ui"><p class="small"><b>¿Se cortan las caras?</b> Toca en la foto justo entre sus caras: la portada se acomodará para que siempre se vean.</p>' +
      '<div class="focus-pick"><img src="' + esc(url) + '" alt="Foto de portada"><span class="focus-dot" style="left:' + esc(fx) + ';top:' + esc(fy) + '"></span></div>' +
      '<div class="focus-prev"><figure><div class="fp desk" style="' + bg + '"></div><figcaption>Computadora</figcaption></figure>' +
      '<figure><div class="fp phone" style="' + bg + '"></div><figcaption>Celular</figcaption></figure></div></div>');
    const img = $('.focus-pick img', box);
    // Las vistas previas usan el mismo cálculo que la web (caras centradas arriba de las montañas)
    const placePreviews = (val) => {
      if (!img.naturalWidth) return;
      $$('.fp', box).forEach((d) => { d.style.backgroundPosition = B.focusPosition(val, img.naturalWidth, img.naturalHeight, d.clientWidth, d.clientHeight, 0.5, 0.36); });
    };
    if (img.complete) placePreviews(cur); else img.onload = () => placePreviews(cur);
    img.onclick = async (e) => {
      const r = img.getBoundingClientRect();
      const x = Math.round(((e.clientX - r.left) / r.width) * 100);
      const y = Math.round(((e.clientY - r.top) / r.height) * 100);
      const val = Math.max(0, Math.min(100, x)) + '% ' + Math.max(0, Math.min(100, y)) + '%';
      if (input) input.value = val;
      $('.focus-dot', box).style.left = x + '%';
      $('.focus-dot', box).style.top = y + '%';
      placePreviews(val);
      try { await savePhotoConfig('heroFocus', val); B.toast('Enfoque guardado ✓ Ya se ve así en la web', 'ok', 2200); } catch (err) { B.toast('No se pudo guardar el enfoque', 'error'); }
    };
  }

  /* ---- Listas editables: fotos de vestimenta, recomendaciones y preguntas frecuentes ---- */
  const LIST_SCHEMAS = {
    dressExamples: { add: '＋ Agregar ejemplo', item: 'Ejemplo', fields: [['image', 'Foto', 'image'], ['title', 'Título', 'text', 'Ej. Ellas'], ['text', 'Descripción', 'textarea', 'Ej. Vestido largo en tonos tierra y un abrigo ligero']] },
    recommendations: { add: '＋ Agregar recomendación', item: 'Recomendación', fields: [['image', 'Foto', 'image'], ['title', 'Título', 'text', 'Ej. Restaurante La Cabaña'], ['text', 'Descripción', 'textarea', 'Ej. A 5 minutos del salón; buen lugar para desayunar el domingo'], ['url', 'Ubicación (enlace de Google Maps, opcional)', 'url', 'https://maps.app.goo.gl/…']] },
    faq: { add: '＋ Agregar pregunta', item: 'Pregunta', fields: [['q', 'Pregunta', 'text', 'Ej. ¿Hay transporte de la iglesia al salón?'], ['a', 'Respuesta', 'textarea', 'Ej. Sí, saldrá un camión a las 18:15 desde la iglesia.']] }
  };

  function renderListField(box) {
    const key = box.dataset.list;
    const schema = LIST_SCHEMAS[key];
    const hidden = $('input[name="' + key + '"]', box.parentNode);
    let items = B.parseItems(hidden.value);
    const sync = () => { hidden.value = items.length ? JSON.stringify(items) : ''; };
    const draw = () => {
      box.innerHTML = items.map((it, i) => '<div class="li-item"><div class="li-head"><b>' + esc(schema.item) + ' ' + (i + 1) + '</b>' +
        '<span><button type="button" class="btn btn-sm" data-up="' + i + '" title="Subir"' + (i ? '' : ' disabled') + '>↑</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-rm="' + i + '" title="Quitar">✕</button></span></div>' +
        schema.fields.map(([f, label, type, ph]) => {
          const val = it[f] || '';
          if (type === 'image') {
            return '<div class="li-img">' + (val ? '<img src="' + esc(val) + '" alt="">' : '<div class="li-noimg">Sin foto</div>') +
              '<label class="btn btn-sm">' + (val ? 'Cambiar foto' : 'Subir foto') + '<input type="file" accept="image/*" hidden data-img="' + i + '"></label>' +
              (val ? '<button type="button" class="btn btn-sm" data-noimg="' + i + '">Quitar foto</button>' : '') + '</div>';
          }
          const ctrl = type === 'textarea'
            ? '<textarea rows="2" data-f="' + f + '" data-i="' + i + '" placeholder="' + esc(ph || '') + '">' + esc(val) + '</textarea>'
            : '<input type="' + (type === 'url' ? 'url' : 'text') + '" data-f="' + f + '" data-i="' + i + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '">';
          return '<label class="li-f"><span>' + esc(label) + '</span>' + ctrl + '</label>';
        }).join('') + '</div>').join('') +
        '<button type="button" class="btn" data-add>' + esc(schema.add) + '</button>';
      $$('[data-f]', box).forEach((el) => { el.oninput = () => { items[+el.dataset.i][el.dataset.f] = el.value; sync(); }; });
      $('[data-add]', box).onclick = () => { items.push({}); sync(); draw(); const last = $$('.li-item', box).slice(-1)[0]; if (last) { const f = $('input[type=text], textarea', last); if (f) f.focus(); } };
      $$('[data-rm]', box).forEach((b) => { b.onclick = () => { items.splice(+b.dataset.rm, 1); sync(); draw(); B.toast('Quitado. Pulsa <b>Guardar cambios</b>.', 'info', 2000); }; });
      $$('[data-up]', box).forEach((b) => { b.onclick = () => { const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; sync(); draw(); }; });
      $$('[data-noimg]', box).forEach((b) => { b.onclick = () => { items[+b.dataset.noimg].image = ''; sync(); draw(); }; });
      $$('[data-img]', box).forEach((inp) => {
        inp.onchange = async () => {
          const file = inp.files && inp.files[0];
          if (!file) return;
          box.classList.add('busy');
          B.toast('Subiendo foto…', 'info', 2000);
          try {
            items[+inp.dataset.img].image = await uploadPhoto(file, false);
            sync();
            await savePhotoConfig(key, hidden.value); // la foto queda guardada de inmediato
            B.toast('Foto lista ✓', 'ok', 1800);
          } catch (e) { B.toast('No se pudo subir: ' + esc(e.message), 'error', 5000); }
          box.classList.remove('busy');
          draw();
        };
      });
    };
    draw();
  }

  function renderPhotoField(box) {
    const key = box.dataset.photo, multi = !!box.dataset.multi;
    const hidden = $('input[name="' + key + '"]', box.parentNode);
    const list = () => String(hidden.value || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const draw = () => {
      const items = list();
      box.innerHTML = '<div class="photo-grid' + (multi ? '' : ' single') + '">' +
        items.map((u, i) => '<div class="ph"><img src="' + esc(u) + '" alt="">' +
          (multi && i > 0 ? '<button type="button" class="ph-btn left" data-left="' + i + '" title="Mover antes">‹</button>' : '') +
          '<button type="button" class="ph-btn del" data-del="' + i + '" title="Quitar">✕</button></div>').join('') +
        ((multi || !items.length) ? '<label class="ph add"><input type="file" accept="image/*"' + (multi ? ' multiple' : '') + ' hidden><span>＋</span><small>' + (multi ? 'Agregar fotos' : 'Subir foto') + '</small></label>' : '') +
        '</div>' + (!multi && items.length ? '<label class="btn btn-sm" style="margin-top:8px">Cambiar foto<input type="file" accept="image/*" hidden></label>' : '');
      if (key === 'heroImage' && items.length) drawFocus(box, items[0]);
      $$('input[type=file]', box).forEach((inp) => {
        inp.onchange = async () => {
          const files = Array.from(inp.files || []);
          if (!files.length) return;
          box.classList.add('busy');
          B.toast('Subiendo ' + (files.length > 1 ? files.length + ' fotos' : 'foto') + '…', 'info', 2500);
          try {
            const urls = [];
            for (const f of files) urls.push(await uploadPhoto(f, !multi));
            hidden.value = (multi ? list().concat(urls) : urls.slice(0, 1)).join('\n');
            await savePhotoConfig(key, hidden.value);
            B.toast('¡Listo! Ya se ve en la web ✓', 'ok');
          } catch (e) {
            B.toast(B.isDemo() ? 'No cupo la foto en la demostración. Prueba con menos fotos.' : 'No se pudo subir: ' + esc(e.message), 'error', 5000);
          }
          box.classList.remove('busy');
          draw();
        };
      });
      $$('[data-del]', box).forEach((b) => {
        b.onclick = async () => {
          const items = list(); items.splice(+b.dataset.del, 1);
          hidden.value = items.join('\n');
          try { await savePhotoConfig(key, hidden.value); B.toast('Foto quitada', 'ok', 1500); } catch (e) { B.toast('No se pudo guardar', 'error'); }
          draw();
        };
      });
      $$('[data-left]', box).forEach((b) => {
        b.onclick = async () => {
          const items = list(), i = +b.dataset.left;
          [items[i - 1], items[i]] = [items[i], items[i - 1]];
          hidden.value = items.join('\n');
          try { await savePhotoConfig(key, hidden.value); } catch (e) { /* nada */ }
          draw();
        };
      });
    };
    draw();
  }

  /* -------------------- API para el plano -------------------- */
  window.Admin = {
    state: S, saveGuests, savePlan, openGuest, confirmBox, openModal, closeModal, ackChange, showTab, renderAll, downloadBlob, fileBase
  };

  /* -------------------- Arranque -------------------- */
  setupGuestUi();
  $('#demoHint').hidden = !B.isDemo();
  $('#loginForm').onsubmit = (e) => { e.preventDefault(); const k = $('#pin').value.trim(); if (k) login(k, false); };
  $('#btnLogout').onclick = () => { storeKey(''); location.hash = ''; location.reload(); };
  $('#btnRefresh').onclick = async () => { await loadAll(); B.toast('Actualizado ✓', 'ok', 1500); };
  window.addEventListener('beforeunload', (e) => { if (S.planDirty) { e.preventDefault(); e.returnValue = ''; } });
  // Si guardaste la clave en este dispositivo, entra solo (sin mostrar el recuadro mientras tanto)
  const k = storedKey();
  if (k) { $('#loginWait').hidden = false; $('#loginFields').hidden = true; login(k, true); }
  else showLoginForm();
})();
