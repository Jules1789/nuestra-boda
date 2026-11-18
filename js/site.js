/* Web pública de la boda */
(function () {
  'use strict';
  const B = window.Boda;
  const { $, $$, esc } = B;
  const params = new URLSearchParams(location.search);
  const guestId = params.get('g') || '';
  let cfg = B.withDefaults({});
  let guest = null;
  const pageUrl = () => B.siteBaseUrl(cfg);

  async function init() {
    // Enlace personal (?g=) o, si no, la invitación que respondió antes desde este celular
    const mem = !guestId ? remembered() : null;
    try {
      const res = await B.api('public', { g: guestId || (mem && mem.id) || '' });
      if (res && res.ok) { cfg = B.withDefaults(res.config); guest = res.guest || null; }
    } catch (e) {
      console.warn('No se pudo cargar la configuración', e);
    }
    render();
    startCountdown();
    setupRsvp(!!(mem && guest));
    setupNav();
    $('#loading').classList.add('out');
  }

  function setText(sel, txt) { const el = $(sel); if (el) el.textContent = txt || ''; }
  function showIf(sel, cond) { const el = $(sel); if (el) el.hidden = !cond; }

  function render() {
    B.applyTheme(cfg);
    document.title = cfg.name1 + ' & ' + cfg.name2 + ' · Nuestra boda';
    setText('#n1', cfg.name1); setText('#n2', cfg.name2);
    setText('#brand', (cfg.name1 || ' ')[0] + '&' + (cfg.name2 || ' ')[0]);
    setText('#footNames', cfg.name1 + ' & ' + cfg.name2);
    const longDate = B.formatLongDate(cfg);
    setText('#heroDate', longDate);
    setText('#heroPlace', cfg.ceremonyAddress || cfg.address || cfg.venueName);
    setText('#footDate', longDate);
    setText('#hashtag', cfg.hashtag);
    if (cfg.contactPhone) {
      const wa = B.waPhone(cfg.contactPhone, cfg.countryCode);
      $('#contact').innerHTML = '¿Dudas? <a href="https://wa.me/' + wa + '?text=' + encodeURIComponent('¡Hola ' + cfg.name1 + '! Tengo una duda sobre la boda: ') + '" target="_blank" rel="noopener">Escríbele a ' + esc(cfg.name1) + ' por WhatsApp</a>';
    }
    if (cfg.heroImage) {
      $('.hero').classList.add('has-photo');
      $('#heroBg').style.backgroundImage = 'url("' + cfg.heroImage.replace(/"/g, '%22') + '")';
      // Punto de enfoque elegido en el panel (normalmente las caras) para que no se corten
      const focus = /^\d{1,3}% \d{1,3}%$/.test(cfg.heroFocus || '') ? cfg.heroFocus : '50% 30%';
      const bgEl = $('#heroBg');
      bgEl.style.backgroundPosition = focus;
      bgEl.style.transformOrigin = focus;
      // Con el tamaño real de la foto, centramos las caras en la zona visible (arriba de las montañas)
      const probe = new Image();
      probe.onload = () => {
        const place = () => {
          const r = bgEl.getBoundingClientRect();
          const pos = B.focusPosition(focus, probe.naturalWidth, probe.naturalHeight, r.width, r.height, 0.5, 0.36);
          bgEl.style.backgroundPosition = pos;
          bgEl.style.transformOrigin = pos;
        };
        place();
        window.addEventListener('resize', place, { passive: true });
      };
      probe.src = cfg.heroImage;
    }

    // Saludo personalizado
    if (guest) {
      const first = guest.name.split(' ')[0];
      setText('#heroGreeting', first + ', ¡nos casamos!');
      const lugares = Math.max(1, guest.invited || 1);
      const note = $('#personalNote');
      note.hidden = false;
      note.innerHTML = 'Querid@ <b>' + esc(guest.name) + '</b>: ' +
        (lugares > 1 ? 'hemos reservado <b>' + lugares + ' lugares</b> para ti y los tuyos.' : 'hemos reservado <b>un lugar</b> especialmente para ti.');
    }

    const places = B.places(cfg);
    setText('#message', cfg.message);
    setText('#dWhen', longDate);

    setText('#dTime', places.map((p) => p.title + ': ' + p.time).join(' · '));
    $('#placeCards').innerHTML = places.map((p) => '<article class="card"><div class="ico">' + p.icon + '</div><h3>' + esc(p.title) + '</h3>' +
      (p.time ? '<p class="time">' + esc(p.time) + '</p>' : '') + '<p>' + esc(p.name || '') + '</p><p class="muted">' + esc(p.address || '') + '</p>' +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(B.mapsLink(p)) + '">📍 Cómo llegar</a></article>').join('');
    setText('#dDress', cfg.dressCode); showIf('#cardDress', cfg.dressCode);
    setText('#dLodging', cfg.lodging); showIf('#cardLodging', cfg.lodging || (guest && guest.cabin));
    setText('#dInstr', cfg.instructions); showIf('#cardInstr', cfg.instructions);
    setText('#dGifts', cfg.gifts); showIf('#cardGifts', cfg.gifts);
    if (guest && guest.cabin) { const c = $('#dCabin'); c.hidden = false; c.textContent = '🏡 Tu cabaña: ' + guest.cabin; }

    // Programa
    const lines = String(cfg.itinerary || '').split('\n').map((l) => l.trim()).filter(Boolean);
    $('#itinerary').innerHTML = lines.map((l) => {
      const [t, ...rest] = l.split('|');
      const what = rest.join('|').trim();
      return what
        ? '<div class="tl-item reveal"><div class="tl-time">' + esc(t.trim()) + '</div><div class="tl-what">' + esc(what) + '</div></div>'
        : '<div class="tl-item reveal"><div class="tl-time"></div><div class="tl-what">' + esc(t.trim()) + '</div></div>';
    }).join('');

    // Sin fecha todavía: se ocultan la cuenta regresiva, el calendario y "Cuándo"
    const hasDate = !!B.eventDates(cfg).start;
    showIf('#countdown', hasDate); showIf('#calendario', hasDate); showIf('#cardWhen', hasDate);
    showIf('.hero-cta a[href="#calendario"]', hasDate);
    // Sin lugares todavía: se oculta "Cómo llegar"
    showIf('#ubicacion', places.length);

    // Calendario
    const url = pageUrl();
    if (hasDate) {
    $('#calGoogle').href = B.googleCalUrl(cfg, url);
    $('#calOutlook').href = B.outlookUrl(cfg, url, false);
    $('#calOffice').href = B.outlookUrl(cfg, url, true);
    $('#calApple').href = B.icsDataUrl(cfg, url);
    $('#calApple').download = 'Boda-' + cfg.name1 + '-y-' + cfg.name2 + '.ics';
    }

    // Mapa
    $('#places').innerHTML = places.map((p, i) => '<div class="place">' +
      '<h3><span>' + p.icon + '</span> ' + esc(p.title) + (p.time ? ' · ' + esc(p.time) : '') + '</h3>' +
      '<p class="muted">' + esc([p.name, p.address].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="map-wrap"><iframe title="Mapa: ' + esc(p.title) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' + esc(B.mapEmbed(p)) + '"></iframe></div>' +
      '<div class="map-buttons"><a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(B.mapsLink(p)) + '">Abrir en Google Maps</a>' +
      '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(B.wazeLink(p)) + '">Waze</a>' +
      '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(B.appleMapsLink(p)) + '">Apple Maps</a></div>' +
      (i < places.length - 1 ? '<p class="between">De la iglesia a la fiesta: ' + esc(places[i + 1].time ? 'te esperamos a las ' + places[i + 1].time : '') + '</p>' : '') +
      '</div>').join('');

    // Música y video de la boda
    const pl = cfg.playlistUrl && B.ytEmbed(cfg.playlistUrl);
    showIf('#musica', pl);
    if (pl) {
      $('#playlistFrame').src = pl;
      $('#ytMusic').href = B.ytMusicLink(cfg.playlistUrl);
    }
    const vid = cfg.videoUrl && B.ytEmbed(cfg.videoUrl);
    showIf('#video', vid);
    if (vid) $('#videoFrame').src = vid;

    // Nuestra historia + fotos
    const storyParas = String(cfg.story || '').split(/\n/).map((x) => x.trim()).filter(Boolean);
    const photos = String(cfg.gallery || '').split('\n').map((x) => x.trim()).filter(Boolean);
    showIf('#historia', storyParas.length || photos.length);
    showIf('#navHistoria', storyParas.length || photos.length);
    setText('#storyTitle', cfg.storyTitle || 'Nuestra historia');
    $('#story').innerHTML = storyParas.map((p) => '<p>' + esc(p) + '</p>').join('');
    $('#gallery').innerHTML = photos.map((u, i) => '<button type="button" data-i="' + i + '" aria-label="Ver foto ' + (i + 1) + '"><img loading="lazy" alt="" src="' + esc(u) + '"></button>').join('');
    setupLightbox(photos);

    // Videos preboda (uno por línea)
    const pre = String(cfg.preweddingVideos || '').split('\n').map((u) => B.ytEmbed(u.trim())).filter(Boolean);
    showIf('#preboda', pre.length);
    $('#preVideos').innerHTML = pre.map((src, i) => '<div class="video-wrap"><iframe title="Video preboda ' + (i + 1) + '" loading="lazy" src="' + esc(src) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>').join('');

    if (cfg.rsvpDeadline) {
      const d = new Date(cfg.rsvpDeadline + 'T12:00');
      if (!isNaN(d)) setText('#deadline', 'Por favor confirma antes del ' + d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) + '.');
    }

    heroPines();
    addDividers();
    renderBookmarks();
    setupReveal();
  }

  /* -------- Fotos en grande -------- */
  function setupLightbox(photos) {
    const lb = $('#lightbox');
    let idx = 0;
    const show = (i) => { idx = (i + photos.length) % photos.length; $('#lbImg').src = photos[idx]; lb.hidden = false; };
    $$('#gallery button').forEach((b) => { b.onclick = () => show(+b.dataset.i); });
    $('#lbClose').onclick = () => { lb.hidden = true; };
    $('#lbPrev').onclick = (e) => { e.stopPropagation(); show(idx - 1); };
    $('#lbNext').onclick = (e) => { e.stopPropagation(); show(idx + 1); };
    lb.onclick = (e) => { if (e.target === lb) lb.hidden = true; };
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') lb.hidden = true;
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    let x0 = null;
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); x0 = null; });
  }

  /* -------- Paisaje: pinos que crecen en la portada -------- */
  function rand(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  function heroPines() {
    const g = $('#heroPines');
    if (!g || g.dataset.done) return;
    g.dataset.done = '1';
    const r = rand(7);
    let html = '';
    const xs = [];
    for (let x = 10; x < 1440; x += 26 + r() * 46) {
      if (x > 470 && x < 970 && r() < 0.75) continue; // claro en el centro para el texto
      xs.push(x);
    }
    xs.forEach((x, i) => {
      const sc = 0.75 + r() * 0.9;
      const y = 362 + Math.sin(x / 140) * 8 + r() * 10;
      const shade = ['#3f4a39', '#46523f', '#384233'][Math.floor(r() * 3)];
      html += '<g transform="translate(' + x.toFixed(0) + ' ' + y.toFixed(0) + ') scale(' + sc.toFixed(2) + ')"><g class="pine-g" style="--i:' + i + '"><use href="#pineShape" fill="' + shade + '"/></g></g>';
    });
    g.insertAdjacentHTML('beforeend', html);
  }

  /* -------- Separadores entre secciones (estilo campirano) -------- */
  const PINE = 'M0-62 L-11-38 L-6-38 L-16-18 L-9-18 L-21 4 L21 4 L9-18 L16-18 L6-38 L11-38Z';

  function dividerSvg(kind, seed) {
    const r = rand(seed * 31 + 3);
    let h = '<svg class="divider" viewBox="0 0 1200 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">';
    const pine = (x, y, s, i, c) => '<g transform="translate(' + x.toFixed(0) + ' ' + y.toFixed(0) + ') scale(' + s.toFixed(2) + ')"><g class="el" style="--i:' + i + '"><g class="sway" style="--i:' + i + '"><path d="' + PINE + '" fill="' + c + '"/><rect x="-2.5" y="4" width="5" height="8" fill="#6b5a44"/></g></g></g>';
    if (kind === 0) {
      // Bosque de pinos sobre una loma
      h += '<path class="ground" d="M0 122 Q300 104 600 116 T1200 112 L1200 130 L0 130Z"/>';
      let i = 0;
      for (let x = 300; x < 900; x += 26 + r() * 30) {
        const k = Math.sin(((x - 300) / 600) * Math.PI);
        h += pine(x, 118 - k * 8, 0.8 + k * 0.7 + r() * 0.2, i++, r() < 0.5 ? '#5f6b56' : '#7d8b72');
      }
    } else if (kind === 1) {
      // Cerca de rancho con pinos a los lados
      h += '<path class="ground" d="M0 124 Q600 110 1200 124 L1200 130 L0 130Z"/>';
      let i = 0;
      for (let x = 380; x <= 820; x += 55) h += '<g class="el post" style="--i:' + i++ + '"><rect x="' + (x - 3) + '" y="86" width="6" height="34" rx="1" fill="#8a6b4a"/></g>';
      h += '<rect class="rail" style="--i:2" x="380" y="93" width="440" height="4" rx="2" fill="#a07e58"/><rect class="rail" style="--i:4" x="380" y="106" width="440" height="4" rx="2" fill="#a07e58"/>';
      [[290, 1.5], [336, 1.1], [870, 1.35], [914, 0.95], [250, 0.9], [955, 1.2]].forEach(([x, s], k) => { h += pine(x, 120, s, k + 3, '#5f6b56'); });
    } else {
      // Cordillera con sol y pinos al frente
      h += '<g class="sunline"><circle cx="760" cy="62" r="18" fill="#f1d7a2" opacity=".8"/></g>';
      const ridge = 'M260 122 L380 70 L450 98 L560 46 L650 96 L740 66 L860 112 L940 122';
      h += '<path class="ridge-fill" d="' + ridge + ' Z"/><path class="ridge" d="' + ridge + '"/>';
      h += '<path class="ground" d="M200 124 Q600 112 1000 124 L1000 130 L200 130Z"/>';
      let i = 0;
      [430, 470, 520, 690, 730, 770].forEach((x) => { h += pine(x, 122, 0.8 + r() * 0.45, i++, '#5f6b56'); });
    }
    return h + '</svg>';
  }

  function addDividers() {
    let n = 0;
    $$('main > section').forEach((sec) => {
      if (sec.id === 'bienvenida' || sec.querySelector(':scope > .divider')) return;
      sec.insertAdjacentHTML('afterbegin', dividerSvg(n % 3, n + 1));
      n++;
    });
  }

  /* -------- Marcadores al final -------- */
  function renderBookmarks() {
    const items = [['inicio', 'Inicio', '🏔️']].concat($$('main > section[data-icon]').filter((s) => !s.hidden).map((s) => [s.id, s.dataset.mark, s.dataset.icon]));
    $('#bookmarks').innerHTML = items.map(([id, label, ic]) => '<a class="bm' + (id === 'confirmar' ? ' cta' : '') + '" href="#' + id + '"><i>' + ic + '</i>' + esc(label) + '</a>').join('');
  }

  /* -------- Cuenta regresiva -------- */
  function startCountdown() {
    const { start, end } = B.eventDates(cfg);
    if (!start) return;
    const pad = (n) => String(n).padStart(2, '0');
    function tick() {
      const now = Date.now();
      let diff = start.getTime() - now;
      if (diff <= 0) {
        $('#countdown').hidden = true;
        const m = $('#cdMsg'); m.hidden = false;
        m.textContent = now < end.getTime() ? '¡Hoy es el gran día! 💍' : '¡Gracias por celebrar con nosotros! 💛';
        return;
      }
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      $('#cdD').textContent = d; $('#cdH').textContent = pad(h); $('#cdM').textContent = pad(m); $('#cdS').textContent = pad(s);
      setTimeout(tick, 1000 - (Date.now() % 1000));
    }
    tick();
  }

  /* -------- Confirmación -------- */
  /* -------- Confirmación (ligada al celular; por familia) -------- */
  const ME_KEY = 'boda_mi_respuesta';
  const remembered = () => { try { return JSON.parse(localStorage.getItem(ME_KEY)) || null; } catch (e) { return null; } };
  const remember = (id, phone) => { try { localStorage.setItem(ME_KEY, JSON.stringify({ id, phone })); } catch (e) { /* nada */ } };
  let currentId = '';
  let phoneOk = '';            // celular ya verificado (10 dígitos)
  let groupMembers = [];       // nombres de los integrantes de la invitación

  // Paso 2: la familia con casillas para marcar quién asistirá
  function showAnswerStep(g, typedName) {
    guest = g || null;
    currentId = guest ? guest.id : '';
    groupMembers = guest && guest.members && guest.members.length ? guest.members.slice() : [typedName || ($('#fName').value.trim())];
    const marked = guest && guest.status === 'si' ? String(guest.attendees || '').split(',').filter(Boolean).map(Number) : null;
    const isNew = !guest;
    const single = groupMembers.length === 1;
    $('#who').innerHTML = '<span>' + (isNew ? 'Confirmación de <b>' + esc(groupMembers[0]) + '</b>'
      : (single ? 'Invitación de <b>' + esc(guest.name) + '</b> · 1 lugar' : 'Invitación de <b>' + esc(guest.name) + '</b> · ' + groupMembers.length + ' lugares')) +
      '</span><button type="button" id="changePhone">Cambiar número</button>';
    $('#checksLegend').textContent = single ? '¿Asistirás?' : '¿Quiénes de tu familia asistirán?';
    $('#memberChecks').innerHTML = groupMembers.map((m, i) => {
      const on = marked ? marked.includes(i) : (guest && guest.status === 'no' ? false : true);
      const name = B.isPlaceholderName(m)
        ? '<input data-slot="' + i + '" placeholder="Nombre de tu acompañante" value="">'
        : esc(m);
      return '<label class="mcheck' + (on ? ' on' : '') + '"><input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + '><span class="nm">' + name + '</span></label>';
    }).join('');
    $('#noneCheck').checked = !!(guest && guest.status === 'no');
    if (guest) {
      $('#rsvpSub').textContent = guest.status === 'pendiente' ? 'Marca quiénes de tu invitación nos acompañarán.' : 'Ya recibimos tu respuesta. Si algo cambió, puedes actualizarla aquí.';
      const diets = String(guest.diet || '').split(',').map((x) => x.trim()).filter(Boolean);
      const known = $$('#dietChips input').map((i) => i.value);
      $$('#dietChips input').forEach((i) => { i.checked = diets.includes(i.value); });
      $('#fDietOther').value = diets.filter((d) => !known.includes(d)).join(', ');
      $('#fSong').value = guest.song || '';
      $('#fComments').value = guest.comments || '';
    }
    syncChecks();
    $('#stepPhone').hidden = true;
    $('#stepAnswer').hidden = false;
    $('#changePhone').onclick = () => { $('#stepAnswer').hidden = true; $('#stepPhone').hidden = false; $('#fPhone').focus(); };
  }

  function syncChecks() {
    const boxes = $$('#memberChecks input[type=checkbox]');
    boxes.forEach((b) => b.closest('.mcheck').classList.toggle('on', b.checked));
    const any = boxes.some((b) => b.checked);
    if (any) $('#noneCheck').checked = false;
    $('#yesFields').hidden = !any;
  }

  async function continuePhone() {
    const p1 = B.normPhone($('#fPhone').value), p2 = B.normPhone($('#fPhone2').value);
    const f1 = $('#fPhone').closest('.field'), f2 = $('#fPhone2').closest('.field');
    f1.classList.toggle('error', !p1); f2.classList.toggle('error', !p2 || p1 !== p2);
    if (!p1) { B.toast('Escribe tu número de celular a 10 dígitos 📱', 'warn'); return; }
    if (p1 !== p2) { B.toast('Los dos números no coinciden. Revísalos 🙂', 'warn'); return; }
    const nameShown = !$('#nameField').hidden;
    const name = $('#fName').value.trim();
    if (nameShown && !name) { $('#fName').closest('.field').classList.add('error'); B.toast('Escribe tu nombre completo', 'warn'); return; }
    phoneOk = p1;
    const btn = $('#btnContinue');
    btn.disabled = true; btn.textContent = 'Buscando tu invitación…';
    try {
      const r = await B.api('lookup', { g: guestId || currentId, phone: p1, name: nameShown ? name : '' });
      if (r && r.ok && r.guest) { showAnswerStep(r.guest); return; }
      if (!nameShown) {
        // Número nuevo: pedimos el nombre para encontrar su invitación
        $('#nameField').hidden = false;
        $('#fName').focus();
        return;
      }
      showAnswerStep(null, name); // no está en la lista: responde solo por sí mismo
    } catch (e) {
      B.toast('No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.', 'error', 5000);
    } finally {
      btn.disabled = false; btn.textContent = 'Continuar';
    }
  }

  function setupRsvp(fromMemory) {
    const form = $('#rsvpForm');
    const mem = remembered();
    // Enlace personal: ya sabemos su invitación, solo falta su celular
    if (guest && guestId) {
      $('#phoneHelp').innerHTML = 'Hola <b>' + esc(guest.name.split(' ')[0]) + '</b>: escribe tu celular para confirmar. Con él podrás regresar y cambiar tu respuesta.';
    }
    if (mem && mem.phone) { $('#fPhone').value = mem.phone; }
    $('#btnContinue').onclick = continuePhone;
    ['#fPhone', '#fPhone2', '#fName'].forEach((s) => $(s).addEventListener('input', () => $(s).closest('.field').classList.remove('error')));
    $('#fPhone2').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); continuePhone(); } });
    $('#fName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); continuePhone(); } });
    $('#memberChecks').addEventListener('change', syncChecks);
    $('#noneCheck').addEventListener('change', () => {
      if ($('#noneCheck').checked) $$('#memberChecks input[type=checkbox]').forEach((b) => { b.checked = false; });
      syncChecks();
    });
    // Ya respondió desde este celular: le mostramos su respuesta (con botón para cambiarla)
    if (fromMemory && guest && mem && mem.phone) {
      phoneOk = mem.phone;
      showAnswerStep(guest);
      if (guest.status === 'si' || guest.status === 'no') showDone();
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!phoneOk) { $('#stepAnswer').hidden = true; $('#stepPhone').hidden = false; return; }
      const attendees = $$('#memberChecks input[type=checkbox]').filter((b) => b.checked).map((b) => +b.dataset.i);
      if (!attendees.length && !$('#noneCheck').checked) { B.toast('Marca quién asistirá, o "No podremos asistir"', 'warn'); return; }
      const memberNames = groupMembers.map((m, i) => { const inp = $('input[data-slot="' + i + '"]', $('#memberChecks')); return inp ? inp.value.trim() : ''; });
      const diet = $$('#dietChips input:checked').map((i) => i.value).concat($('#fDietOther').value.trim() ? [$('#fDietOther').value.trim()] : []).join(', ');
      const btn = $('#rsvpBtn');
      btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        const res = await B.api('rsvp', {
          g: currentId || guestId, phone: phoneOk, name: groupMembers[0], attendees, memberNames,
          diet: attendees.length ? diet : '', song: attendees.length ? $('#fSong').value.trim() : '', comments: $('#fComments').value.trim()
        });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Error');
        currentId = res.id || currentId;
        remember(currentId, phoneOk);
        if (res.guest) { guest = res.guest; groupMembers = guest.members || groupMembers; }
        showDone(true);
      } catch (e) {
        B.toast(e.message && e.message !== 'Error' && !/fetch/i.test(e.message) ? esc(e.message) : 'No pudimos enviar tu respuesta. Revisa tu conexión e inténtalo de nuevo.', 'error', 5000);
      } finally {
        btn.disabled = false; btn.textContent = 'Enviar confirmación';
      }
    });

    $('#rsvpEdit').onclick = () => { $('#rsvpDone').hidden = true; form.hidden = false; showAnswerStep(guest); form.scrollIntoView({ behavior: 'smooth' }); };
  }

  // Pantalla final con el resumen de quiénes van
  function showDone(scroll) {
    $('#rsvpForm').hidden = true;
    const done = $('#rsvpDone'); done.hidden = false;
    const g = guest || {};
    const ms = g.members || groupMembers;
    const idx = g.status === 'si' ? String(g.attendees || '').split(',').filter(Boolean).map(Number) : [];
    const first = String(g.name || ms[0] || '').split(' ')[0];
    if (idx.length) {
      $('#doneIcon').textContent = '🥂';
      $('#doneTitle').textContent = '¡Nos vemos ahí, ' + first + '!';
      const hasDate = !!B.eventDates(cfg).start;
      const names = idx.map((i) => ms[i]).filter(Boolean);
      $('#doneText').innerHTML = 'Confirmaste <b>' + idx.length + (idx.length > 1 ? ' lugares' : ' lugar') + '</b>' +
        (ms.length > 1 ? ': ' + esc(names.join(', ')) : '') + '.' + (hasDate ? '<br>Guarda la fecha en tu calendario:' : '');
      const url = pageUrl();
      $('#doneCal').innerHTML = !hasDate ? '' :
        '<a class="btn btn-cal" target="_blank" rel="noopener" href="' + esc(B.googleCalUrl(cfg, url)) + '"><span>G</span>Google</a>' +
        '<a class="btn btn-cal" download="boda.ics" href="' + esc(B.icsDataUrl(cfg, url)) + '"><span>A</span>Apple</a>' +
        '<a class="btn btn-cal" target="_blank" rel="noopener" href="' + esc(B.outlookUrl(cfg, url)) + '"><span>O</span>Outlook</a>';
    } else {
      $('#doneIcon').textContent = '💌';
      $('#doneTitle').textContent = '¡Gracias por avisarnos, ' + first + '!';
      $('#doneText').textContent = 'Te vamos a extrañar. Si cambian tus planes, puedes actualizar tu respuesta aquí mismo.';
      $('#doneCal').innerHTML = '';
    }
    if (scroll) done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* -------- Navegación y animaciones -------- */
  function setupNav() {
    const nav = $('#topnav'), top = $('#toTop');
    const layers = $$('.landscape .layer');
    const speeds = [0.08, 0.16, 0.26, 0.34];
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('show', y > window.innerHeight * 0.6);
      top.classList.toggle('show', y > window.innerHeight * 1.2);
      if (!reduce && !ticking && y < window.innerHeight * 1.2) {
        ticking = true;
        requestAnimationFrame(() => {
          // Efecto de profundidad: las capas de montañas se mueven a distinta velocidad
          layers.forEach((l, i) => { l.style.translate = '0 ' + (y * speeds[i]).toFixed(1) + 'px'; });
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function setupReveal() {
    $$('.card, .section h2, .lead, .map-wrap, .video-wrap, .cal-buttons, .story, .gallery button, .bm').forEach((el) => el.classList.add('reveal'));
    const all = $$('.reveal, .divider');
    if (!('IntersectionObserver' in window)) { all.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    all.forEach((el) => io.observe(el));
  }

  init();
})();
