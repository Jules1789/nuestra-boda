/**
 * Web de boda — Backend en Google Sheets (Google Apps Script)
 *
 * CÓMO INSTALAR (5 minutos, sin conocimientos técnicos):
 *  1. Abre tu Google Sheets  →  menú Extensiones  →  Apps Script.
 *  2. Borra lo que haya en el editor y pega TODO este archivo. Guarda (icono de disquete).
 *  3. Arriba elige la función "configurarHoja" y pulsa ▶ Ejecutar. Acepta los permisos.
 *     (Se crean solas las pestañas "App Invitados", "App Mesas", "App Configuracion" y
 *      "App PlanoDatos", y se importa tu lista de la pestaña "Invitados" agrupada por familia.
 *      Tus pestañas originales NO se modifican.)
 *  4. Botón azul "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier persona
 *     Pulsa Implementar y copia la URL que termina en /exec.
 *  5. Esa URL va en el archivo js/config.js (API_URL). ¡Listo!
 *
 * Si más adelante cambias este código: Implementar → Gestionar implementaciones → ✏️ →
 * Versión: "Nueva versión" → Implementar (así la URL sigue siendo la misma).
 */

// Pestañas propias de la app (NO toca tus pestañas existentes: Tablero, Invitados, Cabañas, etc.)
var HOJA_INVITADOS = 'App Invitados';
var HOJA_CONFIG = 'App Configuracion';
var HOJA_PLANO = 'App PlanoDatos';
var HOJA_MESAS = 'App Mesas';
var HOJA_LISTA_ORIGINAL = 'Invitados'; // tu lista original (solo se LEE para importarla)
var CARPETA_FOTOS = 'Boda - Fotos de la web';

var COLUMNAS = [
  ['id', 'ID'],
  ['name', 'Nombre'],
  ['group', 'Grupo / Familia'],
  ['phone', 'Teléfono'],
  ['email', 'Email'],
  ['invited', 'Lugares asignados'],
  ['status', 'Asistencia'],
  ['companions', 'Acompañantes'],
  ['companionNames', 'Nombres de acompañantes'],
  ['diet', 'Restricciones alimentarias'],
  ['comments', 'Comentarios'],
  ['cabin', 'Cabaña'],
  ['song', 'Canción sugerida'],
  ['source', 'Origen'],
  ['invitedAt', 'Invitación enviada'],
  ['updated', 'Última actualización'],
  ['change', 'Cambio de respuesta'],
  ['notes', 'Notas privadas']
];

var ESTADO_A_TEXTO = { si: 'Confirmado', no: 'No asiste', pendiente: 'Pendiente' };

// Claves de configuración que NUNCA se envían a la web pública
var CONFIG_PRIVADA = ['adminPin'];

// Arranca en blanco: los datos de la boda se llenan desde el panel (Ajustes) o en esta pestaña.
// La clave del panel se genera al azar al instalar (la ves en la pestaña "App Configuracion").
var CONFIG_INICIAL = [
  ['name1', '', 'Nombre de la primera persona'],
  ['name2', '', 'Nombre de la segunda persona'],
  ['date', '', 'Fecha y hora de inicio (AAAA-MM-DDTHH:MM)'],
  ['endDate', '', 'Fecha y hora de fin'],
  ['timezone', 'America/Mexico_City', 'Zona horaria']
];

/* ------------------------------------------------------------------ */
/*  Instalación                                                         */
/* ------------------------------------------------------------------ */

