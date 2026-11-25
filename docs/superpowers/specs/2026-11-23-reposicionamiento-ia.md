# Reposicionamiento del sitio: sistemas con IA para negocios

**Fecha:** 2026-11-23 · **Estado:** EN PAUSA. Nada implementado todavía en el código.
**Maqueta aprobada:** https://claude.ai/artifact/FTPMNSVzAzBYvkU5b9o5WZ

## Por qué

- El sitio hoy muestra a Mariano como desarrollador frontend ("Sitios web que aparecen en Google").
- El nicho que quiere impulsar desde ahora es la **web inteligente**: un sistema propio con base de datos, conectado a Claude, ChatGPT o Gemini, que responde con los datos del negocio y hace tareas con aprobación.
- Nombres técnicos: RAG, agentes con herramientas (*tool calling*), MCP. El rol se llama *AI Engineer* o *AI Product Engineer*. El cliente no usa esas siglas: busca "agente de IA para mi negocio" o "asistente de IA con mis datos".
- Hay mucha competencia global en "IA" en general, pero pocos la aplican a negocios concretos con sistemas reales en producción en la zona. Ese es el diferencial.
- Problema detectado: el sitio le habla a **cuatro públicos a la vez** (negocios, desarrolladores, gente buscando trabajo y curiosos). El menú de `src/app/providers.jsx` mezcla Servicios, Herramientas gratis (CV, ROI, KPI…) y Productos SaaS (Lead Finder Pro "para devs", Analítica).

## Decisiones

1. **Selector de audiencia con 4 opciones.** La primera es la de IA y es la que aparece al entrar:

   | Opción | Ruta | Contenido |
   |---|---|---|
   | IA para tu negocio | `/` | Home nuevo (ver abajo) |
   | Sitios web | `/sitios-web/` | El home actual tal cual (HeroNew, NoticiasHome, ProyectosGrid, CapabilitiesCarousel, Contact), mudado |
   | Devs | `/desarrolladores/` | Página nueva: Lead Finder Pro, Analítica Regional, stack, GitHub |
   | Herramientas | `/herramientas/` | Ya existe (CV, ROI, cotizador, KPI, Radar, Labs, planes) |

2. **Se mantiene el diseño visual actual**: Tailwind, violeta/índigo, `glow-frame`, `bg-card`, `pill-btn`, modo oscuro. Cambian el contenido y el orden, no el estilo. La maqueta del artifact era para ver el mensaje, no la estética.
3. **No se borra ninguna página** (para no perder SEO). Lo que no es para negocios sale del menú principal, no del sitio.
4. **Antes de pushear, verlo en dev** (`npm run dev`). Pedido explícito del usuario.

## Home de IA (`/`): secciones en orden

1. **Hero:** "Preguntale a tu negocio. Te contesta con tus datos."
   - Subtítulo: armo el sistema (obras, stock, turnos, clientes, cobros) y lo conecto a Claude, ChatGPT o Gemini; el equipo pregunta desde el celular.
   - Botones: "Contame tu negocio" y "Ver casos reales".
   - A la derecha, una demo de chat que rota por rubro (obras, comercio, taller, consultorio) con los datos de `src/data/iaNichos.js`: pregunta → "consultó X en tu sistema" → tabla → respuesta → "¿Se lo mando?". Ejemplo con datos ficticios.
   - Reemplaza a HeroNew y sus 3 métricas.
   - El h1 va sin animación de opacidad (es el elemento LCP).
2. **Cómo funciona** (3 pasos, numerados porque es el orden real): ordenamos tus datos → lo conectamos a la IA (MCP, mencionado una sola vez y explicado) → preguntás y aprobás.
3. **Qué puede hacer:** "Consulta sola. Actúa con tu permiso."
   - Dos columnas: Consulta / Hace con aprobación.
   - Ejemplos sacados de las tools reales de almita (`alcanza_material`, `preparar_registrar_cobro`, `preparar_avisar_avance_cliente`).
4. **Casos reales:**
   - (a) Cliente de obras y fabricación = almita. Va sin nombre hasta tener permiso.
   - (b) Mi propio negocio: el MCP con 42 herramientas.
   - (c) El chat del sitio que cotiza (`AIChatBot`).
5. **Rubros:** "¿Qué le preguntarías a tu negocio?" Tarjetas generadas desde `IA_NICHOS`, que llevan a `/ia-para/<slug>/`.
6. **Seguridad:** nada sale sin tu OK · solo entra quien vos decís · topes de gasto · todo queda registrado. Responde a la objeción número uno.
7. **Lo que construí:** ProyectosGrid, más abajo y más chico, como prueba de que sabe construir.
   - **Decidido 2026-11-25 (el usuario la quiere así para su página): proyectos como polaroids** (referencia: unseen.co/world).
     `<ProyectosGrid polaroid />` → `PolaroidCard`: papel blanco `#fbfaf7` en los dos temas, inclinación alternada
     (`TILTS`), que se endereza al pasar el mouse (framer-motion, spring), captura con aberración cromática (`.fx-rgb`), pie
     manuscrito con el nombre (Caveat, `--font-hand`, sin preload) y una línea mono con clicks · impresiones · dominio ↗.
     **Corrección 2026-11-25: los sitios van en `/sitios-web/` (futuro "Desarrollos"), NO en el home de IA.** El home
     de IA quedó sin sección de proyectos; `/sitios-web/` usa `<ProyectosGrid polaroid />` con el grano.
   - Todo el home lleva grano de película animado (`.fx-grain` en el contenedor de `HomeIA`): SVG de ruido en el CSS sobre
     una capa fija que se mueve solo con `transform`, se apaga con `prefers-reduced-motion`. Regla: **nada que baje la
     velocidad** (se descartó la esfera 3D en WebGL por eso).
