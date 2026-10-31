// Señales comerciales de un sitio (src/lib/siteSignals.js): pauta paga, agencia y plataforma.
// Solo admin: la página pública de auditorías no las recibe.
export default function SenalesBadges({ neg }) {
  const { anuncios, agencia, plataforma } = neg || {};
  const badges = [];
  if (anuncios?.meta) badges.push({ key: 'meta', text: 'Pauta Meta', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', title: 'Tiene el píxel de Facebook/Instagram: paga anuncios' });
  if (anuncios?.google) badges.push({ key: 'google', text: 'Pauta Google', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', title: 'Tiene la etiqueta de conversiones de Google Ads: paga anuncios' });
  if (plataforma) badges.push({ key: 'plat', text: plataforma, cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', title: 'Plataforma del sitio' });

  if (!badges.length && !agencia) return <span className="text-gray-300">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {badges.map(b => (
        <span key={b.key} title={b.title} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${b.cls}`}>{b.text}</span>
      ))}
      {agencia && (
        <span title={`Crédito en el pie del sitio (confianza ${Math.round((agencia.confianza || 0) * 100)}%)`}
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
          {agencia.url
            ? <a href={agencia.url} target="_blank" rel="noopener noreferrer" className="hover:underline">Hecho por {agencia.nombre}</a>
            : <>Hecho por {agencia.nombre}</>}
        </span>
      )}
    </span>
  );
}
