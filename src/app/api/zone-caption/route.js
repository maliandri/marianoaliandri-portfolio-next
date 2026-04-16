export const dynamic = 'force-dynamic';
import { GoogleGenerativeAI } from '@google/generative-ai';

const TONE_INSTRUCTIONS = {
  técnico: 'Usá datos precisos, porcentajes, tiempos exactos y terminología técnica urbana. Dirigido a profesionales del sector inmobiliario, transporte o urbanismo.',
  comercial: 'Destacá oportunidades de negocio, potencial comercial de la zona, flujo de clientes y datos que interesen a inversores y comerciantes. Tono persuasivo.',
  social: 'Tono cercano e informativo para público general. Destacá el impacto en la vida cotidiana de los vecinos. Amigable y accesible.',
};

export async function POST(request) {
  try {
    const { tone, networks, extraContext, medios = [], result } = await request.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const networkNote =
      networks === 'Todas' ? 'para LinkedIn, Instagram y Facebook'
      : networks === 'Instagram' ? 'para Instagram'
      : networks === 'Facebook' ? 'para Facebook'
      : 'para LinkedIn';

    const peakHour   = result.peak_hours?.[0];
    const valleyHour = result.valley_hour;
    const trafficSummary = peakHour
      ? `Hora pico: ${peakHour.label} con ${peakHour.minutes} min de tránsito. Hora valle: ${valleyHour?.label || 'N/A'} con ${valleyHour?.minutes || '–'} min.`
      : result.summary || 'Sin datos de tráfico disponibles.';

    const deltaText = result.delta_minutes > 0
      ? `${result.delta_minutes} min más lento en hora pico (+${result.delta_percent}%)`
      : 'Sin variación significativa entre horas';

    // Breakdown por categoría
    const categoryLines = result.commercial?.by_category
      ? Object.entries(result.commercial.by_category)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => `  · ${cat}: ${count >= 20 ? 'más de 20' : count} locales`)
          .join('\n')
      : '';

    // Top lugares para menciones
    const topPlaces = result.commercial?.top_places || [];
    const mentionsNote = topPlaces.length > 0
      ? `- Referencias destacadas de la zona (mencioná 2-3 usando @NombreLocal — son sugerencias que el usuario va a verificar antes de publicar): ${topPlaces.map(p => p.name).join(', ')}`
      : '';

    const mediosRule = medios.length > 0
      ? `- OBLIGATORIO: mencioná estos medios/portales en el texto etiquetándolos directamente (${medios.join(', ')}). Integralos de forma natural, ej: "¿Lo cubrirá ${medios[0]}?" o "Datos que ${medios[0]} y ${medios[1] || medios[0]} deberían cubrir". No los omitas.`
      : '';

    const prompt = `Generá un caption ${networkNote} sobre este análisis de zona urbana en Argentina.

TONO: ${tone} — ${TONE_INSTRUCTIONS[tone] || ''}

DATOS DEL ANÁLISIS:
- Zona analizada: ${result.zona_titulo}
- Fecha: ${result.fecha || 'fecha reciente'}
- Tráfico: ${trafficSummary}
- Variación pico vs valle: ${deltaText}
- Total de locales relevados: ${result.commercial?.total_places}
- Rating promedio: ${result.commercial?.avg_rating} ⭐
${categoryLines ? `- Mix comercial por categoría:\n${categoryLines}` : ''}
${mentionsNote}

${extraContext ? `CONTEXTO ADICIONAL: ${extraContext}` : ''}

REGLAS (seguí todas sin excepción):
- Máximo 2000 caracteres
- Emojis relevantes (2-3)
- Terminá con 4-6 hashtags en español sobre datos urbanos, tráfico y ${result.zona_titulo}
- Tono argentino (vos, che) si es social; formal si es técnico o comercial
- No menciones precios ni datos de contacto
${mediosRule}
${topPlaces.length > 0 ? `- Podés incluir 1-2 @menciones de locales destacados integradas naturalmente (son sugerencias, el usuario las revisa): ${topPlaces.slice(0, 3).map(p => p.name).join(', ')}` : ''}
- Devolvé SOLO el texto del caption, sin comillas ni encabezados

Caption:`;

    const response = await model.generateContent(prompt);
    const caption = response.response.text().trim();

    return Response.json({ caption });
  } catch (error) {
    console.error('zone-caption error:', error);
    return Response.json({ error: 'Error generando caption' }, { status: 500 });
  }
}
