import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { loadFont } from '@remotion/fonts';

export const FPS = 30;
export const TRANSICION = 12; // frames de transición entre escenas

// Misma marca que las placas del sitio (scripts/noticiaCard.mjs): fondo oscuro violeta, acento cian.
const C = { accent: '#22d3ee', bgFrom: '#0b1220', bgTo: '#2a1f6b', text: '#ffffff', soft: 'rgba(255,255,255,0.82)' };
const fuentes = Promise.all([
  loadFont({ family: 'Inter Tight', url: staticFile('fonts/inter-tight-800.woff'), weight: '800' }),
  loadFont({ family: 'Inter', url: staticFile('fonts/inter-500.woff'), weight: '500' }),
  loadFont({ family: 'Inter', url: staticFile('fonts/inter-700.woff'), weight: '700' }),
]);
void fuentes;

const PAD = 96;

// Fondo vivo: degradado + un círculo de luz que se mueve lento.
function Fondo() {
  const f = useCurrentFrame();
  const x = interpolate(Math.sin(f / 90), [-1, 1], [-180, 120]);
  const y = interpolate(Math.cos(f / 110), [-1, 1], [-120, 260]);
  return (
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(160deg, ${C.bgFrom} 0%, ${C.bgTo} 100%)` }}>
      <div style={{ position: 'absolute', top: y, right: x, width: 900, height: 900, borderRadius: 900, background: C.accent, opacity: 0.13, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: -300, left: -260, width: 760, height: 760, borderRadius: 760, background: '#7c3aed', opacity: 0.18, filter: 'blur(60px)' }} />
    </AbsoluteFill>
  );
}

// Palabras que entran una por una (subida + fundido con resorte).
function Palabras({ texto, size = 110, delay = 0, porPalabra = 3, color = C.text, weight = 800, family = 'Inter Tight' }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.26}px`, fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: 1.06, letterSpacing: family === 'Inter Tight' ? -3 : 0, color }}>
      {String(texto).split(/\s+/).map((w, i) => {
        const s = spring({ frame: f - delay - i * porPalabra, fps, config: { damping: 14, stiffness: 140 } });
        return <span key={i} style={{ display: 'inline-block', opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>{w}</span>;
      })}
    </div>
  );
}

function Aparece({ children, delay = 0, desde = 30 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 16 } });
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * desde}px)` }}>{children}</div>;
}

const Contenedor = ({ children, justify = 'center' }) => (
  <AbsoluteFill style={{ padding: `260px ${PAD}px 300px`, display: 'flex', flexDirection: 'column', justifyContent: justify }}>{children}</AbsoluteFill>
);

function Hook({ e }) {
  return (
    <Contenedor>
      <Palabras texto={e.texto} size={e.texto.length > 60 ? 96 : 118} />
    </Contenedor>
  );
}

function Punto({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12 } });
  return (
    <Contenedor>
      <div style={{ fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 220, color: C.accent, lineHeight: 1, transform: `scale(${0.6 + 0.4 * s})`, transformOrigin: 'left center', opacity: s }}>{e.numero}</div>
      <div style={{ height: 30 }} />
      <Palabras texto={e.titulo} size={86} delay={6} />
      <div style={{ height: 36 }} />
      <Aparece delay={18}>
        <div style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 52, lineHeight: 1.35, color: C.soft }}>{e.texto}</div>
      </Aparece>
    </Contenedor>
  );
}

function Numero({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(f, [4, fps * 1.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <Contenedor>
      <div style={{ fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 300, color: C.accent, lineHeight: 1, letterSpacing: -8 }}>
        {Math.round(e.valor * p)}{e.sufijo || ''}
      </div>
      <div style={{ height: 40 }} />
      <Palabras texto={e.texto} size={70} delay={20} porPalabra={2} weight={700} family="Inter" />
    </Contenedor>
  );
}

function Barras({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...e.items.map(i => i.valor), 1);
  return (
    <Contenedor>
      <Palabras texto={e.titulo} size={84} />
      <div style={{ height: 60 }} />
      {e.items.map((it, i) => {
        const s = spring({ frame: f - 10 - i * 7, fps, config: { damping: 18 } });
        return (
          <div key={it.label} style={{ marginBottom: 38, opacity: Math.min(1, s * 1.4) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontWeight: 700, fontSize: 50, color: C.text, marginBottom: 14 }}>
              <span>{i + 1}. {it.label}</span>
              <span style={{ color: C.soft }}>{Math.round(it.valor * s)}</span>
            </div>
            <div style={{ height: 26, borderRadius: 13, background: 'rgba(255,255,255,0.12)' }}>
              <div style={{ height: 26, borderRadius: 13, background: C.accent, width: `${(it.valor / max) * 100 * s}%` }} />
            </div>
          </div>
        );
      })}
    </Contenedor>
  );
}

function Cierre({ e }) {
  return (
    <Contenedor>
      <Palabras texto={e.texto} size={96} />
      <div style={{ height: 70 }} />
      <Aparece delay={22}>
        <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 50, color: C.accent }}>{e.link}</div>
      </Aparece>
    </Contenedor>
  );
}

const ESCENAS = { hook: Hook, punto: Punto, numero: Numero, barras: Barras, cierre: Cierre };

// Encabezado fijo (serie) + barra de progreso del reel.
function Marco({ serie }) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ padding: `120px ${PAD}px 150px`, justifyContent: 'space-between' }}>
      <div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.15)', marginBottom: 40 }}>
          <div style={{ height: 8, borderRadius: 4, background: C.accent, width: `${(f / durationInFrames) * 100}%` }} />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, padding: '14px 28px', borderRadius: 999, border: `3px solid ${C.accent}`, background: 'rgba(6,8,16,0.7)', fontFamily: 'Inter', fontWeight: 700, fontSize: 32, letterSpacing: 4, color: C.text }}>
          <span style={{ width: 16, height: 16, borderRadius: 16, background: C.accent }} />
          {String(serie || '').toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontSize: 34, color: C.soft, borderTop: '2px solid rgba(255,255,255,0.2)', paddingTop: 28 }}>
        <span>Mariano Aliandri</span>
        <span style={{ color: C.accent, fontWeight: 700 }}>marianoaliandri.com.ar</span>
      </div>
    </AbsoluteFill>
  );
}

export function Reel({ escenas, serie, musica }) {
  const transiciones = [fade(), slide({ direction: 'from-right' }), fade(), slide({ direction: 'from-bottom' })];
  return (
    <AbsoluteFill style={{ background: C.bgFrom }}>
      <Fondo />
      <TransitionSeries>
        {escenas.flatMap((e, i) => {
          const Escena = ESCENAS[e.tipo] || Hook;
          const items = [
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={Math.round(e.dur * FPS)}>
              <Escena e={e} />
              {e.audio && <Audio src={staticFile(e.audio)} />}
            </TransitionSeries.Sequence>,
          ];
          if (i < escenas.length - 1) {
            items.push(<TransitionSeries.Transition key={`t${i}`} presentation={transiciones[i % transiciones.length]} timing={linearTiming({ durationInFrames: TRANSICION })} />);
          }
          return items;
        })}
      </TransitionSeries>
      <Marco serie={serie} />
      {musica && <Audio src={musica} volume={0.07} loop />}
    </AbsoluteFill>
  );
}
