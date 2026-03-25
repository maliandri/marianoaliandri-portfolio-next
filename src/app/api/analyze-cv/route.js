export const dynamic = 'force-dynamic';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PROFESIONES = [
  'Desarrollador Full Stack',
  'Desarrollador Frontend',
  'Desarrollador Backend',
  'Desarrollador React / Next.js',
  'Desarrollador Node.js',
  'Analista de Datos',
  'Data Scientist',
  'Business Intelligence Analyst',
  'Desarrollador Python',
  'DevOps / Cloud Engineer',
  'UX/UI Designer',
  'Product Manager',
  'Scrum Master / Agile Coach',
  'Arquitecto de Software',
  'Analista de Sistemas',
  'QA Automation Engineer',
  'Machine Learning Engineer',
  'Desarrollador Mobile (React Native)',
  'Consultor IT',
  'Administrador de Base de Datos',
];

export async function POST(request) {
  if (!process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return Response.json({ error: 'Servicio de análisis no configurado.' }, { status: 500 });
  }

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
    const base64 = Buffer.from(bytes).toString('base64');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });

    const prompt = `Sos un sistema ATS (Applicant Tracking System) experto en el mercado laboral latinoamericano.
Analizá el CV adjunto y evalualo contra estas ${PROFESIONES.length} profesiones:
${PROFESIONES.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Devolvé ÚNICAMENTE un JSON válido con esta estructura exacta (sin markdown, sin explicaciones, solo el JSON):
{
  "results": [
    {
      "profesion": "nombre exacto de la profesión de la lista",
      "score": número entero del 0 al 100,
      "skills_found": ["skill1", "skill2"],
      "skills_missing": ["skill1", "skill2"],
      "recomendaciones": "texto corto con 1-2 sugerencias concretas"
    }
  ]
}

Reglas:
- Incluí solo las ${topN} profesiones con mayor score
- El score refleja qué tan bien el CV encaja con esa profesión (skills, experiencia, keywords, logros)
- skills_found: máximo 10 skills/tecnologías del CV relevantes para esa profesión
- skills_missing: máximo 8 skills clave que le faltan al CV para esa profesión
- recomendaciones: máximo 2 oraciones, en español argentino (vos)
- Ordená los results de mayor a menor score`;

    const result = await model.generateContent([
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
      prompt,
    ]);

    const text = result.response.text().trim();

    // Extraer JSON aunque venga con markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Respuesta de Gemini sin JSON:', text.slice(0, 200));
      return Response.json({ error: 'El servicio no pudo procesar el CV. Intentá de nuevo.' }, { status: 500 });
    }

    const data = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(data.results)) {
      return Response.json({ error: 'Respuesta inesperada del analizador.' }, { status: 500 });
    }

    // Garantizar orden desc por score
    data.results.sort((a, b) => b.score - a.score);

    return Response.json(data);
  } catch (error) {
    console.error('Error en analyze-cv:', error);
    const msg = error?.message?.includes('RESOURCE_EXHAUSTED')
      ? 'Límite de uso alcanzado. Intentá en unos minutos.'
      : error?.message?.includes('INVALID_ARGUMENT')
      ? 'El archivo no pudo ser procesado. Asegurate de subir un PDF válido.'
      : 'Error al analizar el CV. Intentá de nuevo.';
    return Response.json({ error: msg }, { status: 500 });
  }
}
