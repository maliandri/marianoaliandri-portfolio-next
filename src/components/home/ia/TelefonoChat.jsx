'use client';

// iPhone con la app de Claude y una conversación real de un negocio de obras que se puede scrollear adentro de la
// pantalla (venta del home de IA, 2026-11-25). Datos ficticios. Las acciones (mandar el aviso) esperan el OK del
// dueño: es lo que se vende.

function Burbuja({ yo, children }) {
  return (
    <div className={`max-w-[85%] rounded-[18px] px-3 py-2 text-[13px] leading-snug ${yo ? 'self-end bg-[#4c01f9] text-white rounded-br-[6px]' : 'self-start bg-[#26262b] text-neutral-100 rounded-bl-[6px]'}`}>
      {children}
    </div>
  );
}

function Herramienta({ nombre }) {
  return (
    <span className="self-start inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-[family-name:var(--font-ia-mono)] text-[10px] text-indigo-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> consultó {nombre}
    </span>
  );
}

function Tabla({ filas }) {
  return (
    <div className="self-start w-[92%] rounded-xl border border-white/10 bg-[#1b1b20] overflow-hidden font-[family-name:var(--font-ia-mono)] text-[10.5px]">
      {filas.map((f, i) => (
        <div key={i} className={`grid grid-cols-[1.4fr_1fr_0.7fr] gap-2 px-2.5 py-1.5 ${i === 0 ? 'text-neutral-500 border-b border-white/10' : 'text-neutral-200'}`}>
          {f.map((c, j) => <span key={j} className="truncate">{c}</span>)}
        </div>
      ))}
    </div>
  );
}

export default function TelefonoChat({ className = '' }) {
  return (
    <div className={`relative w-[300px] h-[610px] rounded-[3.2rem] bg-neutral-950 p-[11px] shadow-[0_50px_100px_-25px_rgba(0,0,0,0.65),inset_0_0_0_2px_#3f3f46] ${className}`}>
      {/* botones laterales */}
      <span aria-hidden className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l bg-neutral-700" />
      <span aria-hidden className="absolute -left-[3px] top-40 h-14 w-[3px] rounded-l bg-neutral-700" />
      <span aria-hidden className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-neutral-700" />

      <div className="relative h-full w-full rounded-[2.5rem] bg-[#111114] overflow-hidden flex flex-col">
        {/* barra de estado + isla dinámica */}
        <div className="relative h-11 shrink-0 flex items-center justify-between px-7 text-[12px] font-semibold text-white">
          <span>9:41</span>
          <span aria-hidden className="absolute left-1/2 top-2.5 -translate-x-1/2 h-[26px] w-[92px] rounded-full bg-black" />
          <span className="flex items-center gap-1" aria-hidden>
            <span className="text-[10px]">5G</span>
            <span className="h-[10px] w-[20px] rounded-[3px] border border-white/70 p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-white" /></span>
          </span>
        </div>

        {/* encabezado de la app */}
        <div className="shrink-0 flex items-center gap-2 px-4 pb-2 border-b border-white/5">
          <span className="h-7 w-7 rounded-full bg-[#d97757] grid place-items-center text-[13px] text-white" aria-hidden>✳</span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-white">Claude</p>
            <p className="text-[10px] text-emerald-400">conectado a tu sistema</p>
          </div>
        </div>

        {/* conversación: se scrollea adentro del celular */}
        <div tabIndex={0} aria-label="Conversación de ejemplo (deslizá para leer)" style={{ scrollbarWidth: 'none' }}
          className="telefono-chat flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 flex flex-col gap-2 [&>*]:shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-500">
          <p className="self-center text-[10px] text-neutral-500 mb-1">Hoy 8:12</p>
          <Burbuja yo>¿Qué obras vienen atrasadas?</Burbuja>
          <Herramienta nombre="obras_atrasadas()" />
          <Tabla filas={[['Obra', 'Etapa', 'Atraso'], ['Casa Fernández', 'Techo', '6 días'], ['Galpón Ruta 7', 'Platea', '3 días'], ['Local Av. Argentina', 'Terminac.', '2 días']]} />
          <Burbuja>Tres vienen atrasadas. La que más preocupa es <b>Casa Fernández</b>: el techo lleva 6 días y el cliente preguntó el lunes. ¿Le aviso la nueva fecha?</Burbuja>
          <Burbuja yo>Sí, decile que terminamos el viernes</Burbuja>
          <div className="self-start w-[88%] rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-2.5 text-[12px] text-neutral-100">
            <p className="text-[10px] uppercase tracking-wider text-indigo-300 mb-1">Borrador · WhatsApp a Fernández</p>
            <p>Hola Carlos, te cuento que el techo queda terminado el viernes. Cualquier duda me escribís. Saludos.</p>
            <div className="flex gap-1.5 mt-2">
              <span className="rounded-full bg-[#4c01f9] px-2.5 py-1 text-[11px] font-semibold text-white">Enviar</span>
              <span className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-neutral-300">Editar</span>
            </div>
          </div>
          <Burbuja yo>Dale, mandalo</Burbuja>
          <Burbuja>✓ Listo, se lo mandé a Carlos Fernández. Quedó anotado en la obra.</Burbuja>
          <Burbuja yo>¿Alcanza el material para el galpón?</Burbuja>
          <Herramienta nombre="alcanza_material()" />
          <Tabla filas={[['Material', 'Hay', 'Falta'], ['Cemento', '40 bolsas', '—'], ['Hierro 8', '60 barras', '25'], ['Arena', '6 m³', '—']]} />
          <Burbuja>Te faltan <b>25 barras de hierro del 8</b>. ¿Te armo el pedido al corralón de siempre?</Burbuja>
          <Burbuja yo>Sí, armalo y después lo reviso</Burbuja>
          <Burbuja>Te lo dejé listo para revisar. No sale nada sin tu OK 👌</Burbuja>
          <p className="self-center text-[10px] text-neutral-500 mt-1">Ejemplo con datos ficticios</p>
        </div>

        {/* barra para escribir + indicador de inicio */}
        <div className="shrink-0 px-3 pt-2 pb-5">
          <div className="flex items-center gap-2 rounded-full bg-[#26262b] px-3 py-2">
            <span className="flex-1 text-[12px] text-neutral-500">Preguntale a tu negocio…</span>
            <span className="h-6 w-6 rounded-full bg-[#4c01f9] grid place-items-center text-white text-[11px]" aria-hidden>↑</span>
          </div>
          <span aria-hidden className="mx-auto mt-3 block h-1 w-28 rounded-full bg-white/40" />
        </div>
      </div>
    </div>
  );
}
