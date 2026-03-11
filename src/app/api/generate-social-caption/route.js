export const dynamic = 'force-dynamic';
import { GoogleGenerativeAI } from '@google/generative-ai';

const TONO_DESC = {
  profesional: 'formal y B2B, transmite autoridad y expertise técnico, ideal para LinkedIn',
  cercano: 'conversacional y amigable, cercano al lector, ideal para Instagram y Facebook',
  urgente: 'urgente y directo, con llamada a la acción fuerte, genera sensación de necesidad',
  educativo: 'educativo y de valor, explica el servicio, agrega conocimiento útil',
};

const RED_DESC = {
  instagram: 'Instagram (visual, usa emojis creativamente, máx 2200 caracteres, informal)',
  linkedin: 'LinkedIn (profesional, storytelling, agrega valor, máx 700 caracteres)',
  facebook: 'Facebook (conversacional, storytelling corto, invita a interactuar)',
  whatsapp: 'WhatsApp (breve y directo, personal, como mensaje a un contacto de confianza)',
};

export async function POST(request) {
  try {
    const { servicioId, servicioNombre, descripcion, red, tono } = await request.json();

    if (!servicioNombre || !descripcion || !red || !tono) {
      return Response.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 600,
      },
    });

    const prompt = `Sos un experto en marketing digital para freelancers tech en Argentina.

Generá un caption para ${RED_DESC[red] || red} sobre el servicio "${servicioNombre}".
Descripción del servicio: ${descripcion}
Tono requerido: ${TONO_DESC[tono] || tono}

REGLAS:
- Escribí en español argentino (usá "vos", "te", "tu negocio")
- Incluí emojis relevantes (sin exceso)
- Terminá con una llamada a la acción clara
- NO incluyas los hashtags en el caption (van por separado)
- Que sea natural, no robótico ni genérico
- Mencioná brevemente el diferencial técnico del servicio

Generá también entre 6 y 8 hashtags relevantes para Argentina: mezcla de nicho técnico y amplio alcance.

Respondé ÚNICAMENTE con JSON válido, sin markdown, sin bloques de código:
{"caption": "texto del caption aquí", "hashtags": ["hashtag1", "hashtag2", "hashtag3"]}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: 'Error al parsear respuesta de Gemini', raw }, { status: 500 });
    }

    return Response.json({
      success: true,
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(h => h.replace(/^#/, '')) : [],
    });
  } catch (error) {
    console.error('Error en generate-social-caption:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
