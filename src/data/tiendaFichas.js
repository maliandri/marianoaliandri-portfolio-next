// Fichas en criollo de cada servicio de la tienda (venta por consulta, 2026-11-25). Las usa el asistente de la
// tienda para explicar lo que el cliente marca y responder preguntas. SIN montos de plata: los precios se charlan
// con Mariano. Son la semilla: en Firestore (tienda_catalogo/{id}.ficha) se pueden editar desde admin → Tienda;
// normalizarItem cae a estas si el doc no tiene ficha.
//
// Campos: paraQue (qué gana el negocio), ejemplo (un caso concreto), necesitoDeVos (qué tiene que aportar el
// cliente), tiempo (orientativo), faq (preguntas típicas con respuesta).

const F = (paraQue, ejemplo, necesitoDeVos, tiempo, faq) => ({ paraQue, ejemplo, necesitoDeVos, tiempo, faq: faq.map(([q, a]) => ({ q, a })) });

export const FICHAS = {
  // ── Mostrar tu negocio ──────────────────────────────────────────────────────────────────────────────────
  base_sitio: F(
    'Es el esqueleto de tu web: el diseño propio, el menú, el pie de página y que se vea bien en celular y en compu. Sobre esto se suman las secciones y funciones.',
    'Una panadería arranca con la base y le suma portada, productos y ubicación: ya tiene su web lista para compartir.',
    'Tu logo (o te ayudo a armar uno simple), los colores que te gustan y alguna web que te guste como referencia.',
    'Unos días para el primer diseño; después lo ajustamos juntos.',
    [['¿Se va a ver bien en el celular?', 'Sí, se diseña primero para celular, que es desde donde entra la mayoría de la gente.'],
     ['¿Puedo cambiar textos y fotos después?', 'Sí. Te muestro cómo, o se suma un panel para que lo hagas vos sin tocar nada técnico.'],
     ['¿Es una plantilla?', 'No, el diseño es propio para tu negocio.']]),
  sec_portada: F(
    'Es lo primero que ve la gente al entrar: un título claro de qué hacés, una frase y un botón para que te escriban o te compren.',
    'Un taller mecánico: "Arreglamos tu auto en el día" y un botón de WhatsApp para pedir turno.',
    'Qué querés que haga la persona apenas entra (escribirte, comprar, pedir turno) y una foto linda de tu negocio.',
    'Va junto con la base del sitio.',
    [['¿Por qué importa tanto?', 'Porque en pocos segundos la gente decide si se queda. Una portada clara hace que te escriban más.'],
     ['¿Puede tener un video?', 'Sí, si tenés uno corto se puede poner de fondo.']]),
  sec_servicios: F(
    'Muestra lo que vendés u ofrecés en tarjetas con foto y una descripción corta, para que se entienda rápido.',
    'Una peluquería muestra corte, color y peinados, cada uno con su foto.',
    'La lista de servicios o productos principales, con una foto y dos líneas de cada uno.',
    'Uno o dos días una vez que tengo el material.',
    [['¿Cuántos puedo mostrar?', 'Los que quieras; si son muchos conviene un catálogo de productos.'],
     ['¿Puedo poner precios ahí?', 'Sí, si querés mostrarlos. Si no, se pone un botón de consulta.']]),
  sec_nosotros: F(
    'Cuenta quién está detrás del negocio: tu historia, tu equipo y por qué hacés lo que hacés. Genera confianza.',
    'Una familia que tiene una carpintería hace 30 años cuenta su historia con fotos del taller.',
    'Unos párrafos de tu historia (o te hago preguntas y lo redacto yo) y fotos del equipo o del lugar.',
    'Uno o dos días.',
    [['¿Hace falta?', 'Mucha gente la mira antes de contactarte: ayuda a que confíen en vos.'],
     ['¿Me ayudás a escribirla?', 'Sí, charlamos y te la redacto.']]),
  sec_galeria: F(
    'Una grilla de fotos que se agrandan al tocarlas, optimizadas para que carguen rápido.',
    'Una empresa de durlock muestra fotos de obras terminadas, antes y después.',
    'Las fotos que quieras mostrar (con el celular alcanza si son buenas).',
    'Uno o dos días.',
    [['¿Las fotos pesadas hacen lenta la web?', 'No: se achican solas sin perder calidad.'],
     ['¿Puedo sumar fotos después?', 'Sí, te dejo cómo hacerlo o se suma el panel de administración.']]),
  sec_testimonios: F(
    'Muestra opiniones de clientes contentos con su nombre y foto. Es de lo que más convence a quien duda.',
    'Un estudio contable muestra tres comentarios de clientes a los que les ahorró problemas con AFIP.',
    'Dos o tres opiniones reales de clientes (pueden ser las de Google o mensajes que te mandaron, con su permiso).',
    'Un día.',
    [['¿Puedo usar las reseñas de Google?', 'Sí, se pueden mostrar las que tengas.'],
     ['¿Y si todavía no tengo?', 'Se puede dejar para más adelante y sumarla cuando las tengas.']]),
  sec_faq: F(
    'Una lista de preguntas frecuentes con sus respuestas que se despliegan. Te ahorra contestar lo mismo mil veces por WhatsApp.',
    'Un hotel responde: horario de entrada, si aceptan mascotas, si hay estacionamiento.',
    'Las preguntas que más te hacen tus clientes y cómo las respondés.',
    'Un día.',
    [['¿Ayuda a aparecer en Google?', 'Sí, Google suele mostrar esas respuestas en los resultados.'],
     ['¿Cuántas preguntas conviene poner?', 'Entre cinco y diez de las que más te hacen.']]),
  sec_precios: F(
    'Una tabla para mostrar tus precios o planes y compararlos fácil.',
    'Un gimnasio muestra sus planes de 2, 3 o 5 veces por semana.',
    'Tus planes o precios y qué incluye cada uno.',
    'Un día.',
    [['¿Los puedo cambiar yo?', 'Sí, con el panel de administración o te ayudo cuando cambien.'],
     ['¿Puedo cobrar desde ahí?', 'Sí, si sumás un medio de cobro cada plan puede tener su botón de pago.']]),
  sec_ubicacion: F(
    'Muestra dónde estás con un mapa, tu dirección, tus horarios y cómo llegar.',
    'Una ferretería de barrio muestra el mapa, el horario de lunes a sábado y un botón "Cómo llegar".',
    'Dirección, horarios y si tenés estacionamiento o algo para indicar.',
    'Medio día.',
    [['¿El mapa abre Google Maps en el celular?', 'Sí, el botón abre la app para ir directo.'],
     ['¿Y si tengo varias sucursales?', 'Se muestran todas.']]),
  sec_pagina: F(
    'Una página completa más dentro de tu web, con su propio contenido. Se pide por cantidad.',
    'Una inmobiliaria suma una página para "Alquileres" y otra para "Ventas".',
    'El contenido de cada página (textos y fotos) o qué querés contar en ella.',
    'Uno o dos días por página.',
    [['¿Cuándo conviene una página aparte?', 'Cuando un tema es largo o querés que Google lo encuentre por separado.'],
     ['¿Puedo pedir varias?', 'Sí, se suma una por cada página que necesites.']]),
  contact_form: F(
    'Un formulario para que te dejen sus datos y consulta; te llega por mail al instante y tiene filtro anti-spam.',
    'Un estudio de arquitectura recibe consultas con nombre, teléfono y qué obra tienen en mente.',
    'El mail donde querés recibir las consultas y qué datos le querés pedir a la gente.',
    'Medio día.',
    [['¿Me llega al celular?', 'Te llega por mail; también se puede avisar por WhatsApp si sumás esa función.'],
     ['¿Y el spam?', 'Tiene protección para frenar mensajes basura.']]),
  blog: F(
    'Una sección de notas o novedades que podés escribir vos. Ayuda a que Google te encuentre por más temas.',
    'Un vivero publica notas como "Qué plantar en otoño" y le llegan visitas desde Google.',
    'Ganas de escribir de vez en cuando (o te ayudo con IA a generar borradores).',
    'Unos días.',
    [['¿Sirve para Google?', 'Sí, cada nota es una puerta más para que te encuentren.'],
     ['¿Tengo que saber programar para publicar?', 'No, se escribe como en un procesador de texto.']]),
  search: F(
    'Un buscador dentro de tu web para que la gente encuentre rápido lo que busca.',
    'Una tienda con 300 productos: el cliente escribe "taladro" y le aparecen al instante.',
    'Nada especial: se arma con el contenido que ya tiene la web.',
    'Uno o dos días.',
    [['¿Conviene si tengo pocos productos?', 'Con pocas cosas no hace falta; sirve cuando tenés mucho contenido.'],
     ['¿Encuentra aunque escriban con errores?', 'Tolera errores comunes y busca mientras escriben.']]),
  multilang: F(
    'Tu web en español e inglés (u otro idioma), con un botón para cambiar.',
    'Un hotel de la cordillera recibe turistas de afuera y les muestra la web en inglés.',
    'Los textos traducidos o el OK para traducirlos (puedo ayudarte con eso).',
    'Depende del tamaño de la web; unos días.',
    [['¿Google muestra cada idioma?', 'Sí, se configura para que cada idioma aparezca a quien corresponde.'],
     ['¿Hay que traducir todo?', 'Lo ideal es que sí, pero se puede empezar por las páginas principales.']]),
  maps_leaflet: F(
    'Mapas interactivos propios: marcar varios puntos, zonas o recorridos sobre un mapa.',
    'Una distribuidora muestra en un mapa las zonas donde reparte y los días.',
    'Los puntos o zonas que querés mostrar (direcciones o una planilla).',
    'Unos días.',
    [['¿Es distinto del mapa de ubicación?', 'Sí: este sirve para mostrar muchos puntos o zonas, no solo tu dirección.'],
     ['¿Se puede actualizar?', 'Sí, cargando los puntos desde una planilla o el panel.']]),
  qr_code: F(
    'Códigos QR que llevan a tu web, un producto, tu WhatsApp o tus datos de contacto; se pueden cambiar sin reimprimir.',
    'Un restaurante pone un QR en cada mesa que abre la carta actualizada.',
    'A dónde querés que lleve cada QR.',
    'Un día.',
    [['¿Si cambio la carta tengo que imprimir otro QR?', 'No, el QR apunta a un link que se actualiza solo.'],
     ['¿Puedo saber cuánta gente lo escanea?', 'Sí, si sumás las estadísticas.']]),

  // ── Vender online ───────────────────────────────────────────────────────────────────────────────────────
  catalogo_productos: F(
    'Un catálogo con todos tus productos, con fotos, descripción, filtros y una ficha por producto. Lo podés cargar y editar vos.',
    'Una tienda de ropa muestra prendas por talle y color, y el cliente filtra lo que busca.',
    'La lista de productos con fotos (una planilla de Excel alcanza para empezar).',
    'Una a dos semanas según la cantidad de productos.',
    [['¿Puedo cargar los productos yo?', 'Sí, te queda un panel para agregar, editar o pausar productos sin saber nada técnico.'],
     ['¿Puedo importar desde Excel?', 'Sí, para la carga inicial se puede usar tu planilla.'],
     ['¿Necesito carrito para vender?', 'Si querés que paguen online, sí; si no, cada producto puede tener un botón para consultar por WhatsApp.']]),
  carrito: F(
    'El carrito de compras: el cliente elige productos, ve el resumen de su pedido y paga solo, a cualquier hora, con el medio de cobro que elijas.',
    'Una dietética recibe pedidos a las 11 de la noche ya pagados y los prepara a la mañana.',
    'Elegir con qué vas a cobrar (MercadoPago, Payway, Nave o Bind) y cómo entregás (envío o retiro).',
    'Una semana aproximadamente, junto con el catálogo.',
    [['¿Necesita catálogo?', 'Sí, el carrito trabaja sobre el catálogo de productos; por eso se suma solo.'],
     ['¿Con qué cobro?', 'Con el medio que elijas: MercadoPago, Payway, Nave o Bind.'],
     ['¿Me avisa cuando entra un pedido?', 'Sí, te llega el aviso con el detalle del pedido.']]),
  inventory: F(
    'Controla el stock: cuánto te queda de cada producto, y te avisa cuando algo se está por terminar.',
    'Un local de repuestos sabe cuántas unidades le quedan y deja de vender lo que no tiene.',
    'El stock actual de cada producto para la carga inicial.',
    'Unos días, sobre el catálogo.',
    [['¿Se descuenta solo cuando vendo?', 'Sí, cuando se vende online baja solo; las ventas del local las cargás vos.'],
     ['¿Me avisa si me quedo sin algo?', 'Sí, con un aviso de stock bajo.']]),
  memberships: F(
    'Contenido o servicios solo para socios que pagan un abono mensual, con cobro automático.',
    'Un profe de yoga cobra un abono mensual y los alumnos ven las clases grabadas.',
    'Qué contenido es para socios y cuánto querés cobrar por mes (eso lo charlamos).',
    'Una a dos semanas.',
    [['¿El cobro es automático todos los meses?', 'Sí, se debita solo y si no paga pierde el acceso.'],
     ['¿Necesita que la gente se registre?', 'Sí, por eso se suma el registro de usuarios.']]),

  // ── Cobros ──────────────────────────────────────────────────────────────────────────────────────────────
  payments_mp: F(
    'Cobrás con MercadoPago desde tu web: tarjeta, débito, dinero en cuenta o efectivo en Rapipago/Pago Fácil, y el pago se confirma solo.',
    'Un curso online cobra la inscripción y el alumno recibe el acceso apenas paga.',
    'Tu cuenta de MercadoPago (si no tenés, te ayudo a crearla).',
    'Unos días.',
    [['¿Cuándo me llega la plata?', 'Según el plazo que elijas en tu cuenta de MercadoPago.'],
     ['¿Puedo cobrar en cuotas?', 'Sí, con las cuotas que ofrezca MercadoPago.']]),
  payments_payway: F(
    'Cobrás con tarjeta de crédito y débito usando Payway (la de Prisma, ex Decidir), con cuotas y acreditación en tu banco.',
    'Un negocio que ya usa Payway en el local cobra también online con la misma cuenta.',
    'Tu cuenta comercial de Payway habilitada para ventas online.',
    'Unos días, según cuánto tarde Payway en habilitar las credenciales.',
    [['¿Es mejor que MercadoPago?', 'Depende de tus comisiones y de dónde querés que se acredite la plata; lo charlamos.'],
     ['¿Puedo tener dos medios de cobro?', 'Sí, el cliente elige con cuál pagar.']]),
  payments_nave: F(
    'Cobrás con Nave, la plataforma de Banco Galicia: tarjetas, QR y transferencias, con acreditación en tu cuenta.',
    'Un comercio con cuenta en Galicia cobra online y recibe la plata directo en el banco.',
    'Tu cuenta en Nave (de Galicia) habilitada para cobrar online.',
    'Unos días, según la habilitación de Nave.',
    [['¿Necesito ser cliente de Galicia?', 'Nave te pide una cuenta; te ayudo a ver qué requisitos tiene.'],
     ['¿Puedo cobrar con QR?', 'Sí, Nave permite QR además de tarjetas y transferencias.']]),
  payments_bind: F(
    'Cobrás con Bind (Banco Industrial): transferencias y pagos con acreditación directa en tu cuenta.',
    'Una empresa que factura montos grandes cobra por transferencia y ve el pago confirmado solo.',
    'Tu cuenta en Bind habilitada para cobrar online.',
    'Unos días, según la habilitación de Bind.',
    [['¿Sirve para montos grandes?', 'Sí, las transferencias suelen tener menos costo para montos altos; lo vemos según tu caso.'],
     ['¿Se confirma solo el pago?', 'Sí, el sistema se entera solo cuando entra la transferencia.']]),

  // ── Que te encuentren en Google ─────────────────────────────────────────────────────────────────────────
  seo_technical: F(
    'Deja tu web lista para que Google la lea bien y la muestre: estructura, mapa del sitio, velocidad y todo lo que Google revisa.',
    'Una veterinaria de Neuquén empieza a aparecer cuando alguien busca "veterinaria en Neuquén".',
    'Nada técnico: decime por qué palabras te gustaría que te encuentren.',
    'Unos días.',
    [['¿En cuánto tiempo aparezco en Google?', 'Google tarda semanas en reflejar los cambios; no hay que pagar publicidad para aparecer.'],
     ['¿Me garantizás el primer puesto?', 'Nadie puede garantizarlo; sí te dejo todo lo que Google premia y te muestro cómo evoluciona.']]),
  seo_meta: F(
    'El título y la descripción que muestra Google y la vista previa linda cuando compartís tu web por WhatsApp o redes.',
    'Al compartir el link por WhatsApp aparece la foto del local y una frase en vez de un link pelado.',
    'Una foto representativa y cómo querés que te describan en una frase.',
    'Un día.',
    [['¿Para qué sirve?', 'Hace que más gente toque tu link en Google y en WhatsApp.'],
     ['¿Se nota en el celular?', 'Sí, sobre todo cuando compartís el link.']]),
  seo_schema: F(
    'Información extra para Google (horarios, reseñas, productos, preguntas) que hace que tu resultado se vea más completo.',
    'Un restaurante aparece en Google con las estrellas y el horario debajo del nombre.',
    'Tus datos de negocio: dirección, horarios, rubro.',
    'Un día.',
    [['¿Se ve algo distinto en la web?', 'No, es información para Google; se nota en cómo aparecés en los resultados.'],
     ['¿Siempre lo muestra Google?', 'Google decide cuándo mostrarlo, pero sin esto no lo muestra nunca.']]),
  seo_gsc: F(
    'Te doy de alta en la herramienta de Google que muestra por qué búsquedas te encuentran y en qué puesto estás.',
    'Ves que la gente te encuentra por "cerrajero 24 horas" y reforzás eso.',
    'Una cuenta de Google (la tuya o la de tu negocio).',
    'Un día.',
    [['¿Lo voy a entender?', 'Sí, te muestro lo importante: cuánta gente te ve y cuánta entra.'],
     ['¿Es gratis?', 'La herramienta de Google es gratuita.']]),
  seo_speed: F(
    'Hace que tu web cargue muy rápido, sobre todo en el celular. Google premia a las webs rápidas y la gente no se va.',
    'Una web que tardaba 8 segundos pasa a abrir en 2 y deja de perder visitas.',
    'Nada: lo hago sobre tu web.',
    'Uno a tres días.',
    [['¿Sirve si ya tengo una web?', 'Sí, se puede optimizar una web existente si está hecha en algo que lo permita.'],
     ['¿Cómo sé que mejoró?', 'Te muestro la medición de Google antes y después.']]),
  analytics_ga: F(
    'Estadísticas de tu web: cuánta gente entra, de dónde viene, qué mira y cuántos te escriben o compran.',
    'Ves que la mayoría entra desde Instagram y casi nadie desde Google, y sabés dónde poner energía.',
    'Una cuenta de Google.',
    'Un día.',
    [['¿Es gratis?', 'Sí, Google Analytics es gratuito.'],
     ['¿Puedo ver cuántos me escriben por WhatsApp desde la web?', 'Sí, se mide cada click al botón de WhatsApp.']]),
  gsc_dashboard: F(
    'Un tablero dentro de tu web o panel con los números de Google: visitas, búsquedas y posición, con su evolución.',
    'El dueño ve cada mes si su web aparece más o menos en Google sin entrar a herramientas complicadas.',
    'Tener la web dada de alta en Google (se suma solo si hace falta).',
    'Unos días.',
    [['¿Se actualiza solo?', 'Sí, toma los datos de Google automáticamente.'],
     ['¿Es para mí o para mis clientes?', 'Para vos; muestra cómo te va en Google.']]),

  // ── Turnos, clientes y gestión ──────────────────────────────────────────────────────────────────────────
  booking: F(
    'Turnos o reservas online: el cliente ve los horarios libres, elige uno y le llega la confirmación. Vos te enterás al instante.',
    'Un consultorio deja de coordinar turnos por WhatsApp: los pacientes los sacan solos.',
    'Tus horarios de atención, cuánto dura cada turno y qué servicios se pueden reservar.',
    'Una semana aproximadamente.',
    [['¿Puedo bloquear días?', 'Sí, vacaciones o feriados se bloquean fácil.'],
     ['¿Se puede cobrar una seña al reservar?', 'Sí, si sumás un medio de cobro.'],
     ['¿Le llega recordatorio al cliente?', 'Sí, por mail; por WhatsApp si sumás esa función.']]),
  calendar_system: F(
    'Una agenda con vista de mes y semana para organizar eventos, tareas o disponibilidad de tu equipo.',
    'Una empresa de mantenimiento organiza qué técnico va a qué casa cada día.',
    'Cómo organizás hoy tu agenda y quiénes la usan.',
    'Una semana aproximadamente.',
    [['¿Lo pueden usar varias personas?', 'Sí, cada uno con su usuario.'],
     ['¿Se conecta con Google Calendar?', 'Se puede integrar, lo vemos según lo que uses.']]),
  crm_basic: F(
    'Un lugar para anotar a tus clientes y posibles clientes: en qué estado está cada uno, notas e historial, para no perder ventas.',
    'Una inmobiliaria sigue a cada interesado: llamó, visitó, ofertó, cerró.',
    'Cómo es hoy tu proceso de venta (aunque sea en un cuaderno).',
    'Una a dos semanas.',
    [['¿Es como una planilla?', 'Parecido, pero ordenado, con recordatorios y sin que se pierda nada.'],
     ['¿Puedo cargar los contactos que ya tengo?', 'Sí, desde una planilla.']]),
  admin_panel: F(
    'Un panel privado para manejar tu web o sistema: cargar contenido, ver pedidos, usuarios y estadísticas, sin saber programar.',
    'Una academia carga cursos, ve inscriptos y responde consultas desde su panel.',
    'Qué querés poder hacer vos sin pedirme ayuda.',
    'Una a dos semanas según lo que tenga que manejar.',
    [['¿Lo puede usar alguien de mi equipo?', 'Sí, con usuarios y permisos por persona.'],
     ['¿Es difícil de usar?', 'No, se arma a la medida de lo que hacés y te lo muestro.']]),
  user_auth: F(
    'Que la gente pueda registrarse e iniciar sesión (por ejemplo con su cuenta de Google) y tener su perfil.',
    'Los clientes de un mayorista entran con su usuario y ven sus pedidos anteriores.',
    'Qué va a poder ver o hacer cada usuario registrado.',
    'Unos días.',
    [['¿Es seguro?', 'Sí, se usa el sistema de Google para el ingreso, que es muy seguro.'],
     ['¿La gente tiene que crear contraseña?', 'Puede entrar con su cuenta de Google, sin crear otra contraseña.']]),
  powerbi: F(
    'Un tablero de Power BI con los números clave de tu negocio (ventas, gastos, stock) que se actualiza solo.',
    'El dueño de una distribuidora ve cada mañana cuánto vendió por zona y por vendedor.',
    'Acceso a los datos (Excel, sistema de facturación, etc.) y qué números querés seguir.',
    'Una a dos semanas.',
    [['¿Necesito licencia de Power BI?', 'Depende de cómo lo quieras compartir; lo charlamos según tu caso.'],
     ['¿Se actualiza solo?', 'Sí, se programa la actualización.']]),
  recharts_dashboard: F(
    'Un tablero con gráficos dentro de tu web o panel (barras, líneas, tortas) con tus datos.',
    'Una cooperativa muestra a sus socios la evolución de la producción mes a mes.',
    'Los datos que querés mostrar y para quién es el tablero.',
    'Una semana aproximadamente.',
    [['¿Es distinto de Power BI?', 'Sí: va dentro de tu web, sin licencias aparte.'],
     ['¿Lo pueden ver mis clientes?', 'Sí, si querés que sea público o con usuario.']]),
  excel_automation: F(
    'Automatizo tus planillas de Excel: que se actualicen solas, junten datos de varios lados y armen reportes sin copiar y pegar.',
    'Un administrativo que tardaba un día en armar el reporte mensual ahora lo tiene en un click.',
    'Las planillas que usás hoy y qué reporte necesitás.',
    'Unos días a una semana.',
    [['¿Sigo usando Excel?', 'Sí, se mejora lo que ya usás.'],
     ['¿Funciona con Google Sheets?', 'Para Google Sheets está la integración específica.']]),
  excel_export: F(
    'Un botón para descargar reportes en Excel desde tu web o sistema.',
    'Un mayorista descarga en Excel los pedidos del mes para su contador.',
    'Qué datos querés en el reporte.',
    'Uno o dos días.',
    [['¿Se puede filtrar antes de descargar?', 'Sí, por fechas o lo que necesites.'],
     ['¿Sirve para mi contador?', 'Sí, sale en un formato que cualquiera abre.']]),
  pdf_export: F(
    'Genera PDFs con tu marca desde tu web o sistema: presupuestos, comprobantes, reportes.',
    'Un taller genera el presupuesto en PDF con su logo y se lo manda al cliente.',
    'Un modelo del documento que querés generar.',
    'Unos días.',
    [['¿Lleva mi logo?', 'Sí, con tu logo y colores.'],
     ['¿Se puede mandar por mail solo?', 'Sí, si lo sumamos.']]),
  google_sheets: F(
    'Conecta tu web con una planilla de Google Sheets: lo que entra en la web aparece en la planilla y al revés.',
    'Un emprendimiento recibe los pedidos de la web directo en su planilla compartida con el equipo.',
    'La planilla que usan (o la creamos).',
    'Unos días.',
    [['¿Lo podemos editar varios a la vez?', 'Sí, como cualquier planilla de Google.'],
     ['¿Reemplaza a una base de datos?', 'Para cosas chicas sí; si crece, conviene una base de datos.']]),
  mobile_app: F(
    'Una app para Android y iPhone, para descargar desde las tiendas de apps.',
    'Una cadena de gimnasios tiene su app para que los socios reserven clases.',
    'Qué tiene que hacer la app y si tenés cuentas de desarrollador de Google y Apple (te ayudo a crearlas).',
    'Varias semanas; depende mucho de lo que haga.',
    [['¿Conviene app o web?', 'Muchas veces alcanza con una web instalable, que es más simple; lo charlamos.'],
     ['¿Hay que pagar algo a Apple o Google?', 'Sí, ellos cobran por la cuenta de desarrollador; te explico en la reunión.']]),
  mobile_pwa: F(
    'Tu web se puede instalar en el celular como si fuera una app, funciona sin señal y puede mandar notificaciones.',
    'Los clientes de una pizzería la instalan en el celular y piden en dos toques.',
    'Nada extra: se hace sobre tu web.',
    'Unos días.',
    [['¿Hay que publicarla en las tiendas de apps?', 'No, se instala desde la misma web.'],
     ['¿Manda notificaciones?', 'Sí, en Android y en iPhone con las últimas versiones.']]),

  // ── IA para tu negocio ──────────────────────────────────────────────────────────────────────────────────
  claude_mcp: F(
    'Conecto tu sistema y tus datos a la IA (Claude, ChatGPT o Gemini): le preguntás a tu negocio desde el celular y te responde con tus datos reales; las acciones las aprobás vos.',
    'El dueño de una empresa de obras pregunta "¿qué obras vienen atrasadas?" y la IA le responde con su sistema.',
    'Contarme cómo trabajás hoy y dónde están tus datos (planillas, sistema, WhatsApp).',
    'Una a tres semanas según tu sistema.',
    [['¿La IA puede hacer cosas sola?', 'Consulta sola, pero todo lo que sale hacia afuera (un mail, un cambio) espera tu aprobación.'],
     ['¿Mis datos quedan seguros?', 'Sí: solo entra quien vos decís y queda registrado cada uso.'],
     ['¿Necesito un sistema?', 'Si no tenés, armamos uno; si ya tenés, se conecta el tuyo.']]),
  ai_chatbot: F(
    'Un asistente en tu web que responde las preguntas de tus clientes a cualquier hora, entrenado con la información de tu negocio.',
    'Una inmobiliaria responde de noche consultas sobre requisitos de alquiler y junta los datos del interesado.',
    'Las preguntas frecuentes y la información de tu negocio.',
    'Unos días a una semana.',
    [['¿Puede inventar cosas?', 'Se lo limita a tu información y, si no sabe, deriva a vos.'],
     ['¿Me pasa los datos del cliente?', 'Sí, te llegan los contactos interesados.']]),
  ai_content: F(
    'La IA te ayuda a escribir textos: descripciones de productos, publicaciones, mails, con tu estilo.',
    'Una tienda con 200 productos genera las descripciones en un rato en vez de semanas.',
    'Ejemplos de cómo escribís y para qué lo vas a usar.',
    'Unos días.',
    [['¿Los textos salen bien?', 'Salen como borrador que revisás antes de publicar.'],
     ['¿Escribe como yo?', 'Se le enseña tu forma de escribir con ejemplos.']]),
  ai_document: F(
    'La IA lee documentos (PDF, facturas, contratos) y saca los datos o te hace un resumen.',
    'Un estudio carga facturas en PDF y la IA arma la planilla con proveedor, fecha e importe.',
    'Ejemplos de los documentos que querés procesar.',
    'Una semana aproximadamente.',
    [['¿Lee documentos escaneados?', 'Sí, si se leen bien.'],
     ['¿Mis documentos quedan privados?', 'Sí, se procesan solo para vos.']]),
  tts: F(
    'Convierte texto en voz natural con acento argentino, para videos, audios o avisos.',
    'Un negocio genera audios para sus reels sin grabarse.',
    'Los textos que querés convertir en voz.',
    'Unos días.',
    [['¿Suena robótico?', 'No, son voces naturales.'],
     ['¿Puedo elegir la voz?', 'Sí, hay varias para elegir.']]),
  lead_finder: F(
    'Un buscador de posibles clientes: encuentra negocios de un rubro y zona con sus datos de contacto, para venderles.',
    'Una empresa de seguridad busca todos los comercios de una zona para ofrecerles alarmas.',
    'El rubro y la zona de los clientes que buscás.',
    'Una semana aproximadamente.',
    [['¿De dónde saca los datos?', 'De información pública de Google Maps y de las webs de los negocios.'],
     ['¿Me da los mails?', 'Los que estén publicados en sus webs.']]),
  scraping: F(
    'Junto datos públicos de otras webs de forma automática: precios de la competencia, productos, publicaciones.',
    'Un comercio sigue cada semana los precios de sus competidores en Mercado Libre.',
    'Qué datos querés juntar y de dónde.',
    'Unos días a una semana.',
    [['¿Es legal?', 'Se trabaja con información pública y respetando las reglas de cada sitio.'],
     ['¿Se actualiza solo?', 'Sí, se puede programar cada día o cada semana.']]),

  // ── Redes y avisos ──────────────────────────────────────────────────────────────────────────────────────
  social_instagram: F(
    'Publica en tu Instagram de forma automática desde tu web o tu sistema.',
    'Cada producto nuevo que cargás en la tienda sale publicado solo en Instagram.',
    'Tu cuenta de Instagram profesional conectada a una página de Facebook.',
    'Unos días.',
    [['¿Publica historias también?', 'Sí, se pueden sumar historias.'],
     ['¿Necesito cuenta profesional?', 'Sí, Instagram lo pide para publicar automático.']]),
  social_facebook: F(
    'Publica en tu página de Facebook de forma automática.',
    'Las novedades del blog salen solas en la página de Facebook del negocio.',
    'Tu página de Facebook y acceso como administrador.',
    'Unos días.',
    [['¿Publica fotos?', 'Sí, fotos y texto.'],
     ['¿Puedo revisar antes?', 'Sí, se puede dejar para aprobar antes de publicar.']]),
  social_linkedin: F(
    'Publica en LinkedIn de forma automática, en tu perfil o en el de tu empresa.',
    'Una consultora publica sus notas del blog en LinkedIn sin hacerlo a mano.',
    'Tu cuenta de LinkedIn.',
    'Unos días.',
    [['¿Sirve para empresas?', 'Sí, para negocios que venden a otras empresas es de lo mejor.'],
     ['¿Puedo programar las publicaciones?', 'Sí, con el programador de publicaciones.']]),
  reel_generator: F(
    'Genera reels (videos verticales) automáticos con tus productos o novedades, con música y voz.',
    'Una tienda arma un reel por semana con sus productos nuevos sin editar videos.',
    'Fotos o datos de lo que querés mostrar.',
    'Una semana aproximadamente.',
    [['¿Tengo que editar?', 'No, se arma solo; vos lo revisás.'],
     ['¿Se publica solo?', 'Se puede dejar automático o para aprobar.']]),
  post_generator: F(
    'La IA escribe tus publicaciones para redes usando tus datos reales (productos, novedades, resultados).',
    'Un gimnasio publica cada lunes el resumen de la semana sin pensar qué escribir.',
    'De qué querés hablar en tus redes y tu estilo.',
    'Unos días.',
    [['¿Lo publica sola?', 'Puede quedar como borrador para que lo apruebes.'],
     ['¿Inventa datos?', 'No, usa los datos de tu negocio.']]),
  cron_social: F(
    'Un programador para dejar publicaciones agendadas en tus redes y que salgan solas en el día y hora que elijas.',
    'Una heladería deja programadas las promos de todo el mes un domingo a la tarde.',
    'Qué redes usás y cada cuánto querés publicar.',
    'Unos días.',
    [['¿Puedo cambiar una publicación programada?', 'Sí, hasta que se publique.'],
     ['¿Funciona con todas las redes?', 'Con Instagram, Facebook y LinkedIn.']]),
  make_automations: F(
    'Automatizaciones que conectan tus herramientas entre sí para que las tareas repetitivas se hagan solas.',
    'Cuando entra un pedido, se carga en la planilla, se avisa al depósito y se manda el mail al cliente, solo.',
    'Contarme qué tareas repetís todos los días.',
    'Unos días a una semana.',
    [['¿Qué se puede automatizar?', 'Casi cualquier tarea que hoy hacés copiando y pegando entre programas.'],
     ['¿Tiene costo mensual?', 'Algunas herramientas de automatización cobran según el uso; lo vemos en la reunión.']]),
  whatsapp_api: F(
    'Mensajes automáticos de WhatsApp a tus clientes: confirmaciones, recordatorios y avisos.',
    'Un consultorio manda solo el recordatorio del turno el día anterior.',
    'Un número de WhatsApp para el negocio (puede ser distinto del personal).',
    'Una semana aproximadamente, según la habilitación de WhatsApp.',
    [['¿Sirve mi número actual?', 'Se puede, pero conviene uno dedicado al negocio; lo charlamos.'],
     ['¿WhatsApp cobra?', 'WhatsApp cobra por algunos tipos de mensajes; te lo explico en la reunión.']]),

  // ── Lo técnico que tu web necesita ──────────────────────────────────────────────────────────────────────
  domain: F(
    'Tu dirección en internet (por ejemplo tunegocio.com.ar), registrada a tu nombre y configurada.',
    'Una panadería pasa de un link largo y raro a "panaderialaespiga.com.ar".',
    'Ideas de nombre para tu dirección y tus datos para registrarla a tu nombre.',
    'Uno o dos días.',
    [['¿El dominio queda a mi nombre?', 'Sí, siempre a tu nombre.'],
     ['¿.com o .com.ar?', 'Si vendés en Argentina, .com.ar suele ser lo mejor; lo vemos.']]),
  email_setup: F(
    'Mail profesional con tu dominio (por ejemplo ventas@tunegocio.com.ar), configurado para que no caiga en spam.',
    'Un estudio deja de usar un Gmail personal y manda presupuestos desde contacto@estudio.com.ar.',
    'Tener el dominio y decirme qué casillas necesitás.',
    'Uno o dos días.',
    [['¿Lo puedo leer en el celular?', 'Sí, en la app de mail que uses.'],
     ['¿Por qué no caen en spam?', 'Porque se configura la verificación del dominio que piden Gmail y Outlook.']]),
  ssl_cdn: F(
    'El candado de seguridad de tu web (https) y que las imágenes carguen rápido desde servidores en todo el mundo.',
    'Sin candado, el navegador avisa "sitio no seguro" y la gente se va.',
    'Nada: lo configuro yo.',
    'Un día.',
    [['¿Es obligatorio?', 'Hoy sí: sin candado los navegadores marcan tu web como insegura.'],
     ['¿Se renueva solo?', 'Sí, se renueva automáticamente.']]),
  deploy_vercel: F(
    'Publico tu web en servidores rápidos y confiables, y cada cambio sale online solo, sin cortes.',
    'Cuando cambiás un texto, en un minuto ya está publicado, sin que la web se caiga.',
    'Nada técnico; la cuenta queda a tu nombre si querés.',
    'Un día.',
    [['¿Tengo que pagar hosting todos los meses?', 'Para la mayoría de los negocios alcanza el plan gratuito; si tu web crece mucho, te aviso antes.'],
     ['¿Qué pasa si se cae?', 'Estos servidores casi no se caen; y si pasa algo, me llega un aviso.']]),
  db_firestore: F(
    'Una base de datos en la nube (de Google) para guardar la información de tu sistema y verla en tiempo real.',
    'Los pedidos que entran en la web aparecen al instante en el panel del local.',
    'Nada: la elijo según lo que necesite tu proyecto.',
    'Va incluida en el armado del sistema.',
    [['¿Por qué se suma sola?', 'Porque las funciones que marcaste necesitan guardar información.'],
     ['¿Mis datos están seguros?', 'Sí, con copias y reglas de acceso.']]),
  db_supabase: F(
    'Una base de datos en la nube (Supabase/PostgreSQL), ideal cuando la información tiene muchas relaciones entre sí.',
    'Un sistema de obras guarda clientes, obras, etapas y pagos todo relacionado.',
    'Nada: la elijo según lo que necesite tu proyecto.',
    'Va incluida en el armado del sistema.',
    [['¿Cuál base de datos conviene?', 'Depende de tu proyecto; la elijo yo y te explico por qué.'],
     ['¿Puedo exportar mis datos?', 'Sí, los datos son tuyos y se pueden exportar.']]),
  db_mongodb: F(
    'Una base de datos en la nube (MongoDB) flexible, buena cuando la información cambia de forma seguido.',
    'Un catálogo donde cada tipo de producto tiene datos distintos.',
    'Nada: la elijo según lo que necesite tu proyecto.',
    'Va incluida en el armado del sistema.',
    [['¿Tengo que elegir yo la base de datos?', 'No, la elijo según lo que necesites.'],
     ['¿Tiene costo mensual?', 'Para empezar suele alcanzar el plan gratuito; lo vemos en la reunión.']]),
  api_custom: F(
    'La parte invisible que conecta tu web con tu base de datos y otros servicios, de forma segura.',
    'Tu web le pide a tu sistema el stock real antes de vender.',
    'Nada técnico.',
    'Va incluida en el armado del sistema.',
    [['¿Lo voy a ver?', 'No, trabaja por detrás para que todo funcione.'],
     ['¿Por qué lo necesito?', 'Porque las funciones a medida necesitan esa conexión.']]),
  backend_nodejs: F(
    'Un servidor propio para sistemas más grandes o integraciones especiales.',
    'Una empresa conecta su sistema de facturación viejo con su web nueva.',
    'Contarme con qué sistemas hay que conectarse.',
    'Depende del proyecto; lo vemos en la reunión.',
    [['¿Cuándo hace falta?', 'Cuando el sistema es grande o hay que conectarse con sistemas existentes.'],
     ['¿Tiene mantenimiento?', 'Sí, lo charlamos según el caso.']]),
  webhooks: F(
    'Conexiones automáticas con otros servicios: cuando pasa algo en uno, el otro se entera solo.',
    'Cuando MercadoPago confirma un pago, tu sistema marca el pedido como pagado.',
    'Con qué servicios querés conectarte.',
    'Unos días.',
    [['¿Para qué sirve?', 'Para que tus herramientas se hablen entre sí sin que hagas nada a mano.'],
     ['¿Es seguro?', 'Sí, cada aviso se verifica antes de aceptarlo.']]),
};

