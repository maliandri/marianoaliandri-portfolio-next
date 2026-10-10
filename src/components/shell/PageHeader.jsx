import { Fragment } from 'react';
import AdminIcon from '../admin/AdminIcon';

// Encabezado de pantalla: migas (sección / ficha / sub-ficha), ícono, título y acciones.
export default function PageHeader({ crumbs = [], iconId, title, subtitle, actions }) {
  return (
    <>
      {crumbs.length > 0 && (
        <div className="sh-crumb">
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span>/</span>}
              {c}
            </Fragment>
          ))}
        </div>
      )}
      <div className="sh-ph">
        <div className="sh-ph-l">
          {iconId && <div className="sh-ph-ic"><AdminIcon id={iconId} fallback="•" size={20} /></div>}
          <div className="min-w-0">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="sh-ph-r">{actions}</div>}
      </div>
    </>
  );
}
