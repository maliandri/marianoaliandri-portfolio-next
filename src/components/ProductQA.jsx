'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { firebaseAuth, firebaseQA } from '../utils/firebaseservice';

function isAdminSession() {
  return sessionStorage.getItem('adminAuth') === 'true';
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'hace 1 dia';
  if (days < 30) return `hace ${days} dias`;
  return date.toLocaleDateString('es-AR');
}

export default function ProductQA({ productId, productName }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  const [isAdmin, setIsAdmin] = useState(isAdminSession());

  // Detectar cambios en la sesion admin
  useEffect(() => {
    const checkAdmin = () => setIsAdmin(isAdminSession());
    checkAdmin();
    window.addEventListener('storage', checkAdmin);
    return () => window.removeEventListener('storage', checkAdmin);
  }, []);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthChange((userData) => {
      setUser(userData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [productId]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await firebaseQA.getQuestionsByProduct(productId);
      setQuestions(data);
    } catch (err) {
      console.error('Error cargando preguntas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!user) return;
    const text = newQuestion.trim();
    if (text.length < 10) {
      setError('La pregunta debe tener al menos 10 caracteres');
      return;
    }
    if (text.length > 500) {
      setError('La pregunta no puede superar los 500 caracteres');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await firebaseQA.submitQuestion(productId, productName, text, user);
      setNewQuestion('');
      await loadQuestions();
    } catch (err) {
      setError('Error al enviar la pregunta. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAnswer = async (questionId) => {
    if (!isAdmin || !answerText.trim()) return;
    setAnswerSubmitting(true);
    try {
      await firebaseQA.answerQuestion(questionId, answerText.trim());
      setAnsweringId(null);
      setAnswerText('');
      await loadQuestions();
    } catch (err) {
      console.error('Error respondiendo pregunta:', err);
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const handleHideQuestion = async (questionId) => {
    if (!isAdmin) return;
    try {
      await firebaseQA.hideQuestion(questionId);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      console.error('Error ocultando pregunta:', err);
    }
  };

  const handleLogin = async () => {
    try {
      await firebaseAuth.loginWithGoogle();
    } catch (err) {
      console.error('Error al iniciar sesion:', err);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-6">
        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Preguntas y Respuestas
        </h2>
        {questions.length > 0 && (
          <span className="text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
            {questions.length}
          </span>
        )}
      </div>

      {/* Formulario de pregunta */}
      {user ? (
        <form onSubmit={handleSubmitQuestion} className="mb-6">
          <div className="flex items-start gap-3">
            {user.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full mt-1" referrerPolicy="no-referrer" />
            )}
            <div className="flex-1">
              <textarea
                value={newQuestion}
                onChange={(e) => { setNewQuestion(e.target.value); setError(''); }}
                placeholder="Escribi tu pregunta sobre este producto..."
                maxLength={500}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <p className="text-xs text-gray-400">{newQuestion.length}/500</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting || newQuestion.trim().length < 10}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  Enviar Pregunta
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Inicia sesion para hacer una pregunta sobre este producto
          </p>
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2 mx-auto"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Iniciar sesion con Google
          </button>
        </div>
      )}

      {/* Lista de preguntas */}
      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando preguntas...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            Todavia no hay preguntas. Se el primero en preguntar!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {questions.map((q, index) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4"
              >
                {/* Pregunta */}
                <div className="flex items-start gap-3">
                  {q.questionAuthorPhoto ? (
                    <img src={q.questionAuthorPhoto} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-sm font-bold text-purple-700 dark:text-purple-300">
                      {(q.questionAuthorName || '?')[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {q.questionAuthorName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {timeAgo(q.createdAt)}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleHideQuestion(q.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            title="Ocultar pregunta"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">{q.questionText}</p>
                  </div>
                </div>

                {/* Respuesta */}
                {q.answerText ? (
                  <div className="mt-3 ml-11 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 rounded-r-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {q.answeredBy || 'Mariano Aliandri'}
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(q.answeredAt)}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{q.answerText}</p>
                  </div>
                ) : isAdmin ? (
                  <div className="mt-3 ml-11">
                    {answeringId === q.id ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Escribi tu respuesta..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmitAnswer(q.id)}
                            disabled={answerSubmitting || !answerText.trim()}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                          >
                            {answerSubmitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            Publicar Respuesta
                          </button>
                          <button
                            onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                            className="px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <button
                        onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}
                        className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium"
                      >
                        Responder
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 ml-11 text-xs text-gray-400 italic">Pendiente de respuesta</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
