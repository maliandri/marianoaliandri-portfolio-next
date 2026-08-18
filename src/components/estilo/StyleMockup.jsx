'use client';

// Mini mockup de un hero de sitio, renderizado solo con divs + el theme del estilo.
// No es un screenshot real: es una representación abstracta para comparar paletas/tipografía.
export default function StyleMockup({ theme }) {
  return (
    <div
      className={`overflow-hidden border ${theme.radius === 'rounded-none' ? '' : 'rounded-xl'}`}
      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
    >
      {/* Barra de navegación simulada */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: theme.navBg }}
      >
        <div className={`h-2 w-2 ${theme.radius}`} style={{ backgroundColor: theme.navText, opacity: 0.6 }} />
        <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: theme.navText, opacity: 0.4 }} />
        <div className="ml-auto flex gap-1.5">
          <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: theme.navText, opacity: 0.3 }} />
          <div className="h-1.5 w-6 rounded-full" style={{ backgroundColor: theme.navText, opacity: 0.3 }} />
        </div>
      </div>

      {/* Hero simulado */}
      <div className="px-5 py-7 flex flex-col items-start gap-3">
        <div
          className={`h-4 w-3/4 ${theme.radius} ${theme.font} ${theme.weight}`}
          style={{ backgroundColor: theme.heading, opacity: 0.9 }}
        />
        <div className={`h-2.5 w-1/2 ${theme.radius}`} style={{ backgroundColor: theme.body, opacity: 0.7 }} />
        <div className={`h-2.5 w-2/5 ${theme.radius}`} style={{ backgroundColor: theme.body, opacity: 0.5 }} />
        <div
          className={`mt-3 h-7 w-24 ${theme.radius} flex items-center justify-center text-[9px] font-semibold`}
          style={{ background: theme.accent, color: theme.accentText }}
        >
          Empezar
        </div>
      </div>
    </div>
  );
}
