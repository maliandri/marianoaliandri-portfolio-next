'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ClientAreaShell from '@/components/ClientAreaShell';
import { useAuthUser } from '@/hooks/useAuthUser';
import { formatARS } from '@/utils/exchangeService';

const STAGES = [
  { id: 'pago_confirmado', label: 'Pago confirmado' },
  { id: 'en_desarrollo', label: 'En desarrollo' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'entregado', label: 'Entregado' },
];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function OrderDetailContent() {
  const { user, loading: authLoading, getIdToken } = useAuthUser();
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(undefined); // undefined = cargando, null = error/404/403
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setOrder(null); return; }
    (async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/orders/${params.orderId}/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo cargar el pedido');
        setOrder(null);
        return;
      }
      setOrder(data);
    })();
  }, [authLoading, user, params.orderId, getIdToken]);

  if (authLoading || order === undefined) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return <p className="text-center py-16 text-gray-400">Necesitás iniciar sesión para ver este pedido.</p>;
  }

  if (order === null) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">{errorMsg || 'No se encontró el pedido'}</p>
        <button onClick={() => router.push('/mis-compras')} className="text-indigo-400 hover:underline text-sm">← Volver a mis compras</button>
      </div>
    );
  }

  const currentIdx = STAGES.findIndex(s => s.id === order.stage);

  return (
    <div className="max-w-3xl mx-auto px-4">
      <Link href="/mis-compras" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Mis compras</Link>
      <h1 className="text-2xl font-black text-white mt-2 mb-1">Pedido #{order.id.slice(-12)}</h1>
      <p className="text-gray-500 text-sm mb-8">{formatDate(order.createdAt)}</p>

      {order.type === 'store' && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">Proceso del proyecto</p>
          <div className="space-y-4">
            {STAGES.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <div key={s.id} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] mt-0.5 ${done ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                    {done ? '✓' : ''}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-white' : 'text-gray-500'}`}>{s.label}</p>
                    {order.stageHistory.filter(h => h.stage === s.id).map((h, idx) => (
                      <div key={idx} className="text-xs text-gray-500 mt-0.5">
                        {formatDate(h.at)}{h.note && <> — {h.note}</>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">Detalle</p>
        <div className="space-y-2 mb-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-300">{item.quantity}× {item.name}</span>
              <span className="text-gray-400">{formatARS(item.priceARS || 0)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-white/10 pt-3">
          <span className="text-sm font-semibold text-white">Total</span>
          <span className="text-sm font-bold text-white">{formatARS(order.totalARS)}</span>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <ClientAreaShell>
      <main className="min-h-screen bg-[#0a0a0a] pt-10 pb-20">
        <OrderDetailContent />
      </main>
    </ClientAreaShell>
  );
}
