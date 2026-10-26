// Páginas /ia-para/[nicho]: "tu sistema, conectado a la IA" (servidor MCP a medida) contado con la
// pregunta que el equipo de cada rubro le haría a la IA. Para sumar un nicho, agregar un bloque acá
// (src/data/iaNichos.test.js valida los campos y que esté en el sitemap).
// Las respuestas son EJEMPLOS con datos ficticios: la página lo aclara.

const WHATSAPP = '5492995414422';

export const IA_NICHOS = [
  {
    slug: 'constructoras',
    nombre: 'constructoras y fábricas',
    titulo: 'Constructoras y fábricas',
    pregunta: '¿Qué obras vienen atrasadas y qué cliente está esperando respuesta?',
    herramienta: 'obras_atrasadas',
    respuesta: {
      columnas: ['Obra', 'Etapa', 'Atraso', 'Espera respuesta'],
      filas: [
        ['Casa Fernández', 'Techo', '6 días', 'Sí, desde el lunes'],
        ['Galpón Ruta 7', 'Platea', '3 días', 'No'],
        ['Local Av. Argentina', 'Terminaciones', '2 días', 'Sí, pidió fecha'],
      ],
      cierre: 'Le preparé a Fernández un mensaje con la nueva fecha del techo. ¿Se lo mando?',
    },
    sistemas: ['planillas de obra', 'presupuestos en Excel', 'grupos de WhatsApp con el equipo'],
    tareas: [
      { tipo: 'consulta', texto: '¿Cuánto material de la obra Fernández ya se compró y cuánto falta?' },
      { tipo: 'consulta', texto: '¿Qué presupuestos de este mes no se respondieron?' },
      { tipo: 'accion', texto: 'Pasá la obra del galpón a la etapa "Estructura" y avisale al cliente.' },
      { tipo: 'accion', texto: 'Armá el presupuesto de la ampliación con los precios de la semana.' },
    ],
    seo: {
      title: 'IA para constructoras y fábricas',
      description: 'Tu equipo le pregunta a la IA por obras, etapas y presupuestos, y la IA responde con los datos de tu sistema. Con permisos y registro de todo.',
    },
  },
  {
    slug: 'comercios',
    nombre: 'comercios con stock',
    titulo: 'Comercios con stock',
    pregunta: '¿Qué productos se están por agotar y cuánto vendimos esta semana?',
    herramienta: 'stock_critico',
    respuesta: {
      columnas: ['Producto', 'Quedan', 'Se venden por semana', 'Alcanza para'],
      filas: [
        ['Zapatilla running 42', '3', '9', '2 días'],
        ['Mochila urbana negra', '5', '7', '5 días'],
        ['Botella térmica 1 L', '11', '12', '6 días'],
      ],
      cierre: 'Esta semana se vendieron 214 unidades, un 12 % más que la anterior. ¿Armo el pedido al proveedor?',
    },
    sistemas: ['planillas de stock', 'Tiendanube o MercadoLibre', 'el sistema de facturación'],
    tareas: [
      { tipo: 'consulta', texto: '¿Cuál fue el producto más vendido en MercadoLibre este mes?' },
      { tipo: 'consulta', texto: '¿Qué clientes compraron más de tres veces y hace un mes que no vuelven?' },
      { tipo: 'accion', texto: 'Subí un 8 % el precio de toda la línea térmica.' },
      { tipo: 'accion', texto: 'Armá el pedido al proveedor con lo que alcanza para menos de una semana.' },
    ],
    seo: {
      title: 'IA para comercios con stock',
      description: 'Preguntale a la IA qué se está por agotar, qué se vendió y a quién reponer. Trabaja con tu stock y tus ventas reales, con permisos y frenos.',
    },
  },
  {
    slug: 'gastronomia',
    nombre: 'restaurantes y gastronomía',
    titulo: 'Restaurantes y gastronomía',
    pregunta: '¿Cuántos pedidos tuvimos hoy y qué plato se vendió menos esta semana?',
    herramienta: 'ventas_del_dia',
    respuesta: {
      columnas: ['Canal', 'Pedidos hoy', 'Ticket promedio'],
      filas: [
        ['Salón', '64', '$ 18.400'],
        ['Delivery propio', '31', '$ 15.900'],
        ['Apps', '22', '$ 14.200'],
      ],
      cierre: 'El plato que menos salió fue la ensalada de quinoa (4 en la semana). ¿Lo saco de la carta del delivery?',
    },
    sistemas: ['el sistema de pedidos o comandas', 'apps de delivery', 'planillas de compras'],
    tareas: [
      { tipo: 'consulta', texto: '¿Qué insumos hay que comprar para el fin de semana según lo que se vendió?' },
      { tipo: 'consulta', texto: '¿Qué día y horario tenemos más pedidos de delivery?' },
      { tipo: 'accion', texto: 'Pausá el plato del día en el menú online, se terminó.' },
      { tipo: 'accion', texto: 'Mandales la promo del jueves a los clientes que pidieron el último mes.' },
    ],
    seo: {
      title: 'IA para restaurantes y gastronomía',
      description: 'Pedidos del día, platos que no salen, compras para el fin de semana: tu equipo le pregunta a la IA y responde con los datos de tu sistema.',
    },
  },
  {
    slug: 'salud-y-belleza',
    nombre: 'consultorios, centros de estética y peluquerías',
    titulo: 'Salud y belleza',
    pregunta: '¿Qué turnos quedaron libres mañana y quién está en la lista de espera?',
    herramienta: 'turnos_libres',
    respuesta: {
      columnas: ['Hora', 'Profesional', 'Lista de espera'],
      filas: [
        ['10:30', 'Lic. Romero', '2 personas'],
        ['15:00', 'Lic. Romero', '1 persona'],
        ['17:30', 'Dra. Paz', '3 personas'],
      ],
      cierre: 'Puedo avisarle a la primera persona de cada lista para que confirme. ¿Les escribo?',
    },
    sistemas: ['la agenda de turnos', 'fichas de pacientes o clientes', 'WhatsApp del local'],
    tareas: [
      { tipo: 'consulta', texto: '¿Qué pacientes no vienen hace más de seis meses?' },
      { tipo: 'consulta', texto: '¿Cuántos turnos se cancelaron este mes y en qué horarios?' },
      { tipo: 'accion', texto: 'Mandá el recordatorio de los turnos de mañana.' },
      { tipo: 'accion', texto: 'Bloqueá la agenda de la Dra. Paz el viernes a la tarde.' },
    ],
    seo: {
      title: 'IA para consultorios y estética',
      description: 'Turnos libres, lista de espera, recordatorios y cancelaciones: tu equipo le pregunta a la IA y la IA trabaja con tu agenda real.',
    },
  },
  {
    slug: 'estudios-profesionales',
    nombre: 'estudios contables, jurídicos y de arquitectura',
    titulo: 'Estudios profesionales',
    pregunta: '¿Qué presupuestos enviamos este mes que todavía no tuvieron respuesta?',
    herramienta: 'presupuestos_pendientes',
    respuesta: {
      columnas: ['Cliente', 'Servicio', 'Enviado hace'],
      filas: [
        ['Pyme Sur SRL', 'Liquidación de sueldos', '12 días'],
        ['Familia Ortiz', 'Sucesión', '9 días'],
        ['Estudio Valle', 'Plano municipal', '6 días'],
      ],
      cierre: 'Les preparé un recordatorio a cada uno, con el presupuesto adjunto. ¿Los mando?',
    },
    sistemas: ['la planilla de clientes', 'el calendario de vencimientos', 'el correo del estudio'],
    tareas: [
      { tipo: 'consulta', texto: '¿Qué vencimientos de clientes caen la semana que viene?' },
      { tipo: 'consulta', texto: '¿Cuántas horas le dedicamos al expediente Ortiz este mes?' },
      { tipo: 'accion', texto: 'Pedile a Pyme Sur la documentación que falta para la liquidación.' },
      { tipo: 'accion', texto: 'Cargá el honorario del mes en la planilla y mandá la factura.' },
    ],
    seo: {
      title: 'IA para estudios profesionales',
      description: 'Presupuestos sin respuesta, vencimientos y horas por cliente: preguntale a la IA y responde con los datos de tu estudio, con permisos.',
    },
  },
  {
    slug: 'automotor',
    nombre: 'talleres mecánicos y concesionarias',
    titulo: 'Talleres y concesionarias',
    pregunta: '¿Qué autos ya están listos para entregar y a qué dueño no le avisamos?',
    herramienta: 'autos_listos',
    respuesta: {
      columnas: ['Vehículo', 'Trabajo', 'Dueño avisado'],
      filas: [
        ['Gol Trend AB123CD', 'Service 60.000 km', 'No'],
        ['Hilux AC456EF', 'Embrague', 'Sí'],
        ['208 AD789GH', 'Frenos', 'No'],
      ],
      cierre: 'Dos dueños todavía no saben que su auto está listo. ¿Les mando el aviso con el total a pagar?',
    },
    sistemas: ['las órdenes de trabajo', 'la planilla de repuestos', 'el WhatsApp del taller'],
    tareas: [
      { tipo: 'consulta', texto: '¿Qué repuestos pedimos y todavía no llegaron?' },
      { tipo: 'consulta', texto: '¿Qué clientes tienen el service vencido según el kilometraje?' },
      { tipo: 'accion', texto: 'Pasá la Hilux a "Lista para entregar" y avisale al dueño.' },
      { tipo: 'accion', texto: 'Armá el presupuesto del cambio de distribución para el 208.' },
    ],
    seo: {
      title: 'IA para talleres y concesionarias',
      description: 'Autos listos, repuestos pendientes y services vencidos: tu equipo le pregunta a la IA y la IA trabaja con tus órdenes de trabajo reales.',
    },
  },
  {
    slug: 'inmobiliarias',
    nombre: 'inmobiliarias',
    titulo: 'Inmobiliarias',
    pregunta: '¿Qué propiedades no tuvieron ninguna consulta en los últimos 30 días?',
    herramienta: 'propiedades_sin_consultas',
    respuesta: {
      columnas: ['Propiedad', 'Operación', 'Publicada hace', 'Consultas'],
      filas: [
        ['Depto 2 amb. centro', 'Alquiler', '45 días', '0'],
        ['Lote barrio Rincón', 'Venta', '80 días', '0'],
        ['Casa 3 dorm. Oeste', 'Venta', '38 días', '0'],
      ],
      cierre: 'Puedo armarte un mensaje para cada dueño sugiriendo revisar el precio. ¿Te los preparo?',
    },
    sistemas: ['el listado de propiedades', 'los portales donde publicás', 'la planilla de interesados'],
    tareas: [
      { tipo: 'consulta', texto: '¿Qué interesados buscan 3 dormitorios en la zona oeste?' },
      { tipo: 'consulta', texto: '¿Qué contratos de alquiler vencen en los próximos 60 días?' },
      { tipo: 'accion', texto: 'Mandales la casa nueva del oeste a los interesados que coinciden.' },
      { tipo: 'accion', texto: 'Agendá la visita del sábado y avisale al dueño.' },
    ],
    seo: {
      title: 'IA para inmobiliarias',
      description: 'Propiedades sin consultas, contratos por vencer e interesados que coinciden: preguntale a la IA y responde con tus datos reales.',
    },
  },
  {
    slug: 'educacion',
    nombre: 'institutos, academias y colegios',
    titulo: 'Educación',
    pregunta: '¿Quiénes deben la cuota de este mes y desde cuándo?',
    herramienta: 'cuotas_pendientes',
    respuesta: {
      columnas: ['Alumno', 'Curso', 'Debe desde'],
      filas: [
        ['Martina G.', 'Inglés B2', '10 de octubre'],
        ['Tomás R.', 'Programación inicial', '10 de septiembre'],
        ['Lucía P.', 'Inglés A1', '10 de octubre'],
      ],
      cierre: 'Les puedo mandar el link de pago a cada familia con un mensaje amable. ¿Lo hago?',
    },
    sistemas: ['la planilla de inscriptos', 'el registro de pagos', 'el grupo o mail con las familias'],
    tareas: [
      { tipo: 'consulta', texto: '¿Cuántos cupos quedan en los cursos que arrancan en marzo?' },
      { tipo: 'consulta', texto: '¿Qué alumnos faltaron más de tres veces este mes?' },
      { tipo: 'accion', texto: 'Inscribí a la hermana de Martina en Inglés A1.' },
      { tipo: 'accion', texto: 'Mandá el aviso de que mañana no hay clases por el feriado.' },
    ],
    seo: {
      title: 'IA para institutos y academias',
      description: 'Cuotas pendientes, cupos y asistencia: tu equipo le pregunta a la IA y la IA trabaja con los datos de tu institución, con permisos.',
    },
  },
];

export function getNicho(slug) {
  return IA_NICHOS.find(n => n.slug === slug) || null;
}

export function waLink(nicho) {
  const texto = nicho
    ? `Hola Mariano, vi lo de conectar la IA al sistema para ${nicho.nombre} y me interesa para mi negocio.`
    : 'Hola Mariano, vi lo de conectar la IA al sistema de una empresa y me interesa.';
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}
