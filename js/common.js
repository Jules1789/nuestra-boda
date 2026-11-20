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
    dressExamples: '',
    recommendations: '',
    faq: '',
    lodging: '',
    instructions: '',
    gifts: '',
    giftsStore: '',
    giftsUrl: '',
    giftsImage: '',
    playlistUrl: '',
    videoUrl: '',
    heroImage: '',
    heroFocus: '50% 30%',
    heroVeil: '0',
    heroBlur: '0',
    storyTitle: 'Nuestra historia',
    story: '',
    gallery: '',
    preweddingVideos: '',
    theme: '#9a7b4f',
    colorBg: '#f7f2ea',
    colorText: '#2f2a24',
    colorCard: '#fffdf9',
    colorNature: '#5f6b56',
    declineDeadline: '',
    declineMessage: 'Te vamos a extrañar mucho y te llevaremos en el corazón ese día. Si tus planes cambian, aquí mismo puedes actualizar tu respuesta.',
    welcomeMessage: 'Con todo nuestro cariño queremos compartir contigo uno de los días más importantes de nuestra vida. Tu presencia hará este momento aún más especial.',
    siteUrl: '',
    rsvpDeadline: '',
    hashtag: '',
    contactPhone: '',
    countryCode: '52',
    inviteTemplate: '¡Hola {nombre}! 💍 {novios} nos casamos el {fecha} y nos encantaría que nos acompañes. Aquí están todos los detalles y puedes confirmar tu asistencia: {enlace}',
    lblDetails: 'El gran día',
    lblWhen: 'Cuándo',
    lblCalHint: 'Guarda la fecha en tu calendario:',
    lblCeremony: 'Ceremonia religiosa',
    lblParty: 'Fiesta',
    lblDirBtn: 'Cómo llegar',
    lblItinerary: 'Programa del día',
    lblDress: 'Código de vestimenta',
    lblLodging: 'Alojamiento',
    lblLodgingBtn: 'Ver ubicación',
    lblLodgingRecs: 'Opciones de hospedaje',
    lblInstr: 'Indicaciones',
    lblGifts: 'Mesa de regalos',
    lblMaps: 'Cómo llegar',
    lblMapsSub: 'Toca el botón y tu celular te lleva directo.',
    lblMapsBtn: 'Abrir en Google Maps',
    lblBetween: 'De la iglesia a la fiesta:',
    lblPre: 'Video preboda',
    lblMusic: 'Nuestra música',
    lblVideo: 'Nuestro video',
    lblRsvp: 'Confirma tu asistencia',
    lblRecs: 'Recomendaciones para ese día',
    lblFaq: 'Preguntas frecuentes',
    lodgingUrl: '',
    lodgingRecs: '',
    hiddenSections: '',
    sectionOrder: '',
    namesFont: 'Cormorant Garamond',
    namesSize: '50',
    namesLayout: 'row',
    namesAmp: '&',
    namesCase: 'normal',
    namesSpacing: '0',
    namesShow: 'full',
    iconStyle: 'line',
    icoWhen: '',
    icoCeremony: '',
    icoParty: '',
    icoDress: '',
    icoLodging: '',
    icoInstr: '',
    icoGifts: '',
    icoInicio: '',
    icoHistoria: '',
    icoPreboda: '',
    icoDetalles: '',
    icoUbicacion: '',
    icoMusica: '',
    icoVideo: '',
    icoConfirmar: '',
    icoRecs: '',
    icoFaq: '',
    adminPin: '1234'
  };


  // Campos editables desde "Ajustes" (sección, clave, etiqueta, tipo, ayuda)
  const FIELDS = [
    ['Pareja', 'name1', 'Nombre 1', 'text'],
    ['Pareja', 'name2', 'Nombre 2', 'text'],
    ['Pareja', 'message', 'Mensaje de bienvenida', 'textarea'],
    ['Pareja', '_names', 'Cómo se ven sus nombres en la portada', 'namesbox', 'Elige tipografía, tamaño y acomodo. La vista previa cambia al momento; pulsa Guardar cambios para aplicarlo en la web.'],
    ['Pareja', 'namesFont', '', 'hidden'],
    ['Pareja', 'namesSize', '', 'hidden'],
    ['Pareja', 'namesLayout', '', 'hidden'],
    ['Pareja', 'namesAmp', '', 'hidden'],
    ['Pareja', 'namesCase', '', 'hidden'],
    ['Pareja', 'namesSpacing', '', 'hidden'],
    ['Pareja', 'namesShow', '', 'hidden'],
    ['Pareja', 'heroImage', 'Foto de portada', 'image', 'Se muestra de fondo al principio, con las montañas animadas encima. Vacío = fondo claro con montañas.'],
    ['Pareja', 'heroFocus', '', 'hidden'],
    ['Pareja', 'heroVeil', 'Transparencia de la foto de portada', 'range', '0 = foto tal cual · 100 = casi invisible (se funde con el color de fondo). Úsalo para que resalten las letras.'],
    ['Pareja', 'heroBlur', 'Difuminado de la foto de portada', 'range', '0 = nítida · 100 = muy difuminada.'],
    ['Pareja', 'hashtag', 'Hashtags (al final de la página)', 'textarea', 'Uno o varios, separados por espacio o en renglones. Ej. #BodaJulioYYamile #JulioYYamile2027. Si no llevan #, se lo ponemos.'],
    ['Pareja', 'welcomeMessage', 'Mensaje al abrir la invitación', 'textarea', 'Aparece justo después de que el invitado escribe su celular, con su nombre o el de su familia arriba.'],
    ['Pareja', 'declineMessage', 'Mensaje para quienes no podrán asistir', 'textarea', 'Lo ven justo después de responder “No podremos asistir”.'],
    ['Pareja', 'declineDeadline', 'Fecha límite para cambiar su respuesta (opcional)', 'date', 'Al elegirla se escribe sola en el mensaje de arriba; luego puedes editar el texto como quieras. Bórrala para quitarla del mensaje.'],
    ['Colores', '_palette', 'Paletas listas', 'palette', 'Toca una paleta para probarla; después ajusta cualquier color y pulsa Guardar.'],
    ['Colores', 'theme', 'Color principal (botones y detalles)', 'color'],
    ['Colores', 'colorBg', 'Color de fondo', 'color'],
    ['Colores', 'colorCard', 'Color de las tarjetas', 'color'],
    ['Colores', 'colorText', 'Color del texto', 'color'],
    ['Colores', 'colorNature', 'Color de montañas y pinos', 'color'],
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
    ['Código de vestimenta', 'dressCode', 'Indicaciones de vestimenta', 'textarea'],
    ['Código de vestimenta', 'dressExamples', 'Fotos de ejemplo', 'list', 'Agrega fotos de ejemplo con un título y una descripción (p. ej. “Ellas: vestido largo y abrigo ligero”).'],
    ['Recomendaciones para el día', 'recommendations', 'Recomendaciones', 'list', 'Aparecen en “El gran día”: lugares cercanos (un restaurante, una cafetería), qué llevar, consejos… Cada una con foto, descripción y ubicación opcional.'],
    ['Preguntas frecuentes', 'faq', 'Preguntas y respuestas', 'list', 'Transporte, hotel, menú, sesión de fotos, horarios… Tus invitados las pueden buscar en la página.'],
    ['Alojamiento', 'lodging', 'Descripción', 'textarea', 'Ej. Hay cabañas en Vigas del Cielo; reserva con anticipación.'],
    ['Alojamiento', 'lodgingUrl', 'Ubicación (enlace de Google Maps, opcional)', 'url', 'Aparece como botón dentro de la tarjeta de alojamiento.'],
    ['Alojamiento', 'lodgingRecs', 'Opciones de hospedaje recomendadas', 'list', 'Hoteles o cabañas cercanos, cada uno con foto, descripción y ubicación. Aparecen debajo de las tarjetas de “El gran día”.'],
    ['Detalles', 'instructions', 'Indicaciones para el día', 'textarea'],
    ['Mesa de regalos', 'giftsImage', 'Foto de la mesa de regalos', 'image', 'Al tocar la foto, tus invitados van directo a la mesa de regalos.'],
    ['Mesa de regalos', 'giftsStore', 'Tienda', 'text', 'Ej. Liverpool. También es un enlace directo a la mesa de regalos.'],
    ['Mesa de regalos', 'giftsUrl', 'Enlace de la mesa de regalos', 'url', 'Pega aquí el enlace de tu mesa (no se muestra como texto en la página).'],
    ['Mesa de regalos', 'gifts', 'Mensaje (opcional)', 'textarea', 'Ej. Tu presencia es nuestro mejor regalo; si deseas hacernos un obsequio…'],
    ['Detalles', 'contactPhone', 'Teléfono de contacto (WhatsApp)', 'tel'],
    ['Música y video', 'playlistUrl', 'Playlist de YouTube Music', 'url', 'Abre tu playlist en YouTube Music → Compartir → Copiar enlace, y pégalo aquí. Se integra sola.'],
    ['Música y video', 'preweddingVideos', 'Videos preboda (YouTube, uno por renglón)', 'textarea', 'Sube tus videos a YouTube como “No listado” y pega aquí los enlaces, uno por renglón.'],
    ['Música y video', 'videoUrl', 'Video de la boda (YouTube)', 'url', 'Enlace de YouTube (video o transmisión en vivo).'],
    ['Títulos de la página', '_titlesHelp', 'Cambia cualquier título o botón de la web. Si borras uno, vuelve a su texto original.', 'note'],
    ['Títulos de la página', 'lblDetails', 'Título de “El gran día”', 'text'],
    ['Títulos de la página', 'lblWhen', 'Tarjeta de la fecha', 'text'],
    ['Títulos de la página', 'lblCalHint', 'Texto sobre los botones de calendario', 'text'],
    ['Títulos de la página', 'lblCeremony', 'Tarjeta de la ceremonia', 'text'],
    ['Títulos de la página', 'lblParty', 'Tarjeta de la fiesta', 'text'],
    ['Títulos de la página', 'lblDirBtn', 'Botón de las tarjetas de lugar', 'text'],
    ['Títulos de la página', 'lblItinerary', 'Título del programa del día', 'text'],
    ['Títulos de la página', 'lblDress', 'Tarjeta de vestimenta', 'text'],
    ['Títulos de la página', 'lblLodging', 'Tarjeta de alojamiento', 'text'],
    ['Títulos de la página', 'lblLodgingBtn', 'Botón de ubicación del alojamiento', 'text'],
    ['Títulos de la página', 'lblLodgingRecs', 'Título de las opciones de hospedaje', 'text'],
    ['Títulos de la página', 'lblInstr', 'Tarjeta de indicaciones', 'text'],
    ['Títulos de la página', 'lblGifts', 'Tarjeta de la mesa de regalos', 'text'],
    ['Títulos de la página', 'lblMaps', 'Título de la sección de mapas', 'text'],
    ['Títulos de la página', 'lblMapsSub', 'Subtítulo de la sección de mapas', 'text'],
    ['Títulos de la página', 'lblMapsBtn', 'Botón de Google Maps', 'text'],
    ['Títulos de la página', 'lblBetween', 'Texto entre los dos lugares', 'text'],
    ['Títulos de la página', 'lblPre', 'Título del video preboda', 'text'],
    ['Títulos de la página', 'lblMusic', 'Título de la música', 'text'],
    ['Títulos de la página', 'lblVideo', 'Título del video de la boda', 'text'],
    ['Títulos de la página', 'lblRsvp', 'Título de confirmar asistencia', 'text'],
    ['Títulos de la página', 'lblRecs', 'Título de recomendaciones', 'text'],
    ['Títulos de la página', 'lblFaq', 'Título de preguntas frecuentes', 'text'],
    ['Íconos', 'iconStyle', 'Estilo de los íconos', 'iconstyle', 'Líneas finas = más limpio y elegante, toman el color principal. Emojis = los de siempre.'],
    ['Íconos', '_icons', 'Personaliza cada ícono', 'icons', 'Toca uno para elegir otro ícono, escribir un emoji o subir tu propia imagen.'],
    ['Íconos', 'icoWhen', '', 'hidden'],
    ['Íconos', 'icoCeremony', '', 'hidden'],
    ['Íconos', 'icoParty', '', 'hidden'],
    ['Íconos', 'icoDress', '', 'hidden'],
    ['Íconos', 'icoLodging', '', 'hidden'],
    ['Íconos', 'icoInstr', '', 'hidden'],
    ['Íconos', 'icoGifts', '', 'hidden'],
    ['Íconos', 'icoInicio', '', 'hidden'],
    ['Íconos', 'icoHistoria', '', 'hidden'],
    ['Íconos', 'icoPreboda', '', 'hidden'],
    ['Íconos', 'icoDetalles', '', 'hidden'],
    ['Íconos', 'icoUbicacion', '', 'hidden'],
    ['Íconos', 'icoMusica', '', 'hidden'],
    ['Íconos', 'icoVideo', '', 'hidden'],
    ['Íconos', 'icoConfirmar', '', 'hidden'],
    ['Íconos', 'icoRecs', '', 'hidden'],
    ['Íconos', 'icoFaq', '', 'hidden'],
    ['Secciones: orden y visibilidad', 'sectionOrder', '', 'hidden'],
    ['Secciones: orden y visibilidad', 'hiddenSections', 'Orden de las secciones en la web', 'sections', 'Usa ↑ ↓ para cambiar el orden. Quita la palomita para ocultar una sección o tarjeta completa. Las secciones sin contenido (por ejemplo, Nuestra historia sin texto ni fotos) no se muestran aunque estén palomeadas.'],
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

  // Cada invitación es una familia/grupo: el titular + sus integrantes (lugares asignados por los novios)
  function members(g) {
    if (!g) return [];
    const n = Math.max(1, parseInt(g.invited, 10) || 1);
    const extra = splitNames(g.companionNames);
    const first = String(g.name || '').split(' ')[0];
    const out = [g.name];
    for (let i = 1; i < n; i++) out.push(extra[i - 1] || ('Acompañante ' + i + ' de ' + first));
    return out;
  }

  const isPlaceholderName = (v) => !v || /^acompa[nñ]ante/i.test(v) || /^(esposa|esposo|novia|novio|pareja) de /i.test(v);

  // Posiciones (0 = titular) de quienes asistirán. "Asistentes" guarda p. ej. "0,2".
  // Si está pendiente se planea con todos; si dijo que no, con nadie.
  function attendingIdx(g) {
    if (!g || g.status === 'no') return [];
    const n = members(g).length;
    const all = Array.from({ length: n }, (_, i) => i);
    if (g.status !== 'si') return all;
    const raw = String(g.attendees == null ? '' : g.attendees).trim();
    if (raw) {
      const set = new Set(raw.split(/[,;\s]+/).map((x) => parseInt(x, 10)).filter((i) => i >= 0 && i < n));
      return all.filter((i) => set.has(i));
    }
    return all.slice(0, Math.min(n, 1 + (parseInt(g.companions, 10) || 0)));
  }

  function partySize(g) { return attendingIdx(g).length; }

  // A quién va dirigida la invitación: "Familia Bustos Hernández", "Ilse y Omar" o "Ángela Juárez"
  function groupLabel(g) {
    if (!g) return '';
    if (String(g.label || '').trim()) return String(g.label).trim();
    const ms = members(g);
    // La columna "Grupo / Familia" con apellidos (p. ej. "Bustos Reyna") manda: "Familia Bustos Reyna".
    // Si trae una categoría ("Novia (Yami)", "Amigos del novio…") no se usa para el saludo.
    const fam = String(g.group || '').trim().replace(/^familia\s+/i, '');
    const famOk = !!fam && !/novi[oa]|amig|lado|\(|-|\d/i.test(fam);
    const nm = String(g.name || '').trim();
    if (ms.length <= 1) return famOk && nm.split(/\s+/).length === 1 ? nm + ' ' + fam : nm;
    if (famOk) return 'Familia ' + fam;
    const named = ms.filter((n) => !isPlaceholderName(n));
    if (named.length === 1) return nm + (ms.length > 2 ? ' y acompañantes' : ' y acompañante');
    if (ms.length === 2) return named[0] + ' y ' + named[1];
    const w = nm.replace(/\(.*?\)/g, '').trim().split(/\s+/);
    if (w.length >= 3) return 'Familia ' + w.slice(-2).join(' ');
    if (w.length === 2) return 'Familia ' + w[1];
    return nm + ' y familia';
  }


  // Celulares: se comparan por los últimos 10 dígitos (México). Un grupo puede tener varios.
  function normPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
  function phoneList(s) { return String(s || '').split(/[,;/\n]+/).map(normPhone).filter(Boolean); }

  function memberName(g, i) { return members(g)[i] || ('Integrante ' + (i + 1) + ' de ' + g.name); }

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
    // Acepta "2027-11-13T17:00", "2027-11-13 17:00" o "13/11/2027 17:00" (como lo muestra Google Sheets)
    const str = String(localStr).trim();
    let Y, M, D, h = 0, m = 0, x;
    if ((x = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/))) [, Y, M, D, h, m] = x;
    else if ((x = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/))) [, D, M, Y, h, m] = x;
    else return null;
    Y = +Y; M = +M; D = +D; h = +h || 0; m = +m || 0;
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
      out.push({ title: cfg.lblCeremony || 'Ceremonia religiosa', icon: '⛪', ico: 'icoCeremony', time: formatTime(cfg), name: cfg.ceremonyVenue, address: cfg.ceremonyAddress, mapsUrl: cfg.ceremonyMapsUrl, geo: geoOf(cfg.ceremonyGeo, cfg.ceremonyMapsUrl) });
    }
    if (cfg.venueName || cfg.address) {
      out.push({ title: out.length ? (cfg.lblParty || 'Fiesta') : (cfg.lblParty && cfg.lblParty !== 'Fiesta' ? cfg.lblParty : 'Celebración'), icon: '🥂', ico: 'icoParty', time: out.length ? fmtHour(cfg.receptionTime) : formatTime(cfg), name: cfg.venueName, address: cfg.address, mapsUrl: cfg.mapsUrl, query: cfg.address, geo: geoOf(cfg.venueGeo, cfg.mapsUrl) });
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
    // La lada debe ser solo el código de país (México = 52). Si trae un número pegado, se lo quitamos.
    cc = String(cc || '').replace(/\D/g, '');
    if (cc.length > 3) cc = cc.length > 10 ? cc.slice(0, cc.length - 10) : '52';
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 && cc) d = cc + d;
    return d;
  }

  // Listas editables guardadas como JSON en la configuración (fotos de vestimenta, recomendaciones, preguntas)
  function parseItems(v) {
    if (Array.isArray(v)) return v;
    try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a.filter((x) => x && typeof x === 'object') : []; } catch (e) { return []; }
  }

  // Mesa de regalos: enlace, tienda y mensaje (acepta también el formato viejo: el enlace pegado en el mensaje)
  const STORES = [[/liverpool/i, 'Liverpool'], [/palaciodehierro|palacio/i, 'El Palacio de Hierro'], [/amazon/i, 'Amazon'], [/sears/i, 'Sears'], [/suburbia/i, 'Suburbia'], [/costco/i, 'Costco'], [/walmart/i, 'Walmart']];
  function giftsInfo(cfg) {
    const urlRx = /https?:\/\/\S+/i;
    let url = String(cfg.giftsUrl || '').trim();
    let text = String(cfg.gifts || '');
    const m = text.match(urlRx);
    if (!url && m) url = m[0];
    text = text.replace(/https?:\/\/\S+/gi, '').trim();
    let store = String(cfg.giftsStore || '').trim();
    if (!store && url) { const f = STORES.find(([rx]) => rx.test(url)); store = f ? f[1] : 'nuestra mesa de regalos'; }
    return { url, text, store, image: String(cfg.giftsImage || '').trim() };
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

  // Calcula background-position para que el punto elegido (fx, fy en %) quede en (tx, ty) de la caja,
  // con la foto cubriendo toda la caja (como background-size: cover).
  function focusPosition(focus, iw, ih, W, H, tx = 0.5, ty = 0.5) {
    const m = String(focus || '').match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    const fx = m ? +m[1] / 100 : 0.5, fy = m ? +m[2] / 100 : 0.3;
    if (!iw || !ih || !W || !H) return Math.round(fx * 100) + '% ' + Math.round(fy * 100) + '%';
    const s = Math.max(W / iw, H / ih);
    const sw = iw * s, sh = ih * s;
    const axis = (box, size, f, t) => {
      if (size - box < 1) return 50;
      const off = Math.min(0, Math.max(box - size, box * t - f * size)); // desplazamiento (≤ 0)
      return (off / (box - size)) * 100;
    };
    return axis(W, sw, fx, tx).toFixed(1) + '% ' + axis(H, sh, fy, ty).toFixed(1) + '%';
  }

  // Paletas listas para elegir en Ajustes
  const PALETTES = [
    { name: 'Bosque', theme: '#9a7b4f', colorBg: '#f7f2ea', colorCard: '#fffdf9', colorText: '#2f2a24', colorNature: '#5f6b56' },
    { name: 'Terracota', theme: '#b5653f', colorBg: '#f8efe6', colorCard: '#fffaf5', colorText: '#3a2a22', colorNature: '#7a6a4f' },
    { name: 'Vino', theme: '#7b2d3b', colorBg: '#f6eeee', colorCard: '#fffafa', colorText: '#2e2024', colorNature: '#4f5d4b' },
    { name: 'Azul noche', theme: '#2f4a6b', colorBg: '#eef2f6', colorCard: '#fbfdff', colorText: '#1e2a38', colorNature: '#3f5a5a' },
    { name: 'Rosa palo', theme: '#b77b86', colorBg: '#faf1f1', colorCard: '#fffafa', colorText: '#3b2c30', colorNature: '#7f8f78' },
    { name: 'Lavanda', theme: '#7c6a9e', colorBg: '#f4f1f8', colorCard: '#fdfcff', colorText: '#2c2738', colorNature: '#5f6b7a' },
    { name: 'Olivo y oro', theme: '#a8892f', colorBg: '#f3f1e7', colorCard: '#fffef8', colorText: '#2a2a1f', colorNature: '#5b6338' }
  ];

  function applyTheme(cfg) {
    const r = document.documentElement.style;
    const ok = (c) => /^#[0-9a-f]{6}$/i.test(String(c || '').trim());
    const set = (v, c, d) => r.setProperty(v, ok(c) ? c.trim() : d);
    set('--accent', cfg.theme, DEFAULT_CONFIG.theme);
    set('--bg', cfg.colorBg, DEFAULT_CONFIG.colorBg);
    set('--card', cfg.colorCard, DEFAULT_CONFIG.colorCard);
    set('--ink', cfg.colorText, DEFAULT_CONFIG.colorText);
    set('--nature', cfg.colorNature, DEFAULT_CONFIG.colorNature);
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
    // Lo que el invitado puede ver de su invitación (igual que Apps Script): sin teléfonos ni notas
    const pub = (g) => g && { id: g.id, name: g.name, label: groupLabel(g), invited: g.invited, status: g.status, members: members(g), attendees: attendingIdx(g).join(','), diet: g.diet, comments: g.comments, song: g.song };
    const find = (p) => {
      const tel = normPhone(p.phone), n = norm(p.name);
      return (p.g && db.guests.find((x) => x.id === p.g)) ||
        (tel && db.guests.find((x) => phoneList(x.phone).includes(tel))) ||
        (n && db.guests.find((x) => members(x).some((m) => norm(m) === n))) || null;
    };
    if (action === 'public') {
      const res = ok({ config: publicConfig(db.config) });
      const g = p.g && db.guests.find((x) => x.id === p.g);
      if (g) res.guest = pub(g);
      return res;
    }
    if (action === 'lookup') return ok({ guest: pub(find(p)) });
    if (action === 'rsvp') {
      const tel = normPhone(p.phone);
      if (!tel) return { ok: false, error: 'Escribe tu número de celular (10 dígitos)' };
      let g = find(p);
      const isNew = !g;
      if (isNew) {
        const name = String(p.name || '').trim();
        if (!name) return { ok: false, error: 'Falta el nombre' };
        g = { id: newId(), name, group: '', phone: '', email: '', invited: 1, status: 'pendiente', companions: 0, companionNames: '', attendees: '', diet: '', comments: '', cabin: '', song: '', source: 'web', invitedAt: '', updated: '', change: '', notes: '' };
        db.guests.push(g);
      }
      const prevS = g.status, prevA = attendingIdx(g), seated = isSeated(g.id);
      const ms = members(g);
      (p.memberNames || []).forEach((nm, i) => { nm = String(nm || '').trim(); if (i > 0 && i < ms.length && nm && isPlaceholderName(ms[i])) ms[i] = nm; });
      const idx = Array.from(new Set((p.attendees || []).map(Number))).filter((i) => i >= 0 && i < ms.length).sort((x, y) => x - y);
      Object.assign(g, {
        companionNames: ms.slice(1).join(', '), status: idx.length ? 'si' : 'no', attendees: idx.join(','), companions: Math.max(0, idx.length - 1),
        diet: String(p.diet || '').trim(), comments: String(p.comments || '').trim(), song: String(p.song || '').trim(), updated: new Date().toISOString()
      });
      if (!phoneList(g.phone).includes(tel)) g.phone = phoneList(g.phone).concat(tel).join(', ');
      const now = attendingIdx(g);
      if (!isNew && (prevS !== g.status || prevA.join() !== now.join()) && (prevS !== 'pendiente' || seated)) {
        g.change = 'Antes: ' + STATUS_LABEL[prevS] + ' (' + prevA.length + ') → Ahora: ' + STATUS_LABEL[g.status] + ' (' + now.length + ')';
      }
      demoSave(db);
      return ok({ id: g.id, guest: pub(g) });
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


  /* ---- Íconos de línea fina (dibujados aquí, sin depender de nada externo) ---- */
  const ICONS = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    church: '<path d="M12 2v4M10 4h4M6 21V11l6-5 6 5v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4"/>',
    cheers: '<path d="M5 3h5l-.5 6a2 2 0 0 1-4 0zM14 3h5l-.5 6a2 2 0 0 1-4 0zM7.5 11v8M16.5 11v8M5 21h5M14 21h5"/>',
    rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 6l2-3 2 3"/>',
    hanger: '<path d="M10 5a2 2 0 1 1 2 2v1.5M12 8.5l-8.4 7a1 1 0 0 0 .6 1.8h15.6a1 1 0 0 0 .6-1.8z"/>',
    house: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/>',
    bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
    note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8C10 4 7 4 7 6s3 2 5 2c2 0 5 0 5-2s-3-2-5 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    film: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    heart: '<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>',
    envelope: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    mountain: '<path d="M3 20l6-10 4 6 2-3 6 7z"/>',
    pine: '<path d="M12 3l5 7h-3l4 6h-5v5h-2v-5H6l4-6H7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    car: '<path d="M5 16v-4l2-5h10l2 5v4M3 16h18v3H3zM7 19v2M17 19v2"/>',
    food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    flower: '<circle cx="12" cy="10" r="2.2"/><path d="M12 7.8C11 4 13 4 12 7.8zM12 12.2V21M12 17c-2-2-5-2-6-1 2 2 4 2 6 1zM12 17c2-2 5-2 6-1-2 2-4 2-6 1z"/><path d="M14.2 10c3.8-1 3.8 1 0 0zM9.8 10c-3.8-1-3.8 1 0 0zM12 7.8c-1-3.8 1-3.8 0 0z"/>',
    cake: '<path d="M4 21h16M5 21v-7h14v7M7 14v-3h10v3M12 11V8M12 4.5c.8.8.8 2 0 2.5-.8-.5-.8-1.7 0-2.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'
  };
  // [clave, nombre en el panel, ícono fino, emoji]
  const ICON_SLOTS = [
    ['icoWhen', 'Cuándo', 'calendar', '📅'], ['icoCeremony', 'Ceremonia', 'church', '⛪'], ['icoParty', 'Fiesta', 'cheers', '🥂'],
    ['icoDress', 'Vestimenta', 'hanger', '👔'], ['icoLodging', 'Alojamiento', 'house', '🏡'], ['icoInstr', 'Indicaciones', 'note', '📝'],
    ['icoGifts', 'Mesa de regalos', 'gift', '🎁'], ['icoInicio', 'Marcador: Inicio', 'mountain', '🏔️'], ['icoHistoria', 'Marcador: Historia', 'heart', '💞'],
    ['icoPreboda', 'Marcador: Video preboda', 'film', '🎬'], ['icoDetalles', 'Marcador: El gran día', 'calendar', '📅'], ['icoUbicacion', 'Marcador: Cómo llegar', 'pin', '📍'],
    ['icoMusica', 'Marcador: Música', 'music', '🎶'], ['icoVideo', 'Marcador: Video', 'camera', '📽️'], ['icoConfirmar', 'Marcador: Confirmar', 'envelope', '💌'],
    ['icoRecs', 'Marcador: Recomendaciones', 'sparkle', '✨'], ['icoFaq', 'Marcador: Preguntas', 'question', '❓']
  ];
  // Secciones y tarjetas que se pueden ocultar desde el panel
  const SECTION_OPTIONS = [
    ['bienvenida', 'Mensaje de bienvenida'], ['historia', 'Nuestra historia'], ['preboda', 'Video preboda'],
    ['detalles', 'El gran día (sección completa)'], ['cardWhen', '· Tarjeta “Cuándo” y calendario'], ['placeCards', '· Tarjetas de ceremonia y fiesta'],
    ['itineraryBox', '· Programa del día'], ['cardDress', '· Código de vestimenta'], ['cardLodging', '· Alojamiento'],
    ['lodgingRecsBox', '· Opciones de hospedaje'], ['cardInstr', '· Indicaciones'], ['cardGifts', '· Mesa de regalos'],
    ['ubicacion', 'Cómo llegar (mapas)'], ['musica', 'Nuestra música'], ['video', 'Video de la boda'],
    ['confirmar', 'Confirmar asistencia'], ['recomendaciones', 'Recomendaciones'], ['faq', 'Preguntas frecuentes']
  ];
  function svgIcon(name) {
    return '<svg class="i-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.star) + '</svg>';
  }
  // Valor guardado: '' = predeterminado · 'svg:nombre' = ícono fino · https://… = imagen · cualquier otro texto = emoji
  function iconHtml(cfg, slot, fallbackEmoji) {
    const def = ICON_SLOTS.find((s) => s[0] === slot) || [slot, '', 'star', fallbackEmoji || '✨'];
    const v = String((cfg && cfg[slot]) || '').trim();
    if (!v) return (cfg && cfg.iconStyle === 'emoji') ? '<span class="i-emo">' + def[3] + '</span>' : svgIcon(def[2]);
    if (v.startsWith('svg:')) return svgIcon(v.slice(4));
    if (/^(https?:|data:image)/i.test(v)) return '<img class="i-img" src="' + esc(v) + '" alt="">';
    return '<span class="i-emo">' + esc(v) + '</span>';
  }


  /* ---- Nombres de la portada: tipografía, tamaño y acomodo ---- */
  const NAME_FONTS = [
    ['Cormorant Garamond', 'Clásica'], ['Playfair Display', 'Elegante'], ['Cinzel', 'Romana'], ['Italiana', 'Fina'],
    ['Bodoni Moda', 'Moda'], ['Marcellus', 'Grabada'], ['Great Vibes', 'Caligrafía'], ['Parisienne', 'Parisina'],
    ['Allura', 'Manuscrita'], ['Pinyon Script', 'Pluma'], ['Dancing Script', 'Casual'], ['Tangerine', 'Delicada']
  ];
  function loadFonts(list) {
    const fams = list.filter((f) => f && NAME_FONTS.some((x) => x[0] === f) && f !== 'Cormorant Garamond');
    if (!fams.length) return;
    const href = 'https://fonts.googleapis.com/css2?' + fams.map((f) => 'family=' + f.replace(/ /g, '+')).join('&') + '&display=swap';
    if (document.querySelector('link[href="' + href + '"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  function displayName(n, show) {
    n = String(n || '').trim();
    const p = n.split(/\s+/).filter(Boolean);
    if (show === 'first') return p[0] || n;
    if (show === 'firstlast' && p.length >= 3) return p[0] + ' ' + p[p.length - 2];
    return n;
  }
  function namesHtml(cfg, withIds) {
    const a = displayName(cfg.name1, cfg.namesShow), b = displayName(cfg.name2, cfg.namesShow);
    return '<span class="n1"' + (withIds ? ' id="n1"' : '') + '>' + esc(a) + '</span><span class="amp">' + esc(cfg.namesAmp || '&') + '</span><span class="n2"' + (withIds ? ' id="n2"' : '') + '>' + esc(b) + '</span>';
  }
  function applyNames(cfg, el) {
    const font = NAME_FONTS.some((x) => x[0] === cfg.namesFont) ? cfg.namesFont : 'Cormorant Garamond';
    loadFonts([font]);
    const num = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(0, Math.min(100, n)); };
    const fam = "'" + font + "', 'Cormorant Garamond', Georgia, serif";
    document.documentElement.style.setProperty('--names-font', fam);
    if (!el) return;
    el.innerHTML = namesHtml(cfg, el.id === 'heroNames');
    el.className = 'names l-' + (cfg.namesLayout || 'row') + (cfg.namesCase === 'upper' ? ' up' : '');
    el.style.setProperty('--nf', fam);
    el.style.setProperty('--ns', (0.5 + num(cfg.namesSize, 50) / 100).toFixed(2));
    el.style.setProperty('--nls', (num(cfg.namesSpacing, 0) / 100 * 0.35).toFixed(3) + 'em');
  }
  // Orden de las secciones principales: las guardadas primero, luego las que falten en su orden original
  function sectionOrder(saved) {
    const all = SECTION_OPTIONS.filter((o) => o[1][0] !== '·').map((o) => o[0]);
    const list = String(saved || '').split(',').map((x) => x.trim()).filter((x) => all.includes(x));
    return list.concat(all.filter((x) => !list.includes(x)));
  }

  window.Boda = {
    DEFAULT_CONFIG, FIELDS, STATUS_LABEL, NAME_FONTS, loadFonts, displayName, namesHtml, applyNames, sectionOrder, ICONS, ICON_SLOTS, SECTION_OPTIONS, svgIcon, iconHtml, $, $$, esc, norm, newId, splitNames, partySize, memberName, members, attendingIdx, isPlaceholderName, normPhone, phoneList, groupLabel, PALETTES, initials, hueOf,
    zonedToDate, eventDates, formatLongDate, formatShortDate, formatTime,
    googleCalUrl, outlookUrl, icsText, icsDataUrl,
    mapsLink, wazeLink, appleMapsLink, mapEmbed, mapQuery, places, fmtHour,
    ytEmbed, ytMusicLink, ytPlaylistId, ytVideoId,
    focusPosition, giftsInfo, parseItems, shareLinks, waPhone, siteBaseUrl, guestLink, fillTemplate, copyText, applyTheme, toast,
    api, isDemo, demoReset, DEMO_KEY,
    withDefaults: (cfg) => Object.assign({}, DEFAULT_CONFIG, Object.fromEntries(Object.entries(cfg || {}).filter(([k, v]) => v != null && (v !== '' || !['name1', 'name2', 'date', 'timezone', 'theme', 'inviteTemplate'].includes(k)))))
  };
})();
