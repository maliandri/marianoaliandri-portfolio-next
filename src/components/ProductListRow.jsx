'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { formatARS } from '../utils/exchangeService';

const CAT_LABEL = {
  'web-development': 'Desarrollo Web',
  'consulting': 'Consultoría',
  'data-analytics': 'Data Analytics',
  'store': 'Servicio',
  'custom': 'Personalizado',
};
const COVER_EMOJI = {
  'consulting': '📈', 'web-development': '🌐', 'data-analytics': '📊', 'store': '🛒', 'custom': '✨',
};

// Fila compacta de la tienda (vista lista). Muestra thumbnail, nombre,
// categoría, precio en pesos y acciones.
export default function ProductListRow({ product, fxRate, rentMode = false, rental = null }) {
  const router = useRouter();
  const { addToCart } = useCart();

  const isCustom = product.priceUSD === null || product.priceUSD === undefined;
  const hasRental = !isCustom && !!rental;
  const showRental = rentMode && hasRental;

  const priceARS = isCustom ? null : (fxRate ? Math.ceil(product.priceUSD * fxRate) : (product.priceARS || null));
  const senaARS = showRental && fxRate ? Math.ceil((rental?.seña ?? 0) * fxRate) : null;

  const go = () => router.push(`/tienda/${product.id}`);

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Thumbnail */}
      <td className="px-4 py-2">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 flex items-center justify-center cursor-pointer" onClick={go}>
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="text-xl">{COVER_EMOJI[product.category] || '🚀'}</span>
          )}
        </div>
      </td>

      {/* Nombre + descripción corta */}
      <td className="px-4 py-2">
        <button onClick={go} className="text-left">
          <span className="block font-semibold text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400">
            {product.name}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-md">
            {product.shortDescription}
          </span>
        </button>
      </td>

      {/* Categoría */}
      <td className="px-4 py-2 hidden sm:table-cell">
        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">
          {CAT_LABEL[product.category] || product.category || 'Servicio'}
        </span>
      </td>

      {/* Precio */}
      <td className="px-4 py-2 text-right whitespace-nowrap">
        {isCustom ? (
          <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">A cotizar</span>
        ) : showRental ? (
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {senaARS ? `Seña ${formatARS(senaARS)}` : `Seña USD ${rental?.seña ?? 0}`}
          </span>
        ) : (
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {priceARS ? formatARS(priceARS) : '—'}
          </span>
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={go}
            className="px-3 py-1.5 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-xs font-semibold"
          >
            Ver
          </button>
          {!isCustom && !showRental && (
            <button
              onClick={() => addToCart(product)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-xs font-semibold"
            >
              Agregar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
