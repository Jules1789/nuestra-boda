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
  function storedKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function storeKey(k) { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) { /* nada */ } }

  async function login(key, silent) {
    try {
      const r = await B.api('admin_login', { key });
      if (r && r.ok) { S.key = key; storeKey(key); await start(); return true; }
      if (!silent) B.toast('Clave incorrecta', 'error');
    } catch (e) {
      if (!silent) B.toast('No se pudo conectar con Google Sheets. Revisa la URL en config.js.', 'error', 6000);
    }
    return false;
  }

  async function start() {
    $('#loginForm button').textContent = 'Cargando…';
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
    return { tables: Array.isArray(p.tables) ? p.tables : [], seats: p.seats && typeof p.seats === 'object' ? p.seats : {}, updated: p.updated || '' };
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
    $('#guestList').innerHTML = list.length ? list.map((g) => {
      const tables = guestTables(g);
      return '<div class="gcard' + (g.change ? ' changed' : '') + '">' + avatar(g) +
        '<div class="gmain" data-edit="' + g.id + '"><b>' + esc(g.name) + '</b> <span class="pill ' + g.status + '">' + STATUS_LABEL[g.status] + '</span>' +
        (g.source === 'web' ? ' <span class="pill web">web</span>' : '') + (g.change ? ' <span class="pill warn">cambió</span>' : '') +
        '<div class="gmeta"><span>👥 ' + (g.status === 'si' ? partySize(g) + ' confirmados' : g.status === 'no' ? '0 de ' + g.invited : g.invited + ' lugares') + '</span>' +
        (g.group ? '<span>🏷 ' + esc(g.group) + '</span>' : '') +
        (tables.length ? '<span>🪑 ' + esc(tables.join(', ')) + '</span>' : '') +
        (g.diet ? '<span>🍽 ' + esc(g.diet) + '</span>' : '') +
        (g.cabin ? '<span>🏡 ' + esc(g.cabin) + '</span>' : '') +
        (g.invitedAt ? '<span>✓ invitación enviada</span>' : '') +
        (g.change ? '<span style="color:var(--warn)">' + esc(g.change) + '</span>' : '') +
        '</div></div>' +
        '<div class="gactions"><button class="btn btn-wa btn-sm" data-wa="' + g.id + '" title="Enviar invitación por WhatsApp">WhatsApp</button></div></div>';
    }).join('') : '<p class="muted">No hay invitados con este filtro.</p>';
    $$('#guestList [data-edit]').forEach((el) => { el.onclick = () => openGuest(el.dataset.edit); });
    $$('#guestList [data-wa]').forEach((el) => { el.onclick = () => sendInvite(el.dataset.wa); });
  }

  function setupGuestUi() {
    $('#gSearch').addEventListener('input', renderGuests);
    $('#gGroupFilter').addEventListener('change', renderGuests);
    $$('#gFilters button').forEach((b) => {
      b.onclick = () => { S.filter = b.dataset.f; $$('#gFilters button').forEach((x) => x.classList.toggle('on', x === b)); renderGuests(); };
    });
    $('#btnAddGuest').onclick = () => openGuest(null);
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

  function openGuest(id) {
    const g = id ? S.guests.find((x) => x.id === id) : null;
    const v = g || { id: '', name: '', group: '', phone: '', email: '', invited: 1, status: 'pendiente', companions: 0, companionNames: '', diet: '', comments: '', cabin: '', song: '', notes: '', source: 'lista', invitedAt: '', change: '' };
    const groups = Array.from(new Set(S.guests.map((x) => x.group).filter(Boolean))).sort();
    const tables = g ? guestTables(g) : [];
    openModal(
      '<h3>' + (g ? esc(g.name) : 'Nuevo invitado') + '</h3>' +
      (g && g.change ? '<div class="alert">⚠️ ' + esc(g.change) + '</div>' : '') +
      '<div class="form-grid">' +
      '<label class="full"><span>Nombre (quien recibe la invitación)</span><input id="eName" value="' + esc(v.name) + '"></label>' +
      '<label><span>Grupo / Familia</span><input id="eGroup" list="grpList" value="' + esc(v.group) + '"><datalist id="grpList">' + groups.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist></label>' +
      '<label><span>Lugares asignados (incluyéndole)</span><input id="eInvited" type="number" min="1" max="30" value="' + (v.invited || 1) + '"></label>' +
      '<label><span>WhatsApp / teléfono</span><input id="ePhone" type="tel" value="' + esc(v.phone) + '"></label>' +
      '<label><span>Email</span><input id="eEmail" type="email" value="' + esc(v.email) + '"></label>' +
      '<label><span>Asistencia</span><select id="eStatus">' + ['pendiente', 'si', 'no'].map((s) => '<option value="' + s + '"' + (v.status === s ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>').join('') + '</select></label>' +
      '<label><span>Acompañantes confirmados</span><input id="eComp" type="number" min="0" max="29" value="' + (v.companions || 0) + '"></label>' +
      '<label class="full"><span>Nombres de acompañantes (separados por coma)</span><textarea id="eCompNames" rows="2">' + esc(v.companionNames) + '</textarea></label>' +
      '<label class="full"><span>Restricciones alimentarias</span><input id="eDiet" value="' + esc(v.diet) + '"></label>' +
      '<label><span>Cabaña</span><input id="eCabin" value="' + esc(v.cabin || '') + '"></label>' +
      '<label><span>Canción sugerida</span><input id="eSong" value="' + esc(v.song || '') + '"></label>' +
      '<label class="full"><span>Comentarios del invitado</span><textarea id="eComments" rows="2">' + esc(v.comments) + '</textarea></label>' +
      '<label class="full"><span>Notas privadas (solo ustedes)</span><textarea id="eNotes" rows="2">' + esc(v.notes) + '</textarea></label>' +
      '</div>' +
      (g ? '<p class="muted small">' + (tables.length ? '🪑 Sentado en: ' + esc(tables.join(', ')) + ' · ' : '') + 'Enlace personal: <code>' + esc(B.guestLink(S.config, g)) + '</code></p>' : '') +
      '<div class="modal-actions">' +
      (g ? '<button class="btn btn-danger" id="eDel">Eliminar</button>' : '') +
      (g ? '<button class="btn" id="eCopy">Copiar enlace</button>' : '') +
      (g ? '<button class="btn btn-wa" id="eWa">WhatsApp</button>' : '') +
      '<span class="spacer"></span>' +
      (g && g.change ? '<button class="btn" id="eAck">✓ Cambio revisado</button>' : '') +
      '<button class="btn btn-primary" id="eSave">Guardar</button></div>',
      (m) => {
        $('#eSave', m).onclick = () => {
          const name = $('#eName', m).value.trim();
          if (!name) { B.toast('Escribe un nombre', 'warn'); return; }
          const status = $('#eStatus', m).value;
          const invited = Math.max(1, parseInt($('#eInvited', m).value, 10) || 1);
          let comp = Math.max(0, parseInt($('#eComp', m).value, 10) || 0);
          if (status !== 'si') comp = status === 'no' ? 0 : comp;
          const ng = Object.assign({}, v, {
            id: v.id || B.newId(), name, group: $('#eGroup', m).value.trim(), invited, phone: $('#ePhone', m).value.trim(), email: $('#eEmail', m).value.trim(),
            status, companions: comp, companionNames: $('#eCompNames', m).value.trim(), diet: $('#eDiet', m).value.trim(), cabin: $('#eCabin', m).value.trim(),
            song: $('#eSong', m).value.trim(), comments: $('#eComments', m).value.trim(), notes: $('#eNotes', m).value.trim(), updated: v.updated || new Date().toISOString()
          });
          closeModal();
          saveGuests(ng);
        };
        if (g) {
          $('#eDel', m).onclick = async () => { if (await confirmBox('Eliminar invitado', '¿Seguro que quieres eliminar a <b>' + esc(g.name) + '</b>? Se liberarán sus asientos.', 'Eliminar', true)) deleteGuests([g.id]); };
          $('#eCopy', m).onclick = async () => { await B.copyText(B.guestLink(S.config, g)); B.toast('Enlace copiado ✓', 'ok'); };
          $('#eWa', m).onclick = () => sendInvite(g.id);
          if ($('#eAck', m)) $('#eAck', m).onclick = () => { closeModal(); ackChange(g.id); };
        }
        $('#eStatus', m).onchange = () => { if ($('#eStatus', m).value === 'si' && !+$('#eComp', m).value) $('#eComp', m).value = Math.max(0, (+$('#eInvited', m).value || 1) - 1); };
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
      const n = Math.max(partySize(g), g.status === 'no' ? 0 : 1);
      for (let i = 0; i < n; i++) {
        const r = tableOf(g.id + '#' + i);
        rows.push({ 'Persona': memberName(g, i), 'Invitación de': g.name, 'Grupo / Familia': g.group, 'Asistencia': STATUS_LABEL[g.status], 'Mesa': r ? r.table.name : '', 'Asiento': r ? r.seat + 1 : '', 'Restricciones': i === 0 ? g.diet : '' });
      }
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
    const list = S.guests.filter((g) => f === 'all' || (f === 'unsent' ? !g.invitedAt : g.status === 'pendiente')).sort((a, b) => a.name.localeCompare(b.name));
    $('#sendList').innerHTML = list.length ? list.map((g) => '<div class="li"><div class="t"><b>' + esc(g.name) + '</b><small>' + (g.phone ? '📱 ' + esc(g.phone) : 'Sin teléfono: elegirás el contacto en WhatsApp') + (g.invitedAt ? ' · ✓ enviada' : '') + ' · ' + STATUS_LABEL[g.status] + '</small></div>' +
      '<div class="gactions"><button class="btn btn-sm" data-copy="' + g.id + '" title="Copiar enlace personal">⧉</button><button class="btn btn-wa btn-sm" data-wa="' + g.id + '">Enviar</button></div></div>').join('')
      : '<div class="empty">¡Nada pendiente aquí! 🎉</div>';
    $$('#sendList [data-wa]').forEach((b) => { b.onclick = () => sendInvite(b.dataset.wa); });
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
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {};
      B.FIELDS.forEach(([, key]) => { data[key] = form.elements[key].value; });
      if (!data.adminPin) { B.toast('La clave no puede quedar vacía', 'warn'); return; }
      const r = await B.api('admin_config', { key: S.key, config: data });
      if (r && r.ok) {
        S.config = B.withDefaults(r.config || data);
        if (data.adminPin !== S.key) { S.key = data.adminPin; storeKey(S.key); }
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
  $('#loginForm').onsubmit = (e) => { e.preventDefault(); login($('#pin').value.trim()); };
  $('#btnLogout').onclick = () => { storeKey(''); location.hash = ''; location.reload(); };
  $('#btnRefresh').onclick = async () => { await loadAll(); B.toast('Actualizado ✓', 'ok', 1500); };
  window.addEventListener('beforeunload', (e) => { if (S.planDirty) { e.preventDefault(); e.returnValue = ''; } });
  const k = storedKey();
  if (k) login(k, true);
})();
