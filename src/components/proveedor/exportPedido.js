import * as XLSX from 'xlsx';

// Exporta un pedido a .xlsx: un renglón por producto + talle, subtotal con fórmula y fila TOTAL.
export function exportarPedidoExcel(renglones, nombre = '') {
  const encabezado = ['Código', 'Producto', 'Talle', 'Color', 'Cantidad', 'Precio por mayor', 'Subtotal'];
  const filas = renglones.map((r, i) => {
    const n = i + 2;
    return [
      r.codigo || '',
      r.titulo,
      r.talle || '',
      r.color || '',
      r.cantidad,
      r.precioMayor,
      { f: `E${n}*F${n}`, v: r.cantidad * r.precioMayor, t: 'n' },
    ];
  });
  const ultima = renglones.length + 1;
  const total = renglones.reduce((s, r) => s + r.cantidad * r.precioMayor, 0);
  const unidades = renglones.reduce((s, r) => s + r.cantidad, 0);
  filas.push([
    '', 'TOTAL', '', '',
    { f: `SUM(E2:E${ultima})`, v: unidades, t: 'n' },
    '',
    { f: `SUM(G2:G${ultima})`, v: total, t: 'n' },
  ]);

  const ws = XLSX.utils.aoa_to_sheet([encabezado, ...filas]);
  ws['!cols'] = [{ wch: 12 }, { wch: 48 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
  const fmt = '"$"#,##0.00';
  for (let row = 2; row <= ultima + 1; row++) {
    for (const col of ['F', 'G']) {
      if (ws[`${col}${row}`]) ws[`${col}${row}`].z = fmt;
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  const fecha = new Date().toISOString().slice(0, 10);
  const sufijo = nombre ? `-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
  XLSX.writeFile(wb, `pedido-moodfit-${fecha}${sufijo}.xlsx`);
}
