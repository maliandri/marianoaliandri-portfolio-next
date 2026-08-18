'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import StyleMockup from './StyleMockup';
import { STYLE_OPTIONS, SITE_FEATURES } from '@/data/styleOptions';

function StyleCard({ style, liked, comment, onToggle, onCommentChange }) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-colors cursor-pointer ${
        liked ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/10 bg-[#111] hover:border-white/20'
      }`}
      onClick={() => onToggle(style.id)}
    >
      <StyleMockup theme={style.theme} />
      <div className="mt-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{style.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{style.tagline}</p>
        </div>
        <div
          className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-colors ${
            liked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/20 text-transparent'
          }`}
        >
          ✓
        </div>
      </div>

      {liked && (
        <div onClick={e => e.stopPropagation()} className="mt-3">
          <input
            type="text"
            value={comment}
            onChange={e => onCommentChange(style.id, e.target.value)}
            placeholder="¿Qué te gustó de este estilo? (opcional)"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}
    </div>
  );
}

export default function StyleQuizForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [liked, setLiked] = useState({});     // { [styleId]: true }
  const [comments, setComments] = useState({}); // { [styleId]: string }
  const [features, setFeatures] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const toggleStyle = id => setLiked(prev => ({ ...prev, [id]: !prev[id] }));
  const setStyleComment = (id, value) => setComments(prev => ({ ...prev, [id]: value }));
  const toggleFeature = id =>
    setFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Contanos tu nombre');
    if (!email.trim() && !phone.trim()) return setError('Dejanos un email o teléfono para avisarte');

    const likedStyles = STYLE_OPTIONS
      .filter(s => liked[s.id])
      .map(s => ({ id: s.id, name: s.name, comment: comments[s.id] || '' }));

    setSubmitting(true);
    try {
      const res = await fetch('/api/style-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          likedStyles,
          features: features.map(id => SITE_FEATURES.find(f => f.id === id)?.label).filter(Boolean),
          comment: comment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto text-center bg-[#111] border border-white/10 rounded-2xl p-10"
      >
        <p className="text-4xl mb-4">🎨</p>
        <h2 className="text-xl font-bold text-white mb-2">¡Gracias, {name.split(' ')[0]}!</h2>
        <p className="text-gray-400 text-sm mb-6">
          Recibí tus preferencias. Las voy a tener en cuenta para la propuesta de diseño de tu sitio.
        </p>
        <a
          href="https://wa.me/5492995414422"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          Hablar por WhatsApp
        </a>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Datos de contacto */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
        <p className="text-sm font-semibold text-white mb-4">Tus datos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre *"
            className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="WhatsApp"
            className="px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Estilos */}
      <div>
        <p className="text-sm font-semibold text-white mb-1">¿Qué estilos te gustan?</p>
        <p className="text-xs text-gray-500 mb-4">Marcá los que te llamen la atención (podés elegir más de uno).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STYLE_OPTIONS.map(style => (
            <StyleCard
              key={style.id}
              style={style}
              liked={!!liked[style.id]}
              comment={comments[style.id] || ''}
              onToggle={toggleStyle}
              onCommentChange={setStyleComment}
            />
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
        <p className="text-sm font-semibold text-white mb-1">¿Qué es importante para tu sitio?</p>
        <p className="text-xs text-gray-500 mb-4">Elegí todas las que apliquen (opcional).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SITE_FEATURES.map(f => (
            <label
              key={f.id}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm ${
                features.includes(f.id)
                  ? 'border-indigo-500 bg-indigo-500/5 text-white'
                  : 'border-white/10 text-gray-400 hover:border-white/20'
              }`}
            >
              <input
                type="checkbox"
                checked={features.includes(f.id)}
                onChange={() => toggleFeature(f.id)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              {f.label}
            </label>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder="Algo más que quieras contarme sobre cómo imaginás tu sitio (opcional)"
          className="mt-4 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      <div className="text-center">
        <button
          type="submit"
          disabled={submitting}
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
        >
          {submitting ? 'Enviando...' : 'Enviar mis preferencias'}
        </button>
      </div>
    </form>
  );
}
