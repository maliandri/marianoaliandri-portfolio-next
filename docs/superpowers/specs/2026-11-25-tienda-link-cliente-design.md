# Tienda: venta por consulta (servicios + asistente + Meet + link de pago)

Fecha: 2026-11-25 · Rama: `feat/home-ia` · Complementa `2026-11-23-reposicionamiento-ia.md`.

## Por qué

- Las ventas se cierran **hablando, por fuera del sitio**. De los 18 presupuestos en Firestore desde julio, 17 los armó Mariano
  (11 admin, 6 MCP), 1 llegó solo por el formulario y 0 por la tienda. Nunca se vendió por MercadoPago desde el sitio.
- Una clienta (Mónica Rospide) pidió presupuesto y **no lo entendió**: lista técnica, sin explicación.
- Decisión de Mariano: **venta por consulta**. El cliente entiende y marca lo que quiere, charlan (Meet o en persona), cierran
  alcance y precio, y recién ahí recibe el link para pagar lo acordado.

## El recorrido

1. **Tienda pública** (`/tienda`): el cliente ve todos los servicios explicados en criollo y marca los que le interesan. **Nadie
   ve precios.** A la derecha, un **asistente** le explica lo que marca y le responde preguntas.
2. **Solicitud** (con sesión de Google): lo marcado + datos de contacto + notas + **Meet opcional** (elige un horario libre de
   Mariano o "prefiero que me escriban").
3. **Mariano** revisa la solicitud en admin → Presupuestos (servicios, preguntas que hizo al asistente, horario pedido) y
   **acepta el Meet** → se crea el evento en su Google Calendar con link de Meet y al cliente le llega la invitación.
4. Charlan y cierran alcance y precio.
5. Mariano arma el presupuesto (armador del admin o Claude/MCP, como hoy) y le manda el **link de pago** (página "Hola Mónica").

## Objetivos

1. Tienda de servicios sin precios, entendible por alguien que no sabe de webs.
2. Asistente a la derecha que explica cada selección y responde cualquier pregunta sobre los servicios, con mucho contexto.
3. Solicitud de presupuesto con Meet opcional, enganchada a la colección `presupuestos` y al admin.
4. Meet con aprobación de Mariano, usando su Google Calendar.
5. Página del presupuesto para el cliente con el link de pago.
6. Precios **solo para Mariano**.
7. Arreglar lo que se pisa.

## No objetivos

- Que el cliente compre solo sin hablar (opción B descartada).
- Cobro directo desde la tienda (seña / total con 10% off): **se va**.
- Cambiar el armador de presupuestos del admin o del MCP, ni el webhook de pagos.

## Anti-objetivos (fracaso aunque funcione)

- Que un visitante vea un precio, una suma o un "desde" en cualquier lado (tienda, chat, API, HTML).
- Jerga sin traducir (Firestore, Vercel, webhooks, SEO técnico).
- Pedir login para ver o pagar un presupuesto que Mariano ya mandó.
- Que el link de pago deje ver presupuestos ajenos.
- Que se cree un Meet sin que Mariano lo acepte.

## Enfoques considerados

- **A. La tienda como herramienta para cerrar la charla** — elegida, y luego refinada por Mariano en "venta por consulta".
- B. Tienda guiada para comprar solo: descartada (sin demanda comprobada).
- C. Sacar la tienda: descartada.
- Meet: **con aprobación de Mariano (elegido)** vs. reserva directa con la agenda de citas de Google (descartada: queda separada
  de la solicitud y no hay paso de aprobación).

## Diseño

### 1. Tienda (`/tienda`) — layout

```
┌ SERVICIOS (marcás) ─────────────┬ 🤖 ASISTENTE (sticky, alto completo) ┐
│ Empezá con: [Vender online] ... │ Marcaste "Carrito de compras" 👍       │
│ 🛒 Vender online                │ Sirve para que tus clientes armen el   │
│   ☑ Carrito de compras  [?]     │ pedido y paguen solos. Necesita un     │
│   ☐ Catálogo de productos       │ catálogo: ¿lo sumo? [Sí] [No]          │
│ 💳 Cobros                       │ > ¿Puedo cargar los productos yo?      │
│   ☑ MercadoPago ☐ Payway ...    │ Sí: te queda un panel donde…           │
│ ...                             │ [ Escribí tu pregunta…            ➤ ]  │
├ Tu pedido: 6 servicios (sticky) ┤                                        │
│ [ Pedir presupuesto ]           │                                        │
└─────────────────────────────────┴────────────────────────────────────────┘
```

