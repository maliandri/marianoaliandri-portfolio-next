# Dashboard de tópicos del bot de noticias — tono por tópico, borrado en cascada, horario

## Contexto

El bot de noticias (`scripts/noticias-bot.mjs`, corre por hora en GitHub Actions) lleva
varios días publicando sin parar. Revisando el resultado, Mariano no le gusta el tono de
los posts generados — suena genérico, tipo "bro de LinkedIn" (frases hechas de marketing:
"una verdadera disrupción", "el impacto real ya está acá y es medible"), el mismo para
todos los tópicos porque hoy hay un solo prompt fijo en el script.

Además surgieron, en la misma conversación, otros dos pedidos relacionados con el control
del bot:
- Poder borrar un tópico y que sus notas ya publicadas desaparezcan del sitio (hoy
  "desactivar" un tópico solo frena publicaciones futuras, no borra el historial).
- Poder pausar el bot en ciertos días/horarios (hoy corre las 24 horas, los 7 días, sin
  excepción).

El admin de "Noticias (Bot)" hoy es una sola pantalla plana (`NoticiasBotManager.jsx`):
controles globales arriba, lista de tópicos con un toggle activo/inactivo, y una tabla de
"últimas publicaciones" que mezcla todos los tópicos. Se rediseña como un dashboard donde
cada tópico se maneja individualmente.

## Alcance de esta spec

Cuatro piezas, todas dentro de la misma feature (tono, borrado, horario, dashboard) porque
comparten el mismo componente y las mismas rutas API:

1. Tono configurable **por tópico** (texto libre).
2. Horario semanal de publicación, configurable, **global** al bot (no por tópico).
3. Borrado de un tópico con **borrado en cascada** (duro, sin posibilidad de deshacer) de
   sus notas en Firestore.
4. Rediseño del panel a tarjetas expandibles, una por tópico.

Fuera de alcance (decisiones explícitas tomadas durante el brainstorming):
- No se toca el prompt para tópicos sin `toneInstructions` configurado — sigue exactamente
  igual que hoy (compatibilidad hacia atrás, sin migración de datos).
- El borrado NO retracta posts ya publicados en Facebook/LinkedIn/Instagram — técnicamente
  no es controlable desde acá (harían falta permisos y llamadas a cada API de red social
  para borrar posts individuales; no se pidió y no está en alcance). Se deja explícito en
  el texto de confirmación del borrado para que no genere expectativas equivocadas.
- El horario es un rango de horas por día de la semana (no franjas múltiples por día, no
  fechas especiales/feriados).

## Modelo de datos

### `noticias_topics/{id}` — un campo nuevo

```
toneInstructions: string | null   // texto libre, ej. "tono periodístico, directo, sin hype"
```

Opcional. `null`/ausente → el prompt no agrega ningún bloque de tono extra (comportamiento
actual, sin cambios).

### `noticias_config/settings` — un campo nuevo

```
schedule: {
  lun: { enabled: boolean, startHour: number|null, endHour: number|null },
  mar: { enabled: boolean, startHour: number|null, endHour: number|null },
  mie: { enabled: boolean, startHour: number|null, endHour: number|null },
  jue: { enabled: boolean, startHour: number|null, endHour: number|null },
  vie: { enabled: boolean, startHour: number|null, endHour: number|null },
  sab: { enabled: boolean, startHour: number|null, endHour: number|null },
  dom: { enabled: boolean, startHour: number|null, endHour: number|null },
} | null
```

`schedule: null` (default, nadie lo configuró) → el bot corre 24/7 como hoy, sin cambios.
Si está configurado: por cada corrida, el bot calcula el día y la hora actual en Argentina
y busca la entrada de ese día. Si `enabled` es `false`, o la hora actual cae fuera de
`[startHour, endHour)`, la corrida no publica nada (mismo patrón que los checks
existentes de `config.active` y `dailyCap` en `main()`).

