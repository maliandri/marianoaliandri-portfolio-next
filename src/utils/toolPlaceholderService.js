// Genera una tarjeta placeholder (degradado + emoji grande) como data URL para
// representar una "Herramienta" en el generador de reels — las herramientas del
// sitio (TOOLS en providers.jsx) no tienen screenshot propio hoy. Es un default
// pragmático: se puede reemplazar más adelante por un screenshot real (Microlink,
// como ya se usa en ProyectosGrid) sin tocar el resto del pipeline, porque el
// resultado es simplemente una URL de imagen más.

const PALETTES = [
  ['#8b5cf6', '#ec4899'],
  ['#0ea5e9', '#9333ea'],
  ['#facc15', '#fb923c'],
  ['#14b8a6', '#00bfff'],
  ['#a855f7', '#22d3ee'],
];

export function getToolPlaceholderDataUrl(tool, index = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const [c1, c2] = PALETTES[index % PALETTES.length];

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '360px sans-serif';
  ctx.fillText(tool.icon || '🔧', canvas.width / 2, canvas.height * 0.42);

  ctx.font = '700 56px Montserrat, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 10;
  ctx.fillText(tool.label || 'Herramienta', canvas.width / 2, canvas.height * 0.78);

  return canvas.toDataURL('image/png');
}
