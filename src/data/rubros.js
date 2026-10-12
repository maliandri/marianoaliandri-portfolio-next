// Rubros de negocio local — fuente única compartida.
// `id` = identificador interno → mapeado a tags OSM en lead-finder/route.js (OSM_TAGS).
// `label` = nombre en español (se usa como término de búsqueda en el Keyword Explorer).
// `cat` = agrupación para el UI.
// `query` (opcional) = el rubro se busca por texto en vez de por tipo de Places.
// Usado por: LeadFinderPanel (admin), KeywordExplorer (/keywords), el buscador de Lead Finder (src/components/leadfinder) y la auditoría automática.
export const RUBROS = [
  // Gastronomía
  { id: 'restaurant',           label: 'Restaurante',       cat: 'Gastronomía' },
  { id: 'cafe',                 label: 'Café',              cat: 'Gastronomía' },
  { id: 'bar',                  label: 'Bar',               cat: 'Gastronomía' },
  { id: 'bakery',               label: 'Panadería',         cat: 'Gastronomía' },
  { id: 'pizza_restaurant',     label: 'Pizzería',          cat: 'Gastronomía' },
  { id: 'ice_cream_shop',       label: 'Heladería',         cat: 'Gastronomía' },
  { id: 'meal_takeaway',        label: 'Comida p/llevar',   cat: 'Gastronomía' },
  { id: 'meal_delivery',        label: 'Delivery',          cat: 'Gastronomía' },
  // Comercios
  { id: 'store',                label: 'Tienda',            cat: 'Comercios' },
  { id: 'clothing_store',       label: 'Ropa',              cat: 'Comercios' },
  { id: 'shoe_store',           label: 'Zapatería',         cat: 'Comercios' },
  { id: 'jewelry_store',        label: 'Joyería',           cat: 'Comercios' },
  { id: 'hardware_store',       label: 'Ferretería',        cat: 'Comercios' },
  { id: 'florist',              label: 'Floristería',       cat: 'Comercios' },
  { id: 'pet_store',            label: 'Mascotas',          cat: 'Comercios' },
  { id: 'supermarket',          label: 'Supermercado',      cat: 'Comercios' },
  { id: 'convenience_store',    label: 'Autoservicio',      cat: 'Comercios' },
  { id: 'furniture_store',      label: 'Muebles',           cat: 'Comercios' },
  { id: 'electronics_store',    label: 'Electrónica',       cat: 'Comercios' },
  { id: 'home_goods_store',     label: 'Bazar / Hogar',     cat: 'Comercios' },
  { id: 'book_store',           label: 'Librería',          cat: 'Comercios' },
  { id: 'gift_shop',            label: 'Regalería',         cat: 'Comercios' },
  { id: 'sporting_goods_store', label: 'Deportes',          cat: 'Comercios' },
  { id: 'bicycle_store',        label: 'Bicicletería',      cat: 'Comercios' },
  { id: 'cell_phone_store',     label: 'Celulares',         cat: 'Comercios' },
  { id: 'liquor_store',         label: 'Vinoteca',          cat: 'Comercios' },
  { id: 'shopping_mall',        label: 'Shopping',          cat: 'Comercios' },
  // Salud & Belleza
  { id: 'hair_care',            label: 'Peluquería',        cat: 'Salud & Belleza' },
  { id: 'beauty_salon',         label: 'Salón de Belleza',  cat: 'Salud & Belleza' },
  { id: 'barber_shop',          label: 'Barbería',          cat: 'Salud & Belleza' },
  { id: 'nail_salon',           label: 'Manicura',          cat: 'Salud & Belleza' },
  { id: 'spa',                  label: 'Spa',               cat: 'Salud & Belleza' },
  { id: 'gym',                  label: 'Gimnasio',          cat: 'Salud & Belleza' },
  { id: 'dentist',              label: 'Dentista',          cat: 'Salud & Belleza' },
  { id: 'doctor',               label: 'Médico',            cat: 'Salud & Belleza' },
  { id: 'physiotherapist',      label: 'Kinesiología',      cat: 'Salud & Belleza' },
  { id: 'pharmacy',             label: 'Farmacia',          cat: 'Salud & Belleza' },
  { id: 'veterinary_care',      label: 'Veterinaria',       cat: 'Salud & Belleza' },
  // Servicios profesionales
  { id: 'real_estate_agency',   label: 'Inmobiliaria',      cat: 'Serv. Profesionales' },
  { id: 'lawyer',               label: 'Abogado',           cat: 'Serv. Profesionales' },
  { id: 'accounting',           label: 'Contabilidad',      cat: 'Serv. Profesionales' },
  { id: 'insurance_agency',     label: 'Seguros',           cat: 'Serv. Profesionales' },
  { id: 'travel_agency',        label: 'Ag. de Viajes',     cat: 'Serv. Profesionales' },
  { id: 'photographer',         label: 'Fotógrafo',         cat: 'Serv. Profesionales' },
  // Automotor
  { id: 'car_repair',           label: 'Mecánico',          cat: 'Automotor' },
  { id: 'car_dealer',           label: 'Concesionaria',     cat: 'Automotor' },
  { id: 'car_wash',             label: 'Lavadero',          cat: 'Automotor' },
  { id: 'car_rental',           label: 'Alquiler de autos', cat: 'Automotor' },
  { id: 'gas_station',          label: 'Estación de servicio', cat: 'Automotor' },
  // Hogar & Oficios
  { id: 'electrician',          label: 'Electricista',      cat: 'Hogar & Oficios' },
  { id: 'plumber',              label: 'Plomero',           cat: 'Hogar & Oficios' },
  { id: 'painter',              label: 'Pintor',            cat: 'Hogar & Oficios' },
  { id: 'general_contractor',   label: 'Constructor',       cat: 'Hogar & Oficios', query: 'constructora' }, // tipo no soportado por Places API New → búsqueda por texto
  { id: 'locksmith',            label: 'Cerrajero',         cat: 'Hogar & Oficios' },
  { id: 'laundry',              label: 'Lavandería',        cat: 'Hogar & Oficios' },
  { id: 'moving_company',       label: 'Mudanzas',          cat: 'Hogar & Oficios' },
  // Educación
  { id: 'school',               label: 'Escuela',           cat: 'Educación' },
  { id: 'primary_school',       label: 'Primaria',          cat: 'Educación' },
  { id: 'secondary_school',     label: 'Secundaria',        cat: 'Educación' },
  { id: 'preschool',            label: 'Jardín',            cat: 'Educación' },
  { id: 'university',           label: 'Universidad',       cat: 'Educación' },
  // Alojamiento & Turismo
  { id: 'lodging',              label: 'Alojamiento',       cat: 'Alojamiento' },
  { id: 'hotel',                label: 'Hotel',             cat: 'Alojamiento' },
  { id: 'motel',                label: 'Motel',             cat: 'Alojamiento' },
  { id: 'campground',           label: 'Camping',           cat: 'Alojamiento' },
];

