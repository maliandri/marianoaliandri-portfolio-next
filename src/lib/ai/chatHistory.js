export const MAX_TURNOS = 10;
export const MAX_TEXTO_HISTORIAL = 1500;

// El navegador manda el historial en formato Gemini ({ role: 'user'|'model', parts: [{ text }] });
// el AI SDK espera { role: 'user'|'assistant', content }. Se recorta para que un cliente malicioso no
// pueda inflar el prompt: últimos MAX_TURNOS turnos, cada uno con tope de caracteres.
export function historialAMensajes(historial) {
  if (!Array.isArray(historial)) return [];
  const mensajes = historial.slice(-MAX_TURNOS).flatMap(m => {
    const text = String(m?.parts?.[0]?.text ?? '').slice(0, MAX_TEXTO_HISTORIAL).trim();
    if (!text) return [];
    return [{ role: m?.role === 'model' ? 'assistant' : 'user', content: text }];
  });
  // Gemini exige que la conversación arranque con el usuario: el saludo inicial del bot se descarta.
  while (mensajes.length && mensajes[0].role === 'assistant') mensajes.shift();
  return mensajes;
}
