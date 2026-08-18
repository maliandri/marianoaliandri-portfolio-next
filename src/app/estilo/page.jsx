import StyleQuizForm from '@/components/estilo/StyleQuizForm';

export const metadata = {
  title: 'Test de estilo visual',
  description: 'Elegí el estilo visual que más te gusta para tu sitio web. Un test rápido para definir el diseño de tu proyecto.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/estilo' },
  robots: { index: false, follow: false },
};

export default function EstiloPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-4">
            2 minutos
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ¿Cómo te imaginás tu sitio?
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Elegí los estilos que más te gustan. No hay respuestas correctas — esto me ayuda
            a diseñar algo que realmente te represente.
          </p>
        </div>

        <StyleQuizForm />
      </div>
    </main>
  );
}
