// Nivel 3: índice siempre visible debajo del título (nunca un menú escondido).
export default function SubTabs({ label, items, activeId, onSelect }) {
  if (!items?.length) return null;
  return (
    <div className="sh-subnav" role="tablist" aria-label={label}>
      {label && <span className="sh-subnav-lbl">{label}</span>}
      {items.map(c => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={c.id === activeId}
          onClick={() => onSelect(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
