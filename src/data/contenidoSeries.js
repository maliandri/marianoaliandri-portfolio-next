// Series del bot de contenido (/aprende + carrusel en Facebook/Instagram + PDF en LinkedIn).
// Reemplaza al bot de noticias (2026-10-28): en vez de resumir notas de otros sitios, explica la
// propuesta de Mariano — tu negocio conectado a Claude — y cada pieza lleva a una página propia.
// Son la semilla: se editan desde el admin (Marketing → Bot de contenido, colección contenido_series).
// Temas elegidos con la investigación del 2026-10-28: lo que busca la gente en Google Argentina
// ("para qué sirve un mcp", "claude para contadores", "cuánto cuesta una web para vender"...).
//
// angulo = instrucción para la IA. dato = 'auditorias' le pasa números reales de las auditorías.
// cta = a qué página del sitio lleva (label = texto del botón).
export const SERIES_SEMILLA = [
  {
    id: 'mcp-30-segundos', nombre: 'MCP en 30 segundos',
    angulo: 'Explicá qué es un MCP (Model Context Protocol) para un dueño de negocio que nunca escuchó la palabra. Usá la comparación del USB-C: un enchufe estándar entre Claude y los sistemas del negocio (ventas, stock, clientes, turnos). Un ejemplo concreto de pregunta que el dueño le haría a Claude y lo que Claude le contestaría con sus datos. Cada vez un ángulo distinto (qué es, qué se puede preguntar, qué no hace, en qué se diferencia de usar ChatGPT suelto).',
    gancho: 'MCP es el USB-C entre Claude y tu negocio',
    cta: { label: 'Ver qué le podés preguntar', path: '/ia-para/' },
  },
  {
    id: 'claude-para-tu-oficio', nombre: 'Claude para tu oficio',
    angulo: 'Elegí UN oficio o rubro (contadores, abogados, constructoras, comercios con stock, gastronomía, salud y belleza, inmobiliarias, talleres, educación) y mostrá 3 o 4 preguntas reales que ese negocio le haría a Claude conectado a su sistema, con el tipo de respuesta que obtendría. Que cada vez sea un oficio distinto a los últimos.',
    gancho: 'Claude para contadores: preguntale quién te debe',
    cta: { label: 'Ver cómo sería en tu rubro', path: '/ia-para/' },
  },
  {
    id: 'cuanto-cuesta', nombre: '¿Cuánto cuesta?',
    angulo: 'Respondé sin vueltas una pregunta de costos que se hace un dueño de negocio: cuánto cuesta una web para vender, un dominio, un servidor, una base de datos, cobrar online, mantener el sitio. Explicá qué se paga una vez y qué se paga por mes, y qué cosas no deberían cobrarte todos los meses. Sin inventar precios exactos de Mariano: rangos y criterios.',
    gancho: 'Cuánto sale una web para vender en 2026, sin vueltas',
    cta: { label: 'Cotizá tu web', path: '/web/' },
  },
  {
    id: 'dominio-sin-cuota', nombre: 'Tu web sin cuota mensual',
    angulo: 'Explicá por qué un negocio no debería pagar una membresía mensual por tener su propia web (constructores de sitios por suscripción): el dominio es tuyo, el código puede ser tuyo, y con Next.js + Vercel + Supabase + Cloudinary el sitio puede quedar andando sin cuotas altas. Qué perdés si dejás de pagar una plataforma cerrada.',
    gancho: 'Dejá de pagar membresía por tu propia web',
    cta: { label: 'Pedí tu presupuesto', path: '/presupuesto/' },
  },
  {
    id: 'base-de-datos', nombre: '¿Para qué una base de datos?',
    angulo: 'Explicá en simple para qué le sirve una base de datos a un negocio chico comparado con un Excel o un cuaderno: varias personas al mismo tiempo, historial, no perder datos, buscar al instante, conectarla a la web, a los cobros y a Claude. Un ejemplo de rubro concreto cada vez.',
    gancho: 'Tu Excel no es una base de datos (y te está costando clientes)',
    cta: { label: 'Pedí tu presupuesto', path: '/presupuesto/' },
  },
  {
    id: 'cobra-en-tu-web', nombre: 'Cobrá en tu web',
    angulo: 'Explicá por qué conviene tener MercadoPago o Payway integrado en la web del negocio y no solo mandar un link de pago por WhatsApp: el pedido queda registrado, el stock se descuenta, el cliente recibe el comprobante, se ve qué se vendió, se puede cobrar en cuotas o suscripción. Un rubro de ejemplo cada vez.',
    gancho: 'Por qué MercadoPago en tu web y no solo el link',
    cta: { label: 'Ver la tienda', path: '/tienda/' },
  },
  {
    id: 'es-seguro', nombre: '¿Es seguro?',
    angulo: 'Respondé una duda de seguridad o privacidad que tiene un dueño de negocio sobre conectar su sistema a la IA: ¿Claude ve todos mis datos?, ¿se entrena con mi información?, ¿quién puede entrar?, ¿qué pasa si se cae internet?, ¿puede hacer cosas sin mi permiso? Explicá permisos, solo lectura, confirmar antes de actuar, login propio. Honesto, sin prometer imposibles.',
    gancho: '¿Claude ve todos mis datos? No: solo lo que vos le das',
    cta: { label: 'Cómo funciona', path: '/ia-para/' },
  },
  {
    id: 'mito-o-realidad', nombre: 'Mito o realidad',
    angulo: 'Tomá UN mito común sobre la IA, las webs o la tecnología para pymes ("la IA es cara", "la IA me va a reemplazar", "para vender no necesito web, tengo Instagram", "una web hecha a medida es carísima", "eso es para empresas grandes") y desarmalo con argumentos concretos y un ejemplo.',
    gancho: '"La IA es cara": mito',
    cta: { label: 'Calculá el retorno', path: '/roi/' },
  },
  {
    id: 'error-de-la-semana', nombre: 'El error que más veo',
    angulo: 'Contá un error frecuente en las webs de negocios locales usando los DATOS REALES de las auditorías que te paso (porcentajes reales, sin nombres de negocios): qué es, por qué le hace perder clientes al negocio y cómo se arregla en simple. Elegí un problema distinto cada vez según los datos.',
    gancho: 'El error que más veo en las webs de Neuquén',
    cta: { label: 'Ver las auditorías', path: '/auditorias/' },
    dato: 'auditorias',
  },
  {
    id: 'preguntas-para-claude', nombre: '3 preguntas para Claude',
    angulo: 'Dá 3 preguntas concretas que un dueño de negocio le puede hacer a Claude conectado a su sistema sobre un tema (ventas, clientes que no vuelven, stock, cobranzas, turnos, presupuestos), y qué decisión puede tomar con cada respuesta. Un tema distinto cada vez.',
    gancho: '3 preguntas para hacerle a Claude sobre tus ventas',
    cta: { label: 'Probalo en tu negocio', path: '/ia-para/' },
  },
  {
    id: 'panel-conectado', nombre: 'Tu panel, conectado a Claude',
    angulo: 'Mostrá qué es tener un panel propio en la web del negocio (ventas, pedidos, presupuestos, clientes, publicaciones en redes) y manejarlo hablando con Claude desde el celular: "cotizale a Ana", "¿entró algún pedido?", "publicá esto en Instagram". Un caso de uso distinto cada vez.',
    gancho: 'Le pregunté a mi sistema cuánto vendí ayer',
    cta: { label: 'Pedí el tuyo', path: '/presupuesto/' },
  },
].map((s, i) => ({ ...s, activo: true, orden: i }));
