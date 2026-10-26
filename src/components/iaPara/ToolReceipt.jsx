import s from './iaPara.module.css';

// Comprobante de una llamada a una herramienta: qué consultó la IA en el sistema del negocio y
// qué propone después. `delay` escalona la animación de impresión renglón por renglón.
export default function ToolReceipt({ nicho }) {
  const { herramienta, respuesta } = nicho;
  let i = 0;
  const step = () => ({ animationDelay: `${150 + 110 * i++}ms` });

  return (
    <figure className="w-full">
      <div className={`${s.receipt} ${s.mono} text-[13px] text-fg-200 shadow-[0_20px_60px_-30px_var(--t-glow)]`}>
        <div className={`${s.line} flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-dashed border-fg-600/40`} style={step()}>
          <span className="text-fg-500 whitespace-nowrap">la IA usó</span>
          <span className="font-semibold text-[#4c01f9] dark:text-[#a78bfa] truncate">{herramienta}()</span>
          <span className="hidden sm:inline text-fg-500 whitespace-nowrap">tu sistema</span>
        </div>

        <div className="px-4 pt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={s.line} style={step()}>
                {respuesta.columnas.map(c => (
                  <th key={c} scope="col" className="pb-2 pr-3 font-normal text-fg-500 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {respuesta.filas.map(fila => (
                <tr key={fila[0]} className={`${s.line} border-t border-fg-600/20`} style={step()}>
                  {fila.map((v, j) => (
                    <td key={j} className={`py-2 pr-3 whitespace-nowrap ${j === 0 ? 'font-semibold text-fg' : ''}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={`${s.line} px-4 pt-3 text-[11px] uppercase tracking-wider text-fg-500`} style={step()}>
          Ejemplo con datos ficticios
        </p>
      </div>

      <figcaption className={`${s.line} mt-4 flex gap-3 items-start`} style={step()}>
        <span aria-hidden="true" className="mt-0.5 flex-none w-7 h-7 rounded-full bg-fg text-page text-xs font-bold grid place-items-center">IA</span>
        <p className="text-[15px] leading-relaxed text-fg-200">{respuesta.cierre}</p>
      </figcaption>
    </figure>
  );
}
