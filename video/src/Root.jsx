import { Composition } from 'remotion';
import { Reel, FPS, TRANSICION } from './Reel';

// Una sola composición: el reel se arma con escenas (props.json lo escribe scripts/reel-prep.mjs).
// La duración sale de las escenas: cada una dura lo que su voz en off + un respiro.
const ejemplo = {
  serie: 'MCP en 30 segundos',
  musica: null,
  escenas: [
    { tipo: 'hook', texto: 'MCP es el USB-C entre Claude y tu negocio', dur: 3.5 },
    { tipo: 'punto', numero: 1, titulo: 'Un enchufe estándar', texto: 'Conecta a Claude con tus ventas, tu stock y tus clientes.', dur: 4 },
    { tipo: 'numero', valor: 68, sufijo: '%', texto: 'de las webs revisadas no tiene descripción en Google', dur: 4 },
    { tipo: 'barras', titulo: 'Lo más buscado', items: [{ label: 'Farmacia', valor: 100 }, { label: 'Escuela', valor: 97 }, { label: 'Veterinaria', valor: 95 }], dur: 5 },
    { tipo: 'cierre', texto: 'Mandáselo a alguien que tenga un negocio', link: 'marianoaliandri.com.ar/aprende', dur: 3.5 },
  ],
};

export const Root = () => (
  <Composition
    id="Reel"
    component={Reel}
    width={1080}
    height={1920}
    fps={FPS}
    defaultProps={ejemplo}
    calculateMetadata={({ props }) => {
      const total = props.escenas.reduce((s, e) => s + Math.round(e.dur * FPS), 0);
      return { durationInFrames: total - TRANSICION * (props.escenas.length - 1) };
    }}
  />
);
