import BudgetForm from '@/components/BudgetForm';

export const metadata = {
  title: 'Pedir presupuesto',
  description: 'Solicitá un presupuesto personalizado. Elegí los servicios que necesitás y te respondo en menos de 24 horas.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/presupuesto' },
  openGraph: {
    title: 'Pedir presupuesto | Mariano Aliandri',
    description: 'Solicitá un presupuesto personalizado para tu proyecto web.',
    url: 'https://marianoaliandri.com.ar/presupuesto',
  },
};

export default function PresupuestoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-4">
            Sin compromiso
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Pedí tu presupuesto
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Elegí los servicios que necesitás y te respondo con un presupuesto detallado en menos de 24 horas.
          </p>
        </div>

        <BudgetForm />
      </div>
    </main>
  );
}
