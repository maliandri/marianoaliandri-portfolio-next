// Reels automáticos (Remotion, carpeta video/): lógica pura, sin I/O. Arma las escenas y lo que dice la
// voz en off de cada tipo de reel; scripts/reel-prep.mjs las completa con el audio y video/ las renderiza.
// Tipos que rotan: explicador (una pieza del bot de contenido), ranking (un informe de demanda) y dato
// (números reales de las auditorías). Cada escena: { tipo, ...lo que se ve, voz: lo que se dice }.

export const TIPOS = ['explicador', 'ranking', 'dato'];
const MAX_PUNTOS = 4;
const SITE = 'marianoaliandri.com.ar';

export function siguientesTipos(ultimo) {
  const i = TIPOS.indexOf(ultimo);
  return TIPOS.map((_, k) => TIPOS[(i + 1 + k) % TIPOS.length]);
}

// Primera oración (o un recorte prolijo) para que cada escena se lea y se escuche en pocos segundos.
export function primeraOracion(texto, max = 130) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^.{20,}?[.!?](?=\s|$)/);
  const o = m && m[0].length <= max ? m[0] : t;
  if (o.length <= max) return o;
  const corte = o.slice(0, max);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

// "marianoaliandri.com.ar/aprende" leído en voz alta.
const sitioEnVoz = (path = '') => `marianoaliandri punto com punto ar${path ? ` barra ${path}` : ''}`;

const cierre = (link, voz) => ({ tipo: 'cierre', texto: 'Mandáselo a alguien que tenga un negocio', link: `${SITE}/${link}`, voz });

export function reelExplicador(c) {
  const puntos = (c.slides || []).slice(0, MAX_PUNTOS);
  return {
    serie: c.serieNombre,
    titulo: c.titulo,
    escenas: [
      { tipo: 'hook', texto: c.titulo, voz: c.titulo },
      ...puntos.map((s, i) => {
        const texto = primeraOracion(s.texto);
        return { tipo: 'punto', numero: i + 1, titulo: s.titulo, texto, voz: `${s.titulo}. ${texto}` };
      }),
      cierre('aprende', `Si te sirvió, mandáselo a alguien que tenga un negocio. Hay más en ${sitioEnVoz('aprende')}.`),
    ],
  };
}

export function reelRanking(r) {
  const top = (r.top || []).slice(0, 5);
  const frase = top[0]?.ejemplos?.[0];
  const nombres = top.map(t => t.label.toLowerCase());
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0];
  return {
    serie: 'Qué se busca en Google',
    titulo: `Qué se busca en Google en ${r.zona}`,
    escenas: [
      { tipo: 'hook', texto: `¿Qué se busca en Google en ${r.zona}?`, voz: `¿Qué busca la gente en Google en ${r.zona}?` },
      { tipo: 'barras', titulo: 'Los 5 rubros más buscados', items: top.map(t => ({ label: t.label, valor: t.interes })), voz: `Los cinco rubros más buscados son ${lista}.` },
      ...(frase ? [{ tipo: 'hook', texto: `“${frase}”`, voz: `Y lo que más escribe la gente es: ${frase}.` }] : []),
      cierre('demanda', `Si tenés un negocio de esos rubros, te están buscando. Mirá los veinte en ${sitioEnVoz('demanda')}.`),
    ],
  };
}

export function reelDato(s) {
  if (!s) return null;
  const datos = [
    s.pctSinDescripcionEnGoogle != null && { valor: s.pctSinDescripcionEnGoogle, texto: 'no tiene descripción en Google', voz: 'no tiene descripción en Google: la gente ve cualquier texto cuando los busca' },
    s.pctSinFotoAlCompartir != null && { valor: s.pctSinFotoAlCompartir, texto: 'sale sin foto cuando la compartís por WhatsApp', voz: 'sale sin foto cuando alguien la comparte por WhatsApp' },
    s.pctPuntajeBajo50 != null && { valor: s.pctPuntajeBajo50, texto: 'tiene un puntaje SEO menor a 50 sobre 100', voz: 'tiene un puntaje de posicionamiento menor a cincuenta sobre cien' },
    s.pctSinSitemap != null && { valor: s.pctSinSitemap, texto: 'no le dice a Google qué páginas tiene', voz: 'no le avisa a Google qué páginas tiene' },
  ].filter(d => d && d.valor >= 20).sort((a, b) => b.valor - a.valor).slice(0, 3);
  if (!datos.length) return null;
  const donde = s.ciudades?.length ? ` de ${s.ciudades.slice(0, 2).join(' y ')}` : '';
  return {
    serie: 'El error que más veo',
    titulo: `Revisé ${s.sitiosAuditados} webs de negocios${donde}`,
    escenas: [
      { tipo: 'hook', texto: `Revisé ${s.sitiosAuditados} webs de negocios${donde}`, voz: `Revisé ${s.sitiosAuditados} webs de negocios${donde}. Esto encontré.` },
      ...datos.map(d => ({ tipo: 'numero', valor: d.valor, sufijo: '%', texto: d.texto, voz: `El ${d.valor} por ciento ${d.voz}.` })),
      cierre('auditorias', `¿Y la tuya cómo está? Mirá las auditorías en ${sitioEnVoz('auditorias')}.`),
    ],
  };
}

// Duración de cada escena: lo que dura su voz + un respiro (y un mínimo para que se lea).
export const duracionEscena = (segundosVoz) => Math.max(2.8, Math.round((segundosVoz + 0.7) * 10) / 10);

export function captionReel(tipo, reel, { link, hashtags = [] } = {}) {
  const intro = {
    explicador: reel.titulo,
    ranking: `${reel.titulo}: el ranking de los rubros con más demanda de búsqueda.`,
    dato: `${reel.titulo}. Estos son los errores que más se repiten.`,
  }[tipo] || reel.titulo;
  return [
    intro,
    '',
    '📲 Mandáselo a alguien que tenga un negocio.',
    '',
    `Más en: ${link}`,
    '',
    ['#NegociosLocales', '#Neuquén', ...hashtags.map(h => `#${h}`)].slice(0, 5).join(' '),
  ].join('\n');
}
