export const dynamic = 'force-dynamic';
import 'pdf-parse/worker'; // debe importarse antes que PDFParse (setup del worker en serverless)
import { getPath } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

PDFParse.setWorker(getPath());

// Motor de reglas propio (sin IA de terceros): extrae texto del PDF y puntúa
// por coincidencia de keywords + señales de estructura. 100% gratis, sin
// dependencia externa que pueda romperse por un modelo deprecado o un rate limit.

// keywords ordenadas por relevancia — las primeras son las que más pesan
// como "skills_found" destacadas y las últimas como "skills_missing" sugeridas.
const PROFESIONES = {
  'Desarrollador Full Stack': ['javascript', 'react', 'node', 'typescript', 'html', 'css', 'api rest', 'sql', 'git', 'next.js', 'express', 'mongodb', 'docker', 'ci/cd', 'testing'],
  'Desarrollador Frontend': ['javascript', 'react', 'html', 'css', 'typescript', 'next.js', 'vue', 'responsive', 'tailwind', 'redux', 'accesibilidad', 'figma', 'webpack', 'sass'],
  'Desarrollador Backend': ['node', 'python', 'java', 'sql', 'api rest', 'microservicios', 'docker', 'postgresql', 'mongodb', 'redis', 'autenticación', 'escalabilidad', 'kubernetes'],
  'Desarrollador React / Next.js': ['react', 'next.js', 'javascript', 'typescript', 'redux', 'hooks', 'ssr', 'tailwind', 'vercel', 'context api', 'jest', 'react query'],
  'Desarrollador Node.js': ['node', 'express', 'javascript', 'typescript', 'api rest', 'mongodb', 'postgresql', 'npm', 'async', 'websocket', 'jwt', 'microservicios'],
  'Analista de Datos': ['sql', 'excel', 'power bi', 'python', 'tableau', 'estadística', 'etl', 'dashboard', 'kpi', 'reportes', 'pandas', 'visualización de datos'],
  'Data Scientist': ['python', 'machine learning', 'pandas', 'numpy', 'scikit-learn', 'estadística', 'sql', 'modelos predictivos', 'jupyter', 'tensorflow', 'deep learning', 'r'],
  'Business Intelligence Analyst': ['power bi', 'sql', 'tableau', 'etl', 'kpi', 'dashboard', 'data warehouse', 'excel avanzado', 'dax', 'reportes gerenciales'],
  'Desarrollador Python': ['python', 'django', 'flask', 'sql', 'api rest', 'pandas', 'testing', 'pip', 'orm', 'automatización', 'scripts'],
  'DevOps / Cloud Engineer': ['aws', 'docker', 'kubernetes', 'ci/cd', 'terraform', 'linux', 'jenkins', 'azure', 'gcp', 'monitoreo', 'infraestructura como código', 'ansible'],
  'UX/UI Designer': ['figma', 'prototipado', 'investigación de usuarios', 'wireframes', 'design system', 'usabilidad', 'adobe xd', 'accesibilidad', 'sketch', 'user journey'],
  'Product Manager': ['roadmap', 'backlog', 'scrum', 'métricas', 'user stories', 'stakeholders', 'priorización', 'a/b testing', 'discovery', 'okrs'],
  'Scrum Master / Agile Coach': ['scrum', 'agile', 'sprint', 'kanban', 'retrospectiva', 'facilitación', 'jira', 'daily', 'certificación csm', 'equipos autogestionados'],
  'Arquitecto de Software': ['arquitectura de software', 'microservicios', 'patrones de diseño', 'escalabilidad', 'aws', 'docker', 'cloud', 'diseño de sistemas', 'documentación técnica'],
  'Analista de Sistemas': ['relevamiento de requerimientos', 'sql', 'documentación', 'procesos', 'uml', 'testing', 'soporte', 'erp', 'metodologías ágiles'],
  'QA Automation Engineer': ['selenium', 'testing', 'cypress', 'automatización de pruebas', 'jest', 'casos de prueba', 'jira', 'ci/cd', 'api testing', 'postman'],
  'Machine Learning Engineer': ['python', 'machine learning', 'tensorflow', 'pytorch', 'mlops', 'modelos', 'deep learning', 'aws', 'docker', 'feature engineering'],
  'Desarrollador Mobile (React Native)': ['react native', 'javascript', 'typescript', 'ios', 'android', 'expo', 'redux', 'apis móviles', 'firebase', 'app store'],
  'Consultor IT': ['relevamiento', 'consultoría', 'implementación', 'procesos de negocio', 'erp', 'gestión de proyectos', 'documentación', 'capacitación a usuarios'],
  'Administrador de Base de Datos': ['sql', 'postgresql', 'mysql', 'oracle', 'backups', 'optimización de consultas', 'replicación', 'índices', 'administración de bd'],
};

