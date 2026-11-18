/* Utilidades compartidas: configuración, API (Google Sheets o demo), fechas, enlaces. */
(function () {
  'use strict';

  // Valores de arranque EN BLANCO: los datos reales de la boda se escriben desde el panel
  // (Ajustes) y se guardan en Google Sheets, nunca en este código público.
  const DEFAULT_CONFIG = {
    name1: 'Novio',
    name2: 'Novia',
    date: '',
    endDate: '',
    timezone: 'America/Mexico_City',
    ceremonyVenue: '',
    ceremonyAddress: '',
    ceremonyMapsUrl: '',
    ceremonyGeo: '',
    receptionTime: '',
    venueName: '',
    address: '',
    mapsUrl: '',
    venueGeo: '',
    message: 'Con mucha alegría queremos invitarte a celebrar el día en que uniremos nuestras vidas. Tu presencia es nuestro mejor regalo.',
    itinerary: '',
    dressCode: '',
    lodging: '',
    instructions: '',
    gifts: '',
    playlistUrl: '',
    videoUrl: '',
    heroImage: '',
    storyTitle: 'Nuestra historia',
    story: '',
    gallery: '',
    preweddingVideos: '',
    theme: '#9a7b4f',
    siteUrl: '',
    rsvpDeadline: '',
    hashtag: '',
    contactPhone: '',
    countryCode: '52',
    inviteTemplate: '¡Hola {nombre}! 💍 {novios} nos casamos el {fecha} y nos encantaría que nos acompañes. Aquí están todos los detalles y puedes confirmar tu asistencia: {enlace}',
    adminPin: '1234'
  };


  // Campos editables desde "Ajustes" (sección, clave, etiqueta, tipo, ayuda)
  const FIELDS = [
    ['Pareja', 'name1', 'Nombre 1', 'text'],
    ['Pareja', 'name2', 'Nombre 2', 'text'],
    ['Pareja', 'message', 'Mensaje de bienvenida', 'textarea'],
    ['Pareja', 'heroImage', 'Foto de portada', 'image', 'Se muestra de fondo al principio, con las montañas animadas encima. Vacío = fondo claro con montañas.'],
    ['Pareja', 'theme', 'Color principal', 'color'],
    ['Pareja', 'hashtag', 'Hashtag', 'text'],
    ['Nuestra historia', 'storyTitle', 'Título de la sección', 'text'],
    ['Nuestra historia', 'story', 'Nuestra historia', 'textarea', 'Cuéntales cómo se conocieron, la pedida, lo que quieran. Cada renglón es un párrafo. Si lo dejas vacío (y sin fotos), la sección no aparece.'],
    ['Nuestra historia', 'gallery', 'Fotos', 'gallery', 'Se ven en una galería; tus invitados pueden tocarlas para verlas en grande.'],
    ['Evento', 'date', 'Fecha y hora de inicio', 'datetime-local'],
    ['Evento', 'endDate', 'Fecha y hora de fin', 'datetime-local'],
    ['Evento', 'timezone', 'Zona horaria', 'text', 'Ej. America/Mexico_City, America/Monterrey, America/Tijuana'],
    ['Evento', 'ceremonyVenue', 'Ceremonia: lugar', 'text', 'La hora de la ceremonia es la “Fecha y hora de inicio”. Deja vacío si no hay ceremonia aparte.'],
    ['Evento', 'ceremonyAddress', 'Ceremonia: dirección', 'text'],
    ['Evento', 'ceremonyMapsUrl', 'Ceremonia: enlace de Google Maps (opcional)', 'url', 'En Google Maps: Compartir → Copiar enlace. Si lo dejas vacío se usa la dirección.'],
    ['Evento', 'ceremonyGeo', 'Ceremonia: coordenadas para el mapa (opcional)', 'text', 'Formato: latitud,longitud. Pon el pin exacto en el mapa de la web y en Waze.'],
    ['Evento', 'receptionTime', 'Fiesta: hora', 'time'],
    ['Evento', 'venueName', 'Fiesta: lugar', 'text'],
    ['Evento', 'address', 'Fiesta: dirección', 'text'],
    ['Evento', 'mapsUrl', 'Fiesta: enlace de Google Maps (opcional)', 'url', 'En Google Maps: Compartir → Copiar enlace. Si lo dejas vacío se usa la dirección.'],
    ['Evento', 'venueGeo', 'Fiesta: coordenadas para el mapa (opcional)', 'text', 'Formato: latitud,longitud. Pon el pin exacto en el mapa de la web y en Waze.'],
    ['Evento', 'itinerary', 'Programa del día (una línea por momento: HORA | QUÉ)', 'textarea'],
    ['Evento', 'rsvpDeadline', 'Confirmar antes de', 'date'],
    ['Detalles', 'dressCode', 'Código de vestimenta', 'textarea'],
    ['Detalles', 'lodging', 'Alojamiento', 'textarea'],
    ['Detalles', 'instructions', 'Indicaciones para el día', 'textarea'],
    ['Detalles', 'gifts', 'Mesa de regalos', 'textarea'],
    ['Detalles', 'contactPhone', 'Teléfono de contacto (WhatsApp)', 'tel'],
    ['Música y video', 'playlistUrl', 'Playlist de YouTube Music', 'url', 'Abre tu playlist en YouTube Music → Compartir → Copiar enlace, y pégalo aquí. Se integra sola.'],
    ['Música y video', 'preweddingVideos', 'Videos preboda (YouTube, uno por renglón)', 'textarea', 'Sube tus videos a YouTube como “No listado” y pega aquí los enlaces, uno por renglón.'],
    ['Música y video', 'videoUrl', 'Video de la boda (YouTube)', 'url', 'Enlace de YouTube (video o transmisión en vivo).'],
    ['Compartir', 'siteUrl', 'Dirección de tu web de boda', 'url', 'La dirección donde publicaste la web (termina en /).'],
    ['Compartir', 'countryCode', 'Lada del país para WhatsApp', 'text', 'México = 52'],
    ['Compartir', 'inviteTemplate', 'Mensaje de invitación', 'textarea', 'Puedes usar {nombre}, {novios}, {fecha}, {lugar} y {enlace}.'],
    ['Seguridad', 'adminPin', 'Clave del panel de organizadores', 'text', 'Solo ustedes la usan para entrar al panel y ver las mesas.']
  ];

  /* ---------------- Helpers generales ---------------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const newId = () => Math.random().toString(36).slice(2, 10);

  function splitNames(s) {
    return String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  }

  function partySize(g) {
    if (!g) return 0;
    if (g.status === 'no') return 0;
    if (g.status === 'si') return 1 + (parseInt(g.companions, 10) || 0);
    return Math.max(1, parseInt(g.invited, 10) || 1);
  }

  function memberName(g, i) {
    if (i === 0) return g.name;
    const names = splitNames(g.companionNames);
    return names[i - 1] || ('Acompañante ' + i + ' de ' + g.name.split(' ')[0]);
  }

  function initials(name) {
    const parts = String(name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter((w) => w.length > 1 || /[A-ZÁÉÍÓÚÑ]/.test(w));
    if (!parts.length) return '?';
    return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function hueOf(str) {
    let h = 0;
    for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  const STATUS_LABEL = { si: 'Confirmado', no: 'No asiste', pendiente: 'Pendiente' };

  /* ---------------- Fechas y zona horaria ---------------- */
  function tzOffsetMs(date, tz) {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {};
    dtf.formatToParts(date).forEach((x) => { p[x.type] = x.value; });
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUTC - date.getTime();
  }

  function zonedToDate(localStr, tz) {
    if (!localStr) return null;
    const [d, t = '00:00'] = String(localStr).split('T');
    const [Y, M, D] = d.split('-').map(Number);
    const [h, m] = t.split(':').map(Number);
    if (!Y || !M || !D) return null;
    const guess = Date.UTC(Y, M - 1, D, h || 0, m || 0);
    try {
      const off = tzOffsetMs(new Date(guess), tz);
      let utc = guess - off;
      const off2 = tzOffsetMs(new Date(utc), tz);
      if (off2 !== off) utc = guess - off2;
      return new Date(utc);
    } catch (e) {
      return new Date(Y, M - 1, D, h || 0, m || 0);
    }
  }

  function eventDates(cfg) {
    const start = zonedToDate(cfg.date, cfg.timezone);
    let end = zonedToDate(cfg.endDate, cfg.timezone);
    if (start && (!end || end <= start)) end = new Date(start.getTime() + 8 * 3600e3);
    return { start, end };
  }

  function formatLongDate(cfg) {
    const { start } = eventDates(cfg);
    if (!start) return '';
    try {
      const t = start.toLocaleDateString('es-MX', { timeZone: cfg.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return t.charAt(0).toUpperCase() + t.slice(1);
    } catch (e) { return start.toLocaleDateString('es-MX'); }
  }

  function formatTime(cfg) {
    const { start } = eventDates(cfg);
    if (!start) return '';
    try {
      return start.toLocaleTimeString('es-MX', { timeZone: cfg.timezone, hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function formatShortDate(cfg) {
    const { start } = eventDates(cfg);
    if (!start) return '';
    try {
      return start.toLocaleDateString('es-MX', { timeZone: cfg.timezone, day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  /* ---------------- Calendario ---------------- */
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  function calendarInfo(cfg, siteUrl) {
    const { start, end } = eventDates(cfg);
    const title = 'Boda de ' + cfg.name1 + ' & ' + cfg.name2;
    const pl = places(cfg);
    const location = pl[0] ? [pl[0].name, pl[0].address].filter(Boolean).join(', ') : '';
    const details = '¡Nos casamos!\n\n' + pl.map((p) => p.title + (p.time ? ' · ' + p.time : '') + '\n' + [p.name, p.address].filter(Boolean).join(', ') + '\nCómo llegar: ' + mapsLink(p)).join('\n\n') +
      '\n\nTodos los detalles y confirmación: ' + siteUrl;
    return { start, end, title, location, details };
  }

  function googleCalUrl(cfg, siteUrl) {
    const c = calendarInfo(cfg, siteUrl);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: c.title, dates: icsDate(c.start) + '/' + icsDate(c.end), details: c.details, location: c.location });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  function outlookUrl(cfg, siteUrl, office) {
    const c = calendarInfo(cfg, siteUrl);
    const q = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: c.title, startdt: c.start.toISOString(), enddt: c.end.toISOString(), body: c.details, location: c.location });
    return (office ? 'https://outlook.office.com' : 'https://outlook.live.com') + '/calendar/0/deeplink/compose?' + q.toString();
  }

  function icsText(cfg, siteUrl) {
    const c = calendarInfo(cfg, siteUrl);
    const e = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Boda ' + cfg.name1 + ' y ' + cfg.name2 + '//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:boda-' + norm(cfg.name1 + cfg.name2).replace(/\W/g, '') + '-' + icsDate(c.start) + '@boda',
      'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(c.start), 'DTEND:' + icsDate(c.end),
      'SUMMARY:' + e(c.title), 'LOCATION:' + e(c.location), 'DESCRIPTION:' + e(c.details), 'URL:' + siteUrl,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + e('Mañana es la boda de ' + cfg.name1 + ' & ' + cfg.name2), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }

  function icsDataUrl(cfg, siteUrl) {
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsText(cfg, siteUrl));
  }

  /* ---------------- Mapas, YouTube ---------------- */
  // Lugares del día: ceremonia (si hay) y fiesta → [{ title, icon, time, name, address, mapsUrl }]
  function places(cfg) {
    const out = [];
    if (cfg.ceremonyVenue || cfg.ceremonyAddress) {
      out.push({ title: 'Ceremonia religiosa', icon: '⛪', time: formatTime(cfg), name: cfg.ceremonyVenue, address: cfg.ceremonyAddress, mapsUrl: cfg.ceremonyMapsUrl, geo: geoOf(cfg.ceremonyGeo, cfg.ceremonyMapsUrl) });
    }
    if (cfg.venueName || cfg.address) {
      out.push({ title: out.length ? 'Fiesta' : 'Celebración', icon: '🥂', time: out.length ? fmtHour(cfg.receptionTime) : formatTime(cfg), name: cfg.venueName, address: cfg.address, mapsUrl: cfg.mapsUrl, query: cfg.address, geo: geoOf(cfg.venueGeo, cfg.mapsUrl) });
    }
    return out;
  }
  // Coordenadas "lat,long": escritas a mano o sacadas de un enlace largo de Google Maps (!3d…!4d… o @lat,long)
  function geoOf(geo, url) {
    const g = String(geo || '').match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (g) return g[1] + ',' + g[2];
    const u = String(url || '');
    const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    return m ? m[1] + ',' + m[2] : '';
  }
  function fmtHour(hhmm) {
    const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) return hhmm || '';
    return new Date(2000, 0, 1, +m[1], +m[2]).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  }
  // La fiesta se busca por su dirección: Google suele ubicar mejor el lugar que el nombre del salón
  function mapQuery(p) { return p.query || [p.name, p.address].filter(Boolean).join(', '); }
  function mapsLink(p) { return p.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapQuery(p))); }
  function wazeLink(p) { return p.geo ? 'https://waze.com/ul?ll=' + p.geo + '&navigate=yes' : 'https://waze.com/ul?q=' + encodeURIComponent(mapQuery(p)) + '&navigate=yes'; }
  function appleMapsLink(p) { return 'https://maps.apple.com/?q=' + encodeURIComponent(p.name || mapQuery(p)) + (p.geo ? '&ll=' + p.geo : ''); }
  function mapEmbed(p) { return 'https://www.google.com/maps?q=' + encodeURIComponent(p.geo || mapQuery(p)) + (p.geo ? '&z=16' : '') + '&output=embed'; }

  function ytPlaylistId(u) { const m = String(u || '').match(/[?&]list=([\w-]+)/); return m ? m[1] : null; }
  function ytVideoId(u) { const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/); return m ? m[1] : null; }
  function ytEmbed(u) {
    const v = ytVideoId(u), l = ytPlaylistId(u);
    if (v) return 'https://www.youtube.com/embed/' + v + (l ? '?list=' + l : '');
    if (l) return 'https://www.youtube.com/embed/videoseries?list=' + l;
    return null;
  }
  function ytMusicLink(u) {
    const l = ytPlaylistId(u);
    return l ? 'https://music.youtube.com/playlist?list=' + l : u;
  }

  /* ---------------- Compartir ---------------- */
  function shareLinks(url, text) {
    const t = encodeURIComponent(text), u = encodeURIComponent(url), tu = encodeURIComponent(text + ' ' + url);
    return {
      whatsapp: 'https://wa.me/?text=' + tu,
      telegram: 'https://t.me/share/url?url=' + u + '&text=' + t,
      sms: 'sms:?&body=' + tu,
      email: 'mailto:?subject=' + encodeURIComponent('¡Nos casamos! 💍') + '&body=' + tu,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
      x: 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u
    };
  }

  function waPhone(phone, cc) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 && cc) d = cc + d;
    return d;
  }

  function siteBaseUrl(cfg) {
    if (cfg && cfg.siteUrl) return cfg.siteUrl.replace(/[?#].*$/, '');
    return new URL('./', location.href).href;
  }

  function guestLink(cfg, g) { return siteBaseUrl(cfg) + '?g=' + encodeURIComponent(g.id); }

  function fillTemplate(cfg, tpl, g) {
    return String(tpl || DEFAULT_CONFIG.inviteTemplate)
      .replace(/\{nombre\}/g, g ? g.name.split(' ')[0] : '')
      .replace(/\{fecha\}/g, formatShortDate(cfg))
      .replace(/\{novios\}/g, [cfg.name1, cfg.name2].filter(Boolean).join(' y '))
      .replace(/\{lugar\}/g, cfg.ceremonyAddress || cfg.address || cfg.venueName || '')
      .replace(/\{enlace\}/g, g ? guestLink(cfg, g) : siteBaseUrl(cfg));
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* nada */ }
      ta.remove(); return ok;
    }
  }

  function applyTheme(cfg) {
    const c = cfg.theme || DEFAULT_CONFIG.theme;
    document.documentElement.style.setProperty('--accent', c);
  }

  /* ---------------- Toasts ---------------- */
  function toast(msg, type = 'info', ms = 3800) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, ms);
  }

  /* ======================================================================
     API: Google Sheets (Apps Script) o demostración local
     ====================================================================== */
  const DEMO_KEY = 'boda_demo_db_v1';
  const isDemo = () => !((window.BODA_CONFIG || {}).API_URL);

  function demoSeed() {
    const now = new Date().toISOString();
    const g = (name, group, invited, status, companions, companionNames, extra) => Object.assign({
      id: newId(), name, group, phone: '', email: '', invited, status, companions, companionNames,
      diet: '', comments: '', cabin: '', song: '', source: 'lista', invitedAt: '', updated: now, change: '', notes: ''
    }, extra || {});
    const guests = [
      g('Ana Ejemplo', 'Lado de la novia', 3, 'si', 2, 'Luis Ejemplo, Sofía Ejemplo', { source: 'web', diet: 'Vegetariana', song: 'Perfect - Ed Sheeran' }),
      g('Carlos Demo', 'Lado del novio', 2, 'si', 1, 'Marta Demo', { diet: 'Sin gluten' }),
      g('Familia Prueba', 'Lado del novio', 4, 'pendiente', 0, 'Pedro Prueba, Lucía Prueba, Tomás Prueba'),
      g('Elena Muestra', 'Amigos', 1, 'no', 0, '', { comments: '¡Les deseo lo mejor! No podré ir por trabajo.' }),
      g('Jorge Invitado', 'Amigos', 2, 'pendiente', 0, '')
    ];
    const tables = [
      { id: 't1', name: 'Presidencial', shape: 'presidential', seats: 8, x: 0, y: -230, rot: 0 },
      { id: 't2', name: 'Mesa 1', shape: 'round', seats: 10, x: -220, y: 40, rot: 0 },
      { id: 't3', name: 'Mesa 2', shape: 'round', seats: 10, x: 220, y: 40, rot: 0 },
      { id: 't4', name: 'Mesa 3', shape: 'rect', seats: 12, x: 0, y: 290, rot: 0 }
    ];
    const seats = {};
    seats[guests[1].id + '#0'] = { t: 't2', s: 0 };
    seats[guests[1].id + '#1'] = { t: 't2', s: 1 };
    seats[guests[3].id + '#0'] = { t: 't3', s: 0 }; // estaba sentada y luego avisó que no viene
    guests[3].change = 'Antes: Confirmado (1) → Ahora: No asiste (0)';
    return { config: Object.assign({}, DEFAULT_CONFIG), guests, plan: { tables, seats, updated: now } };
  }

  function demoLoad() {
    try { const d = JSON.parse(localStorage.getItem(DEMO_KEY)); if (d && d.config) return d; } catch (e) { /* nada */ }
    const d = demoSeed(); demoSave(d); return d;
  }
  function demoSave(d) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch (e) { /* nada */ } }
  function demoReset() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* nada */ } }

  function publicConfig(cfg) { const c = Object.assign({}, cfg); delete c.adminPin; return c; }

  function demoApi(action, p) {
    const db = demoLoad();
    const ok = (o) => Object.assign({ ok: true }, o || {});
    const isSeated = (id) => Object.keys(db.plan.seats || {}).some((k) => k.split('#')[0] === id);
    if (action === 'public') {
      const res = ok({ config: publicConfig(db.config) });
      const g = p.g && db.guests.find((x) => x.id === p.g);
      if (g) res.guest = g;
      return res;
    }
    if (action === 'rsvp') {
      const name = String(p.name || '').trim();
      if (!name) return { ok: false, error: 'Falta el nombre' };
      let g = (p.g && db.guests.find((x) => x.id === p.g)) || db.guests.find((x) => norm(x.name) === norm(name));
      const isNew = !g;
      const attending = p.attending === true || p.attending === 'si';
      let comp = attending ? Math.max(0, Math.min(20, parseInt(p.companions, 10) || 0)) : 0;
      if (g && g.source !== 'web' && g.invited > 0 && comp > g.invited - 1) comp = g.invited - 1;
      if (isNew) {
        g = { id: newId(), name, group: '', phone: '', email: '', invited: 1 + comp, status: 'pendiente', companions: 0, companionNames: '', diet: '', comments: '', cabin: '', song: '', source: 'web', invitedAt: '', updated: '', change: '', notes: '' };
        db.guests.push(g);
      }
      const prevS = g.status, prevP = partySize(g), seated = isSeated(g.id);
      Object.assign(g, {
        status: attending ? 'si' : 'no', companions: comp, companionNames: String(p.companionNames || '').trim(),
        diet: String(p.diet || '').trim(), comments: String(p.comments || '').trim(), song: String(p.song || '').trim(),
        updated: new Date().toISOString()
      });
      if (p.phone) g.phone = String(p.phone).trim();
      if (g.source === 'web' && 1 + comp > g.invited) g.invited = 1 + comp;
      const changed = prevS !== g.status || prevP !== partySize(g);
      if (!isNew && changed && (prevS !== 'pendiente' || seated)) {
        g.change = 'Antes: ' + STATUS_LABEL[prevS] + ' (' + prevP + ') → Ahora: ' + STATUS_LABEL[g.status] + ' (' + partySize(g) + ')';
      }
      demoSave(db);
      return ok({ id: g.id });
    }
    if (String(p.key) !== String(db.config.adminPin || '1234')) return { ok: false, error: 'Clave incorrecta' };
    switch (action) {
      case 'admin_login': return ok();
      case 'admin_all': return ok({ config: db.config, guests: db.guests, plan: db.plan, now: new Date().toISOString() });
      case 'admin_guests': return ok({ guests: db.guests, planUpdated: db.plan.updated, now: new Date().toISOString() });
      case 'admin_upsert': {
        (p.guests || []).forEach((n) => {
          if (!n.id) n.id = newId();
          const ex = db.guests.find((x) => x.id === n.id);
          if (ex) Object.assign(ex, n); else db.guests.push(n);
        });
        demoSave(db); return ok({ guests: db.guests });
      }
      case 'admin_delete': {
        const ids = new Set(p.ids || []);
        db.guests = db.guests.filter((g) => !ids.has(g.id));
        Object.keys(db.plan.seats).forEach((k) => { if (ids.has(k.split('#')[0])) delete db.plan.seats[k]; });
        demoSave(db); return ok({ guests: db.guests });
      }
      case 'admin_plan': db.plan = p.plan; demoSave(db); return ok({ updated: p.plan.updated });
      case 'admin_config': Object.assign(db.config, p.config); demoSave(db); return ok({ config: db.config });
    }
    return { ok: false, error: 'Acción desconocida' };
  }

  async function api(action, payload = {}) {
    if (isDemo()) {
      await new Promise((r) => setTimeout(r, 120));
      return JSON.parse(JSON.stringify(demoApi(action, JSON.parse(JSON.stringify(payload)))));
    }
    const url = window.BODA_CONFIG.API_URL;
    if (action === 'public') {
      const q = new URLSearchParams({ action: 'public', g: payload.g || '' });
      const r = await fetch(url + '?' + q.toString());
      return r.json();
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload))
    });
    return r.json();
  }

  window.Boda = {
    DEFAULT_CONFIG, FIELDS, STATUS_LABEL, $, $$, esc, norm, newId, splitNames, partySize, memberName, initials, hueOf,
    zonedToDate, eventDates, formatLongDate, formatShortDate, formatTime,
    googleCalUrl, outlookUrl, icsText, icsDataUrl,
    mapsLink, wazeLink, appleMapsLink, mapEmbed, mapQuery, places, fmtHour,
    ytEmbed, ytMusicLink, ytPlaylistId, ytVideoId,
    shareLinks, waPhone, siteBaseUrl, guestLink, fillTemplate, copyText, applyTheme, toast,
    api, isDemo, demoReset, DEMO_KEY,
    withDefaults: (cfg) => Object.assign({}, DEFAULT_CONFIG, Object.fromEntries(Object.entries(cfg || {}).filter(([k, v]) => v != null && (v !== '' || !['name1', 'name2', 'date', 'timezone', 'theme', 'inviteTemplate'].includes(k)))))
  };
})();
