// Genera src/data/localidadesAR.js con TODAS las localidades censales de Argentina
// Fuente: API Georef (datos.gob.ar) — oficial, gratuita, sin API key.
// Uso: node scripts/gen-localidades.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://apis.datos.gob.ar/georef/api';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'localidadesAR.js');

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function main() {
  const { provincias } = await getJSON(`${BASE}/provincias?campos=id,nombre&max=100`);
  provincias.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const out = [];
  for (const prov of provincias) {
    // localidades-censales = ciudades/pueblos reales del censo (no caseríos ni partidos)
    const { localidades_censales = [] } = await getJSON(
      `${BASE}/localidades-censales?provincia=${prov.id}&campos=nombre&max=5000`
    );
    const nombres = [...new Set(localidades_censales.map(l => l.nombre.trim()))]
      .sort((a, b) => a.localeCompare(b, 'es'));

    // Normalizamos el nombre de CABA para que quede corto
    const provincia = prov.nombre === 'Ciudad Autónoma de Buenos Aires'
      ? 'Ciudad de Buenos Aires'
      : prov.nombre.startsWith('Tierra del Fuego')
      ? 'Tierra del Fuego'
      : prov.nombre;

    out.push({ provincia, localidades: nombres.length ? nombres : [provincia] });
    console.log(`  ${provincia}: ${nombres.length} localidades`);
  }

  const body =
    '// AUTOGENERADO por scripts/gen-localidades.mjs — Fuente: API Georef (datos.gob.ar)\n' +
    '// Para regenerar: node scripts/gen-localidades.mjs\n' +
    'export const PROVINCIAS_AR = ' +
    JSON.stringify(out, null, 2) +
    ';\n';

  await writeFile(OUT, body, 'utf8');
  const total = out.reduce((n, p) => n + p.localidades.length, 0);
  console.log(`\n✅ ${OUT}\n   ${out.length} provincias · ${total} localidades`);
}

main().catch(e => { console.error(e); process.exit(1); });