// Contexto general del asistente de la tienda (semilla; editable en site_config/asistente_tienda.texto).
export const CONTEXTO_GENERAL = `
Sos el asistente de la tienda de Mariano Aliandri, desarrollador de webs y sistemas a medida con base en Neuquén (Argentina),
que trabaja con negocios de todo el país. Hablás en español rioplatense (vos), cálido, claro y corto (2 a 5 líneas), como en un chat.
La persona que te escribe muchas veces NO sabe nada de webs: explicá con ejemplos de negocios reales y sin palabras técnicas;
si tenés que usar una, explicala en la misma oración.

CÓMO TRABAJA MARIANO (venta por consulta):
1. El cliente marca en la tienda lo que le interesa (vos lo ayudás a entender cada cosa).
2. Pide presupuesto con su cuenta de Google; si quiere, elige un horario para una reunión corta por Google Meet
   (de lunes a viernes a la mañana) o pide que lo contacten por WhatsApp.
3. Mariano revisa el pedido, confirma la reunión y charlan: qué necesita de verdad, qué conviene y qué no, y el precio.
4. Después le manda el presupuesto cerrado con un link para pagar (con MercadoPago); recién ahí se arranca.
5. Durante el trabajo le muestra avances; al terminar queda online con soporte.

PRECIOS: nunca des precios, rangos, comparaciones de costo ni estimaciones de plata, aunque insistan o te pregunten "más o menos".
Explicá que cada proyecto es distinto y que el precio se charla en la reunión con Mariano, y ofrecé pedir presupuesto.

OTRAS COSAS QUE SABÉS:
- La web y el dominio quedan a nombre del cliente.
- El hosting de la mayoría de los negocios entra en planes gratuitos; si el sitio crece mucho, Mariano avisa antes.
- Se puede empezar con poco y sumar funciones después.
- Algunas cosas se suman solas porque otra las necesita (por ejemplo, el carrito necesita un catálogo y un medio de cobro):
  explicá por qué cuando pase.
- Mariano también conecta negocios a la IA (Claude, ChatGPT o Gemini) para que le pregunten a su sistema desde el celular.
- Contacto directo: WhatsApp +54 9 299 541-4422.

TU FORMA DE AYUDAR:
- Preguntá a qué se dedica el negocio y qué quiere lograr antes de recomendar.
- Recomendá lo justo: es mejor arrancar simple. Si algo no le hace falta, decíselo.
- Si te pide sumar o sacar algo, usá las herramientas; antes de sumar por tu cuenta, preguntá.
- Si no sabés algo, decí que lo charla con Mariano en la reunión. No inventes.
`.trim();
