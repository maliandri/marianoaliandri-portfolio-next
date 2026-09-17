// Estructura default de navegación del admin — sirve como semilla del editor
// (Sitio > Configurar Interfaz) y como fallback si todavía no hay config guardada
// en Firestore (nav_config/admin). Los "id" son fijos: cada uno corresponde a un
// bloque de contenido real en AdminPage.jsx — el editor puede renombrar, reagrupar
// y mover de nivel, pero no inventar ids nuevos sin contenido detrás.
export const ADMIN_NAV_DEFAULT = [
  { id: 'panel', label: 'Panel', icon: '📊', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  ]},
  { id: 'tienda', label: 'Tienda', icon: '🛍️', items: [
    { id: 'products', label: 'Productos', icon: '🛍️' },
    { id: 'orders', label: 'Órdenes', icon: '📦' },
    { id: 'presupuestos', label: 'Presupuestos', icon: '💰', children: [
      { id: 'solicitudes', label: 'Solicitudes' },
      { id: 'nuevo', label: 'Nuevo' },
      { id: 'beneficios', label: 'Beneficios' },
    ]},
    { id: 'suscripciones', label: 'Suscripciones', icon: '🔁' },
    { id: 'users', label: 'Usuarios', icon: '👥' },
  ]},
  { id: 'redes', label: 'Redes Sociales', icon: '📱', items: [
    { id: 'social', label: 'Redes Sociales', icon: '📱', children: [
      { id: 'publicar', label: '📢 Publicar' },
      { id: 'servicios', label: '🖼️ Servicios' },
      { id: 'estadisticas', label: '📊 Estadísticas' },
      { id: 'productos', label: '🛍️ Productos' },
      { id: 'proyectos', label: '📁 Proyectos' },
      { id: 'reel', label: '🎬 Reel' },
      { id: 'labs', label: '🧪 Labs' },
    ]},
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { id: 'cron', label: 'Cron Social', icon: '⏰' },
  ]},
  { id: 'marketing', label: 'Marketing', icon: '🎯', items: [
    { id: 'leads', label: 'Lead Finder', icon: '🎯' },
    { id: 'leads-map', label: 'Mapa de Leads', icon: '📍' },
    { id: 'leadfinder-plans', label: 'Planes', icon: '💳' },
    { id: 'zonas', label: 'Zonas', icon: '🗺️' },
    { id: 'auditorias', label: 'Auditorías', icon: '📋' },
    { id: 'auditorias-todas', label: 'Todas las Auditorías', icon: '🗂️' },
    { id: 'audit-requests', label: 'Solicitudes SEO', icon: '🔍' },
    { id: 'emails', label: 'Emails', icon: '📧' },
    { id: 'style-quiz', label: 'Test de Estilo', icon: '🎨' },
  ]},
  { id: 'sitio', label: 'Sitio', icon: '🌐', items: [
    { id: 'proyectos', label: 'Proyectos', icon: '🌐' },
    { id: 'questions', label: 'Preguntas', icon: '💬' },
    { id: 'nav-config', label: 'Configurar Interfaz', icon: '🧭' },
  ]},
  { id: 'herramientas', label: 'Herramientas', icon: '🔧', items: [
    { id: 'rubros-buscados', label: 'Rubros buscados', icon: '🔍' },
  ]},
  { id: 'dev', label: 'Dev', icon: '🧰', items: [
    { id: 'free-for-dev', label: 'Free for Dev', icon: '🆓' },
  ]},
];