- Los servicios se agrupan por **objetivo en criollo** (Vender online, Cobros, Que te encuentren, Mostrar tu negocio, Turnos y
  clientes, IA para tu negocio, Lo técnico que necesitás…) en vez de las categorías técnicas; mapeo categoría → grupo en código.
- Cada servicio: nombre + una línea de para qué sirve (`benefit`) + checkbox. Las dependencias se siguen sumando solas
  (`resolverDependencias`) y el asistente explica por qué.
- Sale del layout actual: precios, franja de totales con montos, sitio de muestra/armador visual, modos de pago. La franja fija
  pasa a ser **"Tu pedido: N servicios"** + botón "Pedir presupuesto".
- Celular: lista de servicios a pantalla completa; el asistente es una pestaña que sube desde abajo (bottom sheet) con aviso
  cuando hay explicación nueva. El chat flotante del sitio (`AIChatBot`) no se muestra en `/tienda`.

### 2. Asistente

- **Al marcar/desmarcar**: mensaje inmediato armado con la ficha del servicio (sin llamar a la IA): para qué sirve, ejemplo, y si
  se sumó algo por dependencia, por qué. Sugerencias de lo que suele ir junto como botones [Sí] [No].
- **Al escribir**: IA (AI SDK + `conRespaldo` de `src/lib/ai/gemini.js`, como `/api/chat`) con:
  - contexto general (cómo trabaja Mariano, Meet, tiempos, hosting/mantenimiento, qué pasa después de pagar, Neuquén/todo el país);
  - el catálogo completo **sin precios** con las fichas;
  - lo que el cliente tiene marcado.
- **Herramientas**: `ver_ficha(id)`, `sumar_servicio(id)`, `sacar_servicio(id)` (las dos últimas devuelven una acción que aplica
  la UI; el asistente pregunta antes de sumar).
- **Nunca precios**: el prompt lo prohíbe y las herramientas no los tienen; si preguntan, explica que se charlan en el Meet y
  ofrece pedirlo. Test que verifica que ningún dato del contexto lleve `priceUSD`.
- Frenos de `/api/chat`: rate limit por IP/usuario, mensaje ≤1000, historial ≤10 turnos.
- La conversación (últimos ~20 mensajes) se guarda en la solicitud para que Mariano vea qué preguntó.

### 3. Fichas de servicio (contexto)

- Campo nuevo `ficha` en `tienda_catalogo/{id}`: `{ paraQue, ejemplo, necesitoDeVos, tiempo, faq: [{ q, a }] }`, en criollo.
- Las redacta Claude para todos los servicios activos; Mariano las revisa; editables en admin → Tienda (`BenefitsEditor`).
  Semilla en código + acción del admin para cargarlas en Firestore (como "Cargar catálogo inicial").
- Contexto general en `site_config/asistente_tienda` (texto editable en admin) con semilla en código.

### 4. Solicitud de presupuesto

- `POST /api/tienda/` pasa a crear solo la solicitud (exige sesión): `presupuestos` con `origen: 'tienda'`, `status: 'pending'`,
  `servicios` (ids + labels, sin precios), `cliente` (nombre, email, WhatsApp, negocio), `notas`, `chat` (resumen), `meet`.
- `meet`: `{ estado: 'pedido' | 'aceptado' | 'rechazado' | 'sin_meet', inicio, fin, eventId, meetUrl }`.
- Aviso a Mariano por mail (`sendAlert` o mail propio) con lo pedido y el horario.

### 5. Meet con Google Calendar

- Conexión OAuth de la cuenta de Google de Mariano (patrón de `integrations/linkedin`): `integrations/google_calendar` con refresh
  token; scopes `calendar.events` y `calendar.freebusy`. La app de Google Cloud tiene que estar **publicada** (no "testing"): en
  testing el refresh token vence a los 7 días. El chequeo diario (`/api/cron/health/`) avisa si la conexión se cae.
- Horarios: config editable en admin (default lun–vie 9:00–12:00 ART, turnos de 30 min, desde 24 h hasta 14 días adelante).
  `GET /api/tienda/horarios/` devuelve turnos libres (freebusy del calendario principal) sin datos del calendario.