8. **Contacto:** "Contame cómo trabaja tu negocio hoy". Botones de WhatsApp y presupuesto.

Salen del home de IA: NoticiasHome y CapabilitiesCarousel (los dos siguen en `/sitios-web/`).

## Plan técnico pensado

- `src/data/audiencias.js`: lista de audiencias `{ id, label, short, href }` + función pura `audienciaActiva(pathname)`, con su test.
  - `/` e `/ia-para*` → ia
  - `/sitios-web` → webs
  - `/desarrolladores` → devs
  - `/herramientas` y las rutas de herramientas → herramientas
- **Navbar** (`src/app/providers.jsx`):
  - Selector de 4 opciones en el centro, en desktop. Reemplaza los dropdowns "Herramientas" y "Productos", que quedan cubiertos por las páginas del selector.
  - Un dropdown "Más" con Aprendé, Auditorías, Demanda, Tienda, Presupuesto y FAQ.
  - Etiquetas cortas en `md` y completas en `lg`.
- **Mobile:** el selector arriba de todo del menú hamburguesa, y también un selector chico en el hero de cada una de las 4 páginas (`md:hidden`).
- Componentes nuevos en `src/components/home/ia/`. La demo del chat es un client component; las otras secciones, server components.
- `src/app/page.jsx`:
  - Mantener los schemas Person y LocalBusiness.
  - Title con "Sistemas a medida … Neuquén" + IA, por ejemplo "Sistemas a medida conectados a la IA en Neuquén | Mariano Aliandri", para no perder lo que ya posiciona.
- `/sitios-web/` con title tipo "Diseño y desarrollo web en Neuquén", para que el término siga teniendo una página propia.
- Sumar `/sitios-web/` y `/desarrolladores/` a `src/app/sitemap.js`.
- Footer (`src/components/ui/Footer.jsx`): revisar los links "Portfolio" (`/#proyectos`) y "Servicios" (`/#servicios`), que pasan a vivir en `/sitios-web/`.

## Pendientes antes o durante la implementación

- Permiso del cliente de almita para nombrarlo, una captura real de Claude respondiendo con sus datos y, si se puede, una frase del dueño.
- Capturas del MCP propio: ya hay en `screenshots-carousel/mcp-linkedin/`.
- El caso del chat necesita una forma de abrir `AIChatBot` desde un botón (hoy no expone ningún evento para abrirlo).
- Contenido concreto de `/desarrolladores/`.

---

## Idea pendiente (2026-11-24): home de IA animado con el scroll

Para ver más adelante. No se empezó nada.

- **Referencias del usuario**: sitio de Motorola y el Instagram de Nómade Digital. Toda la página se anima al
  scrollear, con carruseles que parecen 3D y movimiento "superfluido".
- **Efecto pedido**: que al pasar de una sección a otra la página se desvanezca difusa. La que sale pierde opacidad,
  se desenfoca (`blur` 0 → ~12px) y crece un poco (scale 1.05); la que entra hace lo contrario. Las dos se cruzan a
  mitad de camino.
- **Stack propuesto** (una sola página: el home de IA; Sitios web, Devs y Herramientas sin cambios):
  - **Lenis**: scroll suave.
  - **GSAP + ScrollTrigger**: secciones fijas (`position: sticky` / pin), líneas de tiempo con `scrub`. Gratis desde 2025.
  - **Framer Motion**: se queda para lo chico (botones, modales, chat).
  - **CSS 3D** (`perspective`, `rotateY`, `translateZ`) para el carrusel con profundidad. Nada de Three.js.
  - **Remotion** (ya está): la misma idea en video para los reels de Instagram.
- **Esquema**:
  ```js
  gsap.utils.toArray('.seccion').forEach((sec, i, todas) => {
    const sig = todas[i + 1];
    if (!sig) return;
    gsap.timeline({ scrollTrigger: { trigger: sig, start: 'top bottom', end: 'top top', scrub: true } })
      .to(sec, { opacity: 0, filter: 'blur(12px)', scale: 1.05 }, 0)
      .fromTo(sig, { opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0px)' }, 0);
  });
  ```
- **Reglas para no romper lo que anda**:
  1. SEO: todo el texto en el HTML del servidor; la animación solo lo mueve, nunca lo hace aparecer recién al scrollear.
  2. LCP: GSAP/Lenis cargados solo en esa página y nunca antes del primer pantallazo (el puntaje de PageSpeed en
     celular costó subirlo de 62 a 92).
  3. Celular: desenfocar solo el contenido (no el fondo), menos desenfoque (4–6px) o solo el fundido. Probar el pin
     en un iPhone real.
  4. `prefers-reduced-motion`: solo fundido, sin desenfoque ni escala.
  5. `will-change: filter, opacity` solo durante la transición.
- **Próximo paso**: una maqueta con 3 secciones del home de IA para probar en la compu y en el celular, antes de
  tocar la rama.
