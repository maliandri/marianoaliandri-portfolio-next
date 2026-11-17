import { describe, it, expect } from 'vitest';
import { historialAMensajes, MAX_TURNOS, MAX_TEXTO_HISTORIAL } from './chatHistory';

const m = (role, text) => ({ role, parts: [{ text }] });

describe('historialAMensajes', () => {
  it('convierte model → assistant y descarta el saludo inicial del bot', () => {
    expect(historialAMensajes([m('model', 'Hola'), m('user', 'quiero una web'), m('model', 'Genial')])).toEqual([
      { role: 'user', content: 'quiero una web' },
      { role: 'assistant', content: 'Genial' },
    ]);
  });
  it('recorta a los últimos turnos y limita el largo de cada uno', () => {
    const largo = Array.from({ length: 30 }, (_, i) => m(i % 2 ? 'model' : 'user', `x${i}`));
    expect(historialAMensajes(largo).length).toBeLessThanOrEqual(MAX_TURNOS);
    expect(historialAMensajes([m('user', 'a'.repeat(5000))])[0].content).toHaveLength(MAX_TEXTO_HISTORIAL);
  });
  it('tolera basura', () => {
    expect(historialAMensajes(null)).toEqual([]);
    expect(historialAMensajes('hola')).toEqual([]);
    expect(historialAMensajes([null, {}, { role: 'user', parts: [] }, m('user', '  ')])).toEqual([]);
  });
});
