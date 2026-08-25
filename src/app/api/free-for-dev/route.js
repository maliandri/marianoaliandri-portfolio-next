export const dynamic = 'force-dynamic';

const SOURCE_URL = 'https://raw.githubusercontent.com/ripienaar/free-for-dev/master/README.md';
const REPO_URL   = 'https://github.com/ripienaar/free-for-dev';

// Parsea el README (formato "## Categoria" + "  * [Nombre](url) - descripcion")
// a una estructura {categories:[{name, items:[{name,url,desc}]}]}.
function parseReadme(md) {
  const lines = md.split('\n');
  const categories = [];
  let current = null;
  let started = false;

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      started = true;
      current = { name: h2[1].trim(), items: [] };
      categories.push(current);
      continue;
    }
    if (!started || !current) continue;
    const item = line.match(/^\s*\*\s*\[([^\]]+)\]\(([^)]+)\)\s*-?\s*(.*)/);
    if (item) {
      current.items.push({ name: item[1].trim(), url: item[2].trim(), desc: item[3].trim() });
    }
  }

  return categories.filter(c => c.items.length > 0);
}

// GET público — el README de free-for-dev cambia seguido, se cachea 6h (Next fetch cache)
// para no pegarle a GitHub en cada carga del panel Admin, pero se refresca solo.
export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, { next: { revalidate: 21600 } });
    if (!res.ok) return Response.json({ error: `GitHub respondió ${res.status}` }, { status: 502 });
    const md = await res.text();
    const categories = parseReadme(md);
    const total = categories.reduce((a, c) => a + c.items.length, 0);

    return Response.json({
      categories,
      total,
      sourceUrl: REPO_URL,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