`startHour`/`endHour` son horas enteras 0-23, hora Argentina (UTC-3 fijo, sin horario de
verano — mismo criterio que ya usa `startOfTodayArgentina()` en el script). Rango simple
dentro del mismo día (no cruza medianoche) — cubre el caso real pedido ("no publicar de
madrugada"); si más adelante hace falta cruzar medianoche, es una iteración futura.

## Cambios en `scripts/noticias-bot.mjs`

1. **`nowArgentina()`** (nueva función, mismo truco de offset que `startOfTodayArgentina()`):
   devuelve un `Date` cuyos getters UTC leen como hora de pared en Argentina.

2. **`isWithinSchedule(schedule)`** (nueva función pura, sin I/O — fácil de testear):
   - `schedule` `null`/`undefined` → `true` (sin restricción).
   - Mapea `nowArgentina().getUTCDay()` (0=domingo) a la clave del día (`dom`, `lun`, ...
     `sab`).
   - Si la entrada del día no existe o `enabled` es `false` → `false`.
   - Si `startHour`/`endHour` son `null` → `true` (día habilitado, sin restricción horaria
     ese día).
   - Si no, compara `nowArgentina().getUTCHours()` contra `[startHour, endHour)`.

3. **`main()`**: después del check de `config.active` y antes (o junto) al de `dailyCap`,
   agrega:
   ```js
   if (!isWithinSchedule(config.schedule)) {
     console.log('Fuera del horario configurado. Nada para hacer.');
     return;
   }
   ```
   `fetchConfig(db)` se extiende para traer también `schedule` (hoy solo trae `active` y
   `dailyCap`).

4. **`buildPrompt(item, topic)`**: si `topic.toneInstructions` tiene contenido, se agrega
   como un bloque extra de instrucciones en el prompt, antes del cierre ("GENERA
   ÚNICAMENTE EL TEXTO DEL POST..."). Sin ese campo, el prompt queda byte-a-byte igual al
   de hoy.

## Cambios en las rutas API

### `src/app/api/noticias/topics/route.js`

- `PATCH`: se extiende el body aceptado para incluir `toneInstructions` (string u omitido),
  además del `activo` que ya acepta. Al menos uno de los dos campos debe venir.
- `DELETE` (nueva): body `{ id }`.
  1. Busca todas las notas de `noticias` donde `topicId == id`.
  2. Las borra en tandas (Firestore permite hasta 500 operaciones por batch — trocear si
     hay más).
  3. Borra el doc de `noticias_topics/{id}`.
  4. Devuelve `{ success: true, deletedCount: N }`.
  - Si `id` no existe, devuelve 404 (no debería poder pasar desde la UI, pero la ruta lo
    valida igual).

### `src/app/api/noticias/config/route.js`

- `PATCH`: se extiende para aceptar también `schedule` (objeto con la forma de arriba, o
  `null` para volver a "sin restricción"). Validación mínima: si viene, debe tener las 7
  claves de día, cada una con `enabled: boolean`.

## Rediseño de `src/components/admin/NoticiasBotManager.jsx`

De arriba hacia abajo:

1. **Controles globales** (existente + agregado):
   - Interruptor "Bot activo" (sin cambios).
   - Tope diario (sin cambios).
   - **Nuevo**: editor de horario semanal — 7 filas (Lun a Dom), cada una con un checkbox
     "activo este día" + dos `<select>` de hora (0-23, "desde"/"hasta"), deshabilitados
     visualmente si el día está desactivado. Un botón "Guardar horario" hace un solo PATCH
     con el objeto `schedule` completo.

2. **Formulario "+ Agregar tópico"**: sin cambios de posición ni de campos (el tono se
   configura después, desde la tarjeta del tópico ya creado — no hace falta pedirlo al
   crear).

3. **Tópicos como tarjetas expandibles** (reemplaza la lista plana + tabla global):
   - Se extrae un componente nuevo `TopicCard` (recibe el tópico, sus notas ya filtradas
     del log completo, y callbacks `onToggleActivo`, `onSaveTone`, `onDelete`).
   - **Colapsada**: label, toggle activo/inactivo, contador de notas publicadas, chevron
     para expandir.
   - **Expandida**:
     - Textarea de tono (`toneInstructions`) con botón Guardar — mismo patrón de
       guardado optimista que ya usa `toggleTopic`/`saveCap` hoy (estado `busy`, recarga
       al terminar).
     - Tabla de las últimas publicaciones **de ese tópico únicamente** — se filtra en el
       cliente del array `log` que `NoticiasBotManager` ya trae completo con una sola
       llamada a `/api/noticias` (no se agrega ninguna llamada nueva por tarjeta).
     - Botón "Eliminar tópico" (estilo destructivo, separado visualmente de las demás
       acciones).

4. **Confirmación de borrado**: al clickear "Eliminar tópico", un `confirm()` (mismo
   patrón que `StoreExcelManager.clearStore`) con el texto:
   > "Vas a borrar el tópico '{label}' y sus {N} notas publicadas en el sitio. No se puede
   > deshacer. Los posts que ya se publicaron en Facebook/LinkedIn/Instagram no se
   > borran — esto solo afecta tu sitio."

   Al confirmar, `DELETE /api/noticias/topics` y se recarga la lista.

## Testing

Siguiendo el patrón ya establecido ayer (Vitest, tests junto al código):

- `scripts/noticias-bot.test.mjs` (nuevo) — `isWithinSchedule()`: sin schedule (siempre
  true), día deshabilitado, dentro de rango, fuera de rango, límites exactos
  (`startHour`/`endHour` inclusive/exclusive), sin restricción horaria ese día
  (`startHour`/`endHour` null).
- `src/app/api/noticias/topics/route.test.js` (nuevo) — `DELETE`: borra el tópico y sus N
  notas, no toca notas de otros tópicos, 404 si el id no existe. Reusa el patrón de
  Firestore fake en memoria de `lead-finder-pro/run/route.test.js`.

No se agregan tests de UI (React) — no hay infraestructura de testing de componentes en el
repo todavía (Vitest está configurado para Node, no jsdom) y no es parte de lo pedido acá;
si hace falta más adelante, es una decisión aparte.

## Compatibilidad y migración

Sin migración de datos necesaria: todos los campos nuevos son opcionales con defaults que
reproducen el comportamiento actual. Los tópicos y la config existentes en Firestore
siguen funcionando sin tocarlos.