const STRUCTURE_CHECKS = [
  { key: 'contacto',     re: /(email|correo|@|tel[eé]fono|celular|linkedin)/i },
  { key: 'experiencia',  re: /(experiencia\s+laboral|experiencia\s+profesional|work\s+experience|trayectoria)/i },
  { key: 'educacion',    re: /(educaci[oó]n|formaci[oó]n\s+acad[eé]mica|estudios|education)/i },
  { key: 'habilidades',  re: /(habilidades|competencias|skills|tecnolog[ií]as|herramientas)/i },
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // saca acentos para matchear mejor
}

function scoreProfesion(normText, keywords) {
  const found = [];
  const missing = [];
  for (const kw of keywords) {
    const kwNorm = normalize(kw);
    if (normText.includes(kwNorm)) found.push(kw);
    else missing.push(kw);
  }
  const keywordScore = (found.length / keywords.length) * 100;
  return { found, missing, keywordScore };
}

function structureScore(rawText) {
  let hits = 0;
  for (const check of STRUCTURE_CHECKS) {
    if (check.re.test(rawText)) hits++;
  }
  return (hits / STRUCTURE_CHECKS.length) * 100;
}

function buildRecomendacion(profesion, found, missing, score) {
  const topMissing = missing.slice(0, 2);
  if (score >= 70) {
    return topMissing.length
      ? `Buen encaje con ${profesion}. Para reforzarlo, sumá menciones concretas de ${topMissing.join(' y ')} en tu experiencia.`
      : `Excelente encaje con ${profesion} — tu CV cubre las palabras clave principales del rubro.`;
  }
  if (score >= 40) {
    return `Encaje parcial con ${profesion}. Te faltan mencionar ${topMissing.join(' y ') || 'algunas tecnologías clave del rubro'}, e ideal cuantificar logros con números.`;
  }
  return `Encaje bajo con ${profesion} por ahora. Sumá experiencia o proyectos con ${topMissing.join(' y ') || 'las tecnologías principales del rubro'} para mejorar tu compatibilidad.`;
}

export async function POST(request) {
  let parser = null;
  try {
    const form = await request.formData();
    const file = form.get('cv');
    const topN = Math.min(parseInt(form.get('topN') || '5', 10), 10);

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No se recibió archivo.' }, { status: 400 });
    }

    const mimeType = file.type || '';
    const fileName = file.name || '';
    if (!mimeType.includes('pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
      return Response.json({
        error: 'Por favor, subí tu CV en formato PDF. Los archivos DOCX no están soportados actualmente.',
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    parser = new PDFParse({ data: buffer });
    const { text: rawText } = await parser.getText();

    if (!rawText || rawText.trim().length < 150) {
      return Response.json({
        error: 'No pudimos leer suficiente texto del PDF. Si es un CV escaneado como imagen, exportalo como PDF con texto seleccionable (no como foto/escaneo).',
      }, { status: 400 });
    }

    const normText = normalize(rawText);
    const structScore = structureScore(rawText);

    const results = Object.entries(PROFESIONES).map(([profesion, keywords]) => {
      const { found, missing, keywordScore } = scoreProfesion(normText, keywords);
      const score = Math.round(keywordScore * 0.85 + structScore * 0.15);
      return {
        profesion,
        score: Math.max(0, Math.min(100, score)),
        skills_found: found.slice(0, 10),
        skills_missing: missing.slice(0, 8),
        recomendaciones: buildRecomendacion(profesion, found, missing, score),
      };
    });

    results.sort((a, b) => b.score - a.score);

    return Response.json({ results: results.slice(0, topN) });
  } catch (error) {
    console.error('Error en analyze-cv:', error);
    return Response.json({ error: 'Error al analizar el CV. Verificá que el archivo no esté dañado e intentá de nuevo.' }, { status: 500 });
  } finally {
    if (parser) await parser.destroy().catch(() => {});
  }
}
