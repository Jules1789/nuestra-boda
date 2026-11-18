# Web de boda + panel de organizadores

Página para invitados con confirmación de asistencia y un panel privado (con clave) para la lista de invitados y el plano de mesas.

Este código **no contiene datos personales**: nombres, fechas, lugares, fotos, invitados y mesas se escriben desde el panel y se guardan en **Google Sheets** (y las fotos en Google Drive) del dueño de la boda.

## Qué hay aquí

| Página | Quién la ve | Para qué |
|---|---|---|
| `index.html` | Invitados | Portada con foto y montañas animadas, cuenta regresiva, historia con fotos, video preboda, detalles, programa, mapas, playlist, guardar en calendario, confirmación de asistencia y marcadores para saltar entre secciones. |
| `admin.html` | Solo organizadores (con clave) | Resumen en tiempo real, invitados, pegar lista, WhatsApp en un toque, exportar a Excel/PDF, plano de mesas y ajustes. |
| `apps-script/Codigo.gs` | Google Sheets | El “servidor”: guarda todo en la hoja de cálculo. |

## Conectar con Google Sheets (una sola vez)

1. Abre tu hoja de Google Sheets → **Extensiones → Apps Script**.
2. Borra lo que haya y pega todo `apps-script/Codigo.gs`. Guarda.
3. Elige la función **configurarHoja** → ▶ **Ejecutar** → acepta los permisos (Sheets y Drive).
   - Se crean las pestañas `App Invitados`, `App Mesas`, `App Configuracion` y `App PlanoDatos`.
   - Si tienes una pestaña **Invitados**, se importa agrupada por familia (no se modifica).
   - Aparece la **clave del panel** (también queda en `App Configuracion`, fila `adminPin`).
4. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: **Yo** · Acceso: **Cualquier persona**.
5. Copia la URL que termina en `/exec` y ponla en `js/config.js` (`API_URL`).

Sin `API_URL` la página funciona en **modo demostración** (los datos se quedan solo en ese navegador).

## Llenar la boda

Entra a `admin.html` con tu clave → **Ajustes**: nombres, fecha, lugares y mapas, historia, fotos, videos, vestimenta, alojamiento, etc. Al guardar, la página de invitados se actualiza sola.