function configurarHoja() {
  var ss = SpreadsheetApp.getActive();
  var inv = hoja_(HOJA_INVITADOS);
  if (inv.getLastRow() === 0) {
    inv.appendRow(COLUMNAS.map(function (c) { return c[1]; }));
    inv.setFrozenRows(1);
    inv.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#f3ead9');
    inv.hideColumns(1);
  }
  var cfg = hoja_(HOJA_CONFIG);
  if (cfg.getLastRow() === 0) {
    cfg.appendRow(['clave', 'valor', 'descripción']);
    cfg.setFrozenRows(1);
    cfg.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f3ead9');
    CONFIG_INICIAL.forEach(function (r) { cfg.appendRow(r); });
  }
  // Clave del panel: si no hay una, se crea una al azar de 6 números
  var actual = leerConfig_();
  if (!actual.adminPin || actual.adminPin === '1234') {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    guardarConfig_({ adminPin: pin });
    var aviso = 'La clave de tu panel de organizadores es: ' + pin + '\n\nApúntala. También la ves en la pestaña "App Configuracion" (fila adminPin) y ahí mismo la puedes cambiar.';
    Logger.log(aviso);
    try { SpreadsheetApp.getUi().alert(aviso); } catch (e) { /* si se ejecuta sin la hoja abierta */ }
  }
  hoja_(HOJA_PLANO);
  carpetaFotos_(); // pide permiso de Google Drive para guardar las fotos que suban
  if (hoja_(HOJA_INVITADOS).getLastRow() < 2) importarListaExistente();
  var mesas = hoja_(HOJA_MESAS);
  if (mesas.getLastRow() === 0) mesas.appendRow(['Mesa', 'Asiento', 'Invitado', 'Grupo / Familia', 'Asistencia']);
  ss.toast('¡Hoja lista! Ahora: Implementar → Nueva implementación → Aplicación web.');
}

/**
 * Importa tu pestaña "Invitados" (una fila por persona) a "App Invitados"
 * (una invitación por Familia / grupo, con sus acompañantes). Solo lee tu pestaña.
 */
function importarListaExistente() {
  var ss = SpreadsheetApp.getActive();
  var orig = ss.getSheetByName(HOJA_LISTA_ORIGINAL);
  if (!orig || orig.getLastRow() < 2) return;
  var datos = orig.getRange(1, 1, orig.getLastRow(), orig.getLastColumn()).getDisplayValues();
  var cab = datos[0].map(function (c) { return normalizar_(c); });
  function col(txt) { for (var i = 0; i < cab.length; i++) if (cab[i].indexOf(txt) === 0) return i; return -1; }
  var cLado = col('lado'), cFam = col('familia'), cNom = col('nombre'), cRel = col('relacion'),
    cCab = col('cabana'), cNot = col('notas'), cConf = col('confirmo');
  var familias = [], porClave = {};
  for (var r = 1; r < datos.length; r++) {
    var f = datos[r];
    var nombre = cNom >= 0 ? String(f[cNom]).trim() : '';
    if (!nombre) continue;
    var clave = (cFam >= 0 && f[cFam] ? f[cFam] : nombre) + '|' + (cLado >= 0 ? f[cLado] : '');
    if (!porClave[clave]) {
      porClave[clave] = { lado: cLado >= 0 ? f[cLado] : '', familia: cFam >= 0 ? f[cFam] : '', miembros: [], cabanas: [], notas: [], conf: [] };
      familias.push(porClave[clave]);
    }
    var fam = porClave[clave];
    fam.miembros.push(nombre);
    if (cCab >= 0 && f[cCab] && fam.cabanas.indexOf(f[cCab]) < 0) fam.cabanas.push(f[cCab]);
    var rel = cRel >= 0 ? f[cRel] : '';
    var nota = cNot >= 0 ? f[cNot] : '';
    if (rel || nota) fam.notas.push(nombre + ': ' + [rel, nota].filter(String).join(' · '));
    if (cConf >= 0) fam.conf.push(String(f[cConf]).trim());
    if (/^novi[oa]$/i.test(String(rel).trim())) fam.conf.push('si');
  }
  var existentes = {};
  leerInvitados_().forEach(function (g) { existentes[normalizar_(g.name)] = true; });
  var ahora = new Date().toISOString();
  var nuevos = familias.filter(function (fam) { return !existentes[normalizar_(fam.miembros[0])]; }).map(function (fam) {
    var conf = fam.conf.some(function (c) { return /^(si|sí|confirm)/i.test(c); });
    return {
      id: nuevoId_(), name: fam.miembros[0], group: fam.lado, phone: '', email: '',
      invited: fam.miembros.length, status: conf ? 'si' : 'pendiente', companions: conf ? fam.miembros.length - 1 : 0,
      companionNames: fam.miembros.slice(1).join(', '), diet: '', comments: '', cabin: fam.cabanas.join(' / '),
      song: '', source: 'lista', invitedAt: '', updated: ahora, change: '',
      notes: (fam.familia && fam.familia !== fam.miembros[0] ? 'Familia/grupo: ' + fam.familia + '. ' : '') + fam.notas.join(' | ')
    };
  });
  if (nuevos.length) upsert_(nuevos);
  ss.toast('Importadas ' + nuevos.length + ' invitaciones desde la pestaña "Invitados".');
}