// Rubros agrupados por categoría, preservando el orden de aparición.
export const CATEGORIAS_RUBROS = [...new Set(RUBROS.map(r => r.cat))];

// Selección por defecto: los rubros de negocio local más comunes.
// Usado por LeadFinderPanel (admin) y LeadMapPanel (mapa móvil) para no tener
// que tildar los 65 rubros a mano en cada búsqueda.
export const DEFAULT_TIPOS = [
  'restaurant', 'cafe', 'bar', 'bakery', 'store', 'clothing_store', 'hair_care',
  'beauty_salon', 'gym', 'dentist', 'real_estate_agency', 'lawyer', 'accounting',
  'car_repair', 'pharmacy', 'pet_store', 'veterinary_care', 'lodging',
];

// Nombres en inglés para /en/lead-finder-pro (el resto del sitio usa `label`).
export const RUBRO_LABEL_EN = {
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', bakery: 'Bakery', pizza_restaurant: 'Pizzeria',
  ice_cream_shop: 'Ice cream shop', meal_takeaway: 'Takeaway', meal_delivery: 'Delivery',
  store: 'Store', clothing_store: 'Clothing', shoe_store: 'Shoe store', jewelry_store: 'Jewelry',
  hardware_store: 'Hardware store', florist: 'Florist', pet_store: 'Pet store', supermarket: 'Supermarket',
  convenience_store: 'Convenience store', furniture_store: 'Furniture', electronics_store: 'Electronics',
  home_goods_store: 'Home goods', book_store: 'Bookstore', gift_shop: 'Gift shop',
  sporting_goods_store: 'Sporting goods', bicycle_store: 'Bike shop', cell_phone_store: 'Phone store',
  liquor_store: 'Liquor store', shopping_mall: 'Shopping mall',
  hair_care: 'Hair salon', beauty_salon: 'Beauty salon', barber_shop: 'Barber shop', nail_salon: 'Nail salon',
  spa: 'Spa', gym: 'Gym', dentist: 'Dentist', doctor: 'Doctor', physiotherapist: 'Physiotherapist',
  pharmacy: 'Pharmacy', veterinary_care: 'Veterinarian',
  real_estate_agency: 'Real estate', lawyer: 'Lawyer', accounting: 'Accounting', insurance_agency: 'Insurance',
  travel_agency: 'Travel agency', photographer: 'Photographer',
  car_repair: 'Auto repair', car_dealer: 'Car dealer', car_wash: 'Car wash', car_rental: 'Car rental',
  gas_station: 'Gas station',
  electrician: 'Electrician', plumber: 'Plumber', painter: 'Painter', general_contractor: 'Contractor',
  locksmith: 'Locksmith', laundry: 'Laundry', moving_company: 'Moving company',
  school: 'School', primary_school: 'Primary school', secondary_school: 'Secondary school',
  preschool: 'Preschool', university: 'University',
  lodging: 'Lodging', hotel: 'Hotel', motel: 'Motel', campground: 'Campground',
};

export const CATEGORIA_EN = {
  'Gastronomía': 'Food & drink', 'Comercios': 'Retail', 'Salud & Belleza': 'Health & beauty',
  'Serv. Profesionales': 'Professional services', 'Automotor': 'Automotive', 'Hogar & Oficios': 'Home & trades',
  'Educación': 'Education', 'Alojamiento': 'Lodging & travel',
};

export function rubroLabel(rubro, lang = 'es') {
  if (!rubro) return '';
  return lang === 'en' ? (RUBRO_LABEL_EN[rubro.id] || rubro.label) : rubro.label;
}

export function categoriaLabel(cat, lang = 'es') {
  return lang === 'en' ? (CATEGORIA_EN[cat] || cat) : cat;
}
