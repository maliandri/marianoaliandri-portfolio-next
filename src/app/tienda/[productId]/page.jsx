import { permanentRedirect } from 'next/navigation';
import { PRODUCTOS_VIEJOS } from '@/lib/tienda';

// Los productos viejos de la tienda pasaron a ser servicios del catálogo: cada link viejo (indexado en
// Google) lleva a la tienda nueva con los servicios equivalentes ya marcados.
export default async function ProductoViejo({ params }) {
  const { productId } = await params;
  const ids = PRODUCTOS_VIEJOS[productId];
  permanentRedirect(ids ? `/tienda/?servicios=${ids.join(',')}` : '/tienda/');
}