function hoja_(nombre) {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

/* ------------------------------------------------------------------ */
/*  Entrada HTTP                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) { return responder_(e && e.parameter ? e.parameter : {}); }

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { p = {}; }
  return responder_(p);
}

function responder_(p) {
  var out;
  try { out = enrutar_(p); } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function enrutar_(p) {
  var accion = p.action || 'public';
  if (accion === 'public') return publico_(p);
  if (accion === 'rsvp') return conBloqueo_(function () { return rsvp_(p); });

  // --- Todo lo demás es solo para organizadores ---
  var cfg = leerConfig_();
  if (!cfg.adminPin || String(p.key || '') !== String(cfg.adminPin)) return { ok: false, error: 'Clave incorrecta' };

  switch (accion) {
    case 'admin_login': return { ok: true };
    case 'admin_all': return { ok: true, config: cfg, guests: leerInvitados_(), plan: leerPlano_(), now: new Date().toISOString() };
    case 'admin_guests': return { ok: true, guests: leerInvitados_(), planUpdated: (leerPlano_() || {}).updated || '', now: new Date().toISOString() };
    case 'admin_upsert': return conBloqueo_(function () { return upsert_(p.guests || []); });
    case 'admin_delete': return conBloqueo_(function () { return borrar_(p.ids || []); });
    case 'admin_plan': return conBloqueo_(function () { return guardarPlano_(p.plan); });
    case 'admin_config': return conBloqueo_(function () { return guardarConfig_(p.config || {}); });
    case 'admin_upload': return subirFoto_(p);
  }
  return { ok: false, error: 'Acción desconocida' };
}

function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/*  Configuración                                                       */
/* ------------------------------------------------------------------ */

function leerConfig_() {
  var sh = hoja_(HOJA_CONFIG);
  var cfg = {};
  if (sh.getLastRow() < 2) return cfg;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    if (r[0]) cfg[String(r[0]).trim()] = r[1];
  });
  return cfg;
}

function guardarConfig_(nueva) {
  var sh = hoja_(HOJA_CONFIG);
  var filas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  var indice = {};
  filas.forEach(function (r, i) { indice[String(r[0]).trim()] = i + 2; });
  Object.keys(nueva).forEach(function (k) {
    var v = nueva[k] == null ? '' : String(nueva[k]);
    if (indice[k]) {
      sh.getRange(indice[k], 2).setNumberFormat('@').setValue(v);
    } else {
      sh.appendRow([k, '', '']);
      sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(v);
    }
  });
  return { ok: true, config: leerConfig_() };
}

/* ------------------------------------------------------------------ */
/*  Invitados                                                           */
/* ------------------------------------------------------------------ */

function textoAEstado_(t) {
  t = String(t || '').toLowerCase();
  if (t.indexOf('confirm') === 0 || t === 'si' || t === 'sí') return 'si';
  if (t.indexOf('no') === 0) return 'no';
  return 'pendiente';
}

function leerInvitados_() {
  var sh = hoja_(HOJA_INVITADOS);
  if (sh.getLastRow() < 2) return [];
  var datos = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  var cab = datos[0];
  var idx = {};
  COLUMNAS.forEach(function (c) { idx[c[0]] = cab.indexOf(c[1]); });
  var lista = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var g = {};
    COLUMNAS.forEach(function (c) { g[c[0]] = idx[c[0]] >= 0 ? f[idx[c[0]]] : ''; });
    if (!g.name && !g.id) continue;
    if (!g.id) { g.id = nuevoId_(); sh.getRange(i + 1, idx.id + 1).setValue(g.id); }
    g.status = textoAEstado_(g.status);
    g.invited = parseInt(g.invited, 10) || 1;
    g.companions = parseInt(g.companions, 10) || 0;
    lista.push(g);
  }
  return lista;
}

