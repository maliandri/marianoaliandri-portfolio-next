export const initializeChat = () => {
  console.log("🔌 Chat de Mariano conectado al servidor seguro.");
};

export const sendMessageToGemini = async (userMessage, currentHistory = []) => {
  try {
    // ✅ Verificar que currentHistory sea un array antes de usar .map()
    const formattedHistory = Array.isArray(currentHistory)
      ? currentHistory.map(msg => ({
          role: msg.isBot ? 'model' : 'user',
          parts: [{ text: msg.text }]
        }))
      : [];

    // 🔧 DETECCIÓN DE ENTORNO
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (!isProduction) {
      // ⚠️ DESARROLLO LOCAL: Simular respuesta (sin API key expuesta)
      console.warn('⚠️ Modo desarrollo: Usando respuestas simuladas');
      console.log('💡 Para probar Gemini en local, ejecutá: netlify dev');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay de red

      return `Hola! 👋 Soy el asistente de Mariano (modo desarrollo).

En producción me conecto a Gemini AI para darte respuestas inteligentes sobre:
- Análisis de Datos y Power BI
- Desarrollo Web Full Stack
- Consultoría en Business Intelligence
- Python, Excel, automatización

Para probar en local con Gemini real, ejecutá:
\`\`\`bash
netlify dev
\`\`\`

¿En qué puedo ayudarte hoy?`;
    }

    // ✅ PRODUCCIÓN: Usar Netlify Function
    console.log('🚀 Enviando mensaje a Netlify Function...');
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        conversationHistory: formattedHistory
      })
    });

    console.log('📡 Respuesta del servidor:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error del servidor:', errorData);
      throw new Error(`Error servidor: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Respuesta recibida de Gemini');
    return data.response;

  } catch (error) {
    console.error('❌ Error comunicando con Gemini:', error);
    console.error('Stack:', error.stack);

    // Mensaje de error más informativo
    if (error.message.includes('404')) {
      return "La función de chat no está disponible. Por favor, contactá directamente por WhatsApp o email.";
    }

    return "Disculpá, estoy teniendo un problema de conexión. Por favor, contactame por WhatsApp al +54 299 541-4422 o por email a marianoaliandri@gmail.com";
  }
};