- En la solicitud, el cliente elige un turno o "prefiero que me escriban".
- Admin → Presupuestos: "Aceptar Meet" crea el evento (`conferenceData` → Meet, invitado = email del cliente, `sendUpdates: all`)
  y guarda `eventId`/`meetUrl`; "Rechazar" lo marca y Mariano coordina por WhatsApp. Si el turno se ocupó entre medio, avisa.

### 6. Página del presupuesto para el cliente: `/tu-presupuesto/[id]/?t=<token>`

- Server component; exige `t === pdfToken` (tiempo constante), si no → 404. `noindex`, fuera del sitemap, dinámica.
- "Hola <nombre> 👋", "Lo que vamos a hacer" (label + benefit de cada ítem), total en pesos (y USD chico), [Pagar con
  MercadoPago] = `paymentLink`, [Tengo una duda (WhatsApp)], PDF. Pagado → "¡Recibimos tu pago!". Sin login.
- El link sale en el WhatsApp (`mensajePresupuesto`/`whatsappUrl`), en el mail del presupuesto y como `clienteUrl` en admin y MCP.

### 7. Precios solo para Mariano

- `/api/tienda/precios/`: solo admin. La página `/tienda` y su HTML no llevan precios (ya es así con `sinPrecios`).
- Chat del sitio (`AIChatBot` / `src/lib/ai/chatTools.js`): se saca `cotizar`; queda `ver_servicios` sin precios.
- Admin, armador de presupuestos y MCP siguen con precios.

### 8. Arreglos de lo que se pisa

- Celular: tienda más ancha que la pantalla (se corta con `overflow-x: clip`); logo del header choca con el carrito; flotantes
  tapan la barra inferior.
- Escritorio: columnas sticky bajo el header sin taparse.

### 9. Avisos a Telegram cuando alguien usa la tienda en serio (etapa 1)

- **Sesión anónima**: al entrar a `/tienda` el navegador genera un id de visita. Cada cambio (servicio marcado/desmarcado,
  pregunta al asistente) se manda agrupado (debounce ~3 s) a `POST /api/tienda/sesion/`, que guarda en `tienda_sesiones/{id}`:
  `servicios`, `ultimaPregunta`, `ciudad` (header `x-vercel-ip-city`, aproximada; **no se guarda la IP**), `inicioMs`,
  `ultimoMs`, `avisado`, `solicitudId`. Bots fuera (user-agent).
- **Regla de aviso**: la primera vez que la visita llega a **≥2 servicios** o **escribe una pregunta** → un aviso; **uno solo por
  visita** (`avisado: true`, transacción). Segundo aviso solo si **pide presupuesto** (con el turno de Meet si lo eligió).
- **Canal**: bot de Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` en Vercel) vía `sendMessage` de la Bot API. Texto:
  ciudad, servicios marcados, última pregunta, botón "Ver en vivo" (link al admin). Falla del envío → no rompe nada, se registra.
- Mariano crea el bot con @BotFather y obtiene su chat id (paso manual, documentado en CLAUDE.md).
- Las sesiones viejas se pueden borrar a los 30 días (TTL de Firestore sobre `expiraEn`).
- Política de privacidad: sumar una línea sobre la ciudad aproximada y lo marcado en la tienda.

### 10. Etapa 2 (después): en vivo y respuesta desde Telegram

- Admin → "En vivo": sesiones activas en tiempo real (Firestore `onSnapshot`) con lo marcado y la charla.
- Responder a un aviso en Telegram → webhook `POST /api/telegram-webhook/` (**con barra final**, verificado con
  `secret_token`) → el mensaje entra al chat del cliente como "Mariano se sumó 👋"; el asistente se calla mientras Mariano está.

## A criterio de quien construye

- Diseño visual (seguir `frontend-design`; cálido, nada de jerga).
- Texto exacto de fichas y contexto general (Mariano los revisa).
- Eventos GA4 (`solicitud_presupuesto`, `meet_pedido`, `ver_presupuesto`, `begin_checkout`) y su lugar en `src/data/funnels.js`.

## Calls de Claude (para revisar)

- Explicación al marcar sin IA (instantánea, sin costo); IA solo al escribir.
- El asistente puede sumar/sacar servicios, preguntando antes.
- Se guarda el chat en la solicitud.
- El link de pago no pide login; reusa `pdfToken`.
- Sin revisión por subagente (preferencia de Mariano: menos proceso).
- La tienda vieja con armador visual y cobro directo (hecha hoy) se reemplaza; el redirect `/presupuesto` → `/tienda/?presupuesto=1`
  queda.
