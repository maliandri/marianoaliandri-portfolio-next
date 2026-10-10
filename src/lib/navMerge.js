// Ids de un árbol de navegación: items ("id") y sub-items ("parent/child").
export function allNavIds(sections) {
  const out = new Set();
  for (const s of sections || []) {
    for (const item of s.items || []) {
      out.add(item.id);
      for (const c of item.children || []) out.add(`${item.id}/${c.id}`);
    }
  }
  return out;
}

const clone = v => JSON.parse(JSON.stringify(v));

// Mezcla la config guardada (nav_config) con el default del código.
// knownIds = ids que existían en el código al guardar: solo se agregan los que
// aparecieron después, así lo que el usuario quitó a mano no vuelve.
export function mergeNavWithDefaults(saved, defaults, knownIds) {
  if (!Array.isArray(saved) || !saved.length) return null;

  const known = new Set(knownIds || []);
  const defaultItemIds = new Set(defaults.flatMap(s => s.items.map(i => i.id)));

  const sections = clone(saved)
    .map(s => ({ ...s, items: (s.items || []).filter(i => defaultItemIds.has(i.id)) }));

  const present = allNavIds(sections);

  for (const defSection of defaults) {
    for (const defItem of defSection.items) {
      if (!present.has(defItem.id)) {
        if (known.has(defItem.id)) continue;
        let target = sections.find(s => s.id === defSection.id);
        if (!target) {
          target = { ...clone(defSection), items: [] };
          sections.push(target);
        }
        target.items.push(clone(defItem));
        continue;
      }

      if (!defItem.children?.length) continue;
      for (const s of sections) {
        const item = s.items.find(i => i.id === defItem.id);
        if (!item) continue;
        for (const defChild of defItem.children) {
          const key = `${defItem.id}/${defChild.id}`;
          if (present.has(key) || known.has(key)) continue;
          item.children = [...(item.children || []), clone(defChild)];
        }
      }
    }
  }

  const result = sections.filter(s => s.items.length > 0);
  return result.length ? result : null;
}