function escribirInvitados_(lista) {
  var sh = hoja_(HOJA_INVITADOS);
  var filas = lista.map(function (g) {
    return COLUMNAS.map(function (c) {
      var v = g[c[0]];
      if (c[0] === 'status') v = ESTADO_A_TEXTO[v] || 'Pendiente';
      return v == null ? '' : v;
    });
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  if (filas.length) {
    var rango = sh.getRange(2, 1, filas.length, COLUMNAS.length);
    rango.setNumberFormat('@');
    rango.setValues(filas.map(function (f) { return f.map(String); }));
  }
}

function upsert_(nuevos) {
  var lista = leerInvitados_();
  var porId = {};
  lista.forEach(function (g) { porId[g.id] = g; });
  nuevos.forEach(function (n) {
    if (!n.id) n.id = nuevoId_();
    if (porId[n.id]) {
      Object.keys(n).forEach(function (k) { porId[n.id][k] = n[k]; });
    } else {
      porId[n.id] = n;
      lista.push(n);
    }
  });
  escribirInvitados_(lista);
  return { ok: true, guests: leerInvitados_() };
}

function borrar_(ids) {
  var quitar = {};
  ids.forEach(function (id) { quitar[id] = true; });
  escribirInvitados_(leerInvitados_().filter(function (g) { return !quitar[g.id]; }));
  var plano = leerPlano_();
  if (plano && plano.seats) {
    Object.keys(plano.seats).forEach(function (k) { if (quitar[k.split('#')[0]]) delete plano.seats[k]; });
    guardarPlano_(plano);
  }
  return { ok: true, guests: leerInvitados_() };
}

function nuevoId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function normalizar_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function personas_(g) {
  if (g.status === 'no') return 0;
  if (g.status === 'si') return 1 + (parseInt(g.companions, 10) || 0);
  return Math.max(1, parseInt(g.invited, 10) || 1);
}

/* ------------------------------------------------------------------ */
/*  Web pública                                                         */
/* ------------------------------------------------------------------ */

function publico_(p) {
  var cfg = leerConfig_();
  CONFIG_PRIVADA.forEach(function (k) { delete cfg[k]; });
  var res = { ok: true, config: cfg };
  if (p.g) {
    var g = leerInvitados_().filter(function (x) { return x.id === p.g; })[0];
    if (g) res.guest = {
      id: g.id, name: g.name, invited: g.invited, status: g.status, companions: g.companions,
      companionNames: g.companionNames, diet: g.diet, comments: g.comments, song: g.song, phone: g.phone, cabin: g.cabin
    };
  }
  return res;
}

function rsvp_(p) {
  var nombre = String(p.name || '').trim();
  if (!nombre) return { ok: false, error: 'Falta el nombre' };
  var lista = leerInvitados_();
  var g = null;
  if (p.g) g = lista.filter(function (x) { return x.id === p.g; })[0] || null;
  if (!g) {
    var n = normalizar_(nombre);
    g = lista.filter(function (x) { return normalizar_(x.name) === n; })[0] || null;
  }
  var ahora = new Date().toISOString();
  var asiste = p.attending === true || p.attending === 'si' || p.attending === 'true';
  var acomp = asiste ? Math.max(0, Math.min(20, parseInt(p.companions, 10) || 0)) : 0;
  var esNuevo = !g;
  if (g && g.invited > 0 && g.source !== 'web' && acomp > g.invited - 1) acomp = g.invited - 1;

  if (esNuevo) {
    g = { id: nuevoId_(), name: nombre, group: '', phone: '', email: '', invited: 1 + acomp, status: 'pendiente',
      companions: 0, companionNames: '', diet: '', comments: '', song: '', source: 'web', invitedAt: '', updated: ahora, change: '', notes: '' };
    lista.push(g);
  }
  var antesEstado = g.status, antesPersonas = personas_(g);
  var sentado = estaSentado_(g.id);

  g.status = asiste ? 'si' : 'no';
  g.companions = acomp;
  g.companionNames = String(p.companionNames || '').trim();
  g.diet = String(p.diet || '').trim();
  g.comments = String(p.comments || '').trim();
  g.song = String(p.song || '').trim();
  if (p.phone) g.phone = String(p.phone).trim();
  if (p.email) g.email = String(p.email).trim();
  if (g.source === 'web' && 1 + acomp > g.invited) g.invited = 1 + acomp;
  g.updated = ahora;

  var cambio = antesEstado !== g.status || antesPersonas !== personas_(g);
  if (!esNuevo && cambio && (antesEstado !== 'pendiente' || sentado)) {
    g.change = 'Antes: ' + ESTADO_A_TEXTO[antesEstado] + ' (' + antesPersonas + ') → Ahora: ' +
      ESTADO_A_TEXTO[g.status] + ' (' + personas_(g) + ')';
  }
  escribirInvitados_(lista);
  return { ok: true, id: g.id };
}

/* ------------------------------------------------------------------ */
/*  Plano de mesas (solo organizadores)                                 */
/* ------------------------------------------------------------------ */

function leerPlano_() {
  var sh = hoja_(HOJA_PLANO);
  if (sh.getLastRow() < 1) return null;
  var txt = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; }).join('');
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

function estaSentado_(id) {
  var plano = leerPlano_();
  if (!plano || !plano.seats) return false;
  return Object.keys(plano.seats).some(function (k) { return k.split('#')[0] === id; });
}

function guardarPlano_(plano) {
  if (!plano) return { ok: false, error: 'Plano vacío' };
  var txt = JSON.stringify(plano);
  var sh = hoja_(HOJA_PLANO);
  sh.clearContents();
  var trozos = [];
  for (var i = 0; i < txt.length; i += 40000) trozos.push([txt.slice(i, i + 40000)]);
  sh.getRange(1, 1, trozos.length, 1).setNumberFormat('@').setValues(trozos);
  escribirMesasLegibles_(plano);
  return { ok: true, updated: plano.updated };
}

// Pestaña "Mesas": versión fácil de leer / imprimir desde Google Sheets
function escribirMesasLegibles_(plano) {
  var invitados = {};
  leerInvitados_().forEach(function (g) { invitados[g.id] = g; });
  var filas = [];
  (plano.tables || []).forEach(function (t) {
    var ocupados = {};
    Object.keys(plano.seats || {}).forEach(function (k) {
      var a = plano.seats[k];
      if (a.t === t.id) ocupados[a.s] = k;
    });
    for (var s = 0; s < t.seats; s++) {
      var k = ocupados[s];
      var nombre = '', grupo = '', estado = '';
      if (k) {
        var partes = k.split('#');
        var g = invitados[partes[0]];
        var n = parseInt(partes[1], 10) || 0;
        if (g) {
          var acomp = String(g.companionNames || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(String);
          nombre = n === 0 ? g.name : (acomp[n - 1] || ('Acompañante ' + n + ' de ' + g.name));
          grupo = g.group;
          estado = ESTADO_A_TEXTO[g.status] || '';
        }
      }
      filas.push([t.name, s + 1, nombre, grupo, estado]);
    }
  });
  var sh = hoja_(HOJA_MESAS);
  sh.clearContents();
  sh.appendRow(['Mesa', 'Asiento', 'Invitado', 'Grupo / Familia', 'Asistencia']);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f3ead9');
  if (filas.length) sh.getRange(2, 1, filas.length, 5).setValues(filas);
}

/* ------------------------------------------------------------------ */
/*  Fotos (portada y galería) en Google Drive                           */
/* ------------------------------------------------------------------ */

function carpetaFotos_() {
  var it = DriveApp.getFoldersByName(CARPETA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FOTOS);
}

// Recibe una foto (ya reducida en el navegador), la guarda en Drive y devuelve un enlace público para la web
function subirFoto_(p) {
  var m = String(p.data || '').match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!m) return { ok: false, error: 'La imagen no es válida' };
  var nombre = String(p.name || 'foto').replace(/[^\w.-]+/g, '_').slice(0, 60);
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nombre);
  var archivo = carpetaFotos_().createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, id: archivo.getId(), url: 'https://lh3.googleusercontent.com/d/' + archivo.getId() + '=w2000' };
}
