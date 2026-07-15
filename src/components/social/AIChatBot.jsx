'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CAPABILITIES } from '@/data/capabilities';

const PRESUPUESTO_URL = 'https://marianoaliandri.com.ar/presupuesto';

// Palabras clave por solución (matchea el texto libre del visitante con el catálogo)
const KEYWORDS = {
  ecommerce: ['tienda', 'vender', 'venta', 'ecommerce', 'e-commerce', 'carrito', 'comprar', 'catalogo', 'productos', 'online shop'],
  chatbot:   ['chatbot', 'bot', 'responder', 'consultas', 'atencion', 'atender', 'preguntas frecuentes', 'faq'],
  seo:       ['google', 'seo', 'aparecer', 'posicionar', 'posicionamiento', 'buscar', 'busqueda', 'ranking'],
  turnos:    ['turno', 'turnos', 'reserva', 'reservas', 'cita', 'citas', 'agenda', 'calendario'],
  social:    ['redes', 'instagram', 'facebook', 'linkedin', 'publicar', 'social', 'posteos', 'posts'],
  reels:     ['reel', 'reels', 'video', 'videos'],
  dashboard: ['dashboard', 'datos', 'power bi', 'powerbi', 'reporte', 'reportes', 'kpi', 'metricas', 'estadisticas', 'graficos'],
  webapp:    ['sistema', 'login', 'usuarios', 'portal', 'panel', 'gestion', 'crm', 'web app', 'webapp'],
  landing:   ['landing', 'pagina', 'sitio', 'web', 'pagina web'],
  leads:     ['leads', 'prospecto', 'prospectar', 'buscar clientes', 'contactos', 'base de datos de clientes'],
  pagos:     ['pago', 'pagos', 'cobrar', 'cobro', 'mercadopago', 'mercado pago'],
  mobile:    ['app', 'aplicacion', 'mobile', 'celular', 'android', 'ios', 'pwa'],
};

const KB = {
  greeting: '¡Hola! 👋 Soy el asistente de Mariano. Contame qué te gustaría lograr con tu negocio (una tienda online, aparecer en Google, automatizar tus redes…) y te digo cómo resolverlo.',
  pricing:  `Cada proyecto es a medida, así que Mariano te arma un presupuesto personalizado según lo que necesites — la primera consulta es sin cargo. 👉 [Pedí tu presupuesto acá](${PRESUPUESTO_URL}) o escribime por WhatsApp.`,
  contact:  `Podés hablar con Mariano por:\n• WhatsApp: +54 299 541-4422 (botón de arriba)\n• Email: marianoaliandri@gmail.com\n\n¿Querés que te arme un presupuesto? 👉 [Pedilo acá](${PRESUPUESTO_URL})`,
  meeting:  `Coordinemos una charla sin compromiso: tocá el botón de WhatsApp de arriba y te responde Mariano. También podés dejar tu pedido en el [presupuesto](${PRESUPUESTO_URL}) y él se contacta con vos.`,
  process:  `Es simple: 1) charlamos qué necesitás (gratis), 2) te paso un presupuesto a medida, 3) lo desarrollo mostrándote avances, 4) queda online con soporte. ¿Arrancamos? 👉 [Pedir presupuesto](${PRESUPUESTO_URL})`,
  whatDoYouDo: 'Puedo ayudarte a tener, entre otras cosas:\n• 🛒 Tienda online\n• 🔍 Aparecer en Google (SEO)\n• 🤖 Chatbot para tu negocio\n• 📅 Reservas y turnos\n• 📣 Redes en automático\n• 📊 Dashboards de datos\n\nContame qué hacés y te digo cuál te conviene 🙂',
  thanks:   `¡De nada! 🙌 Cuando quieras, pedí tu presupuesto sin cargo 👉 [acá](${PRESUPUESTO_URL}) o escribime por WhatsApp.`,
  bye:      `¡Hasta luego! 👋 Acá estoy cuando lo necesites. Y si te decidís: 👉 [Pedir presupuesto](${PRESUPUESTO_URL})`,
  fallback: `Contame un poco más y te oriento 🙂. Puedo ayudarte con tienda online, SEO para Google, chatbots, turnos, automatización de redes, dashboards y más. También podés pedir tu [presupuesto](${PRESUPUESTO_URL}) o escribir por WhatsApp.`,
};

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function matchCapabilities(input) {
  const t = normalize(input);
  const ids = [];
  for (const [id, kws] of Object.entries(KEYWORDS)) {
    if (kws.some((k) => t.includes(normalize(k)))) ids.push(id);
  }
  return ids.slice(0, 2).map((id) => CAPABILITIES.find((c) => c.id === id)).filter(Boolean);
}

// Motor de respuestas por reglas (sin IA / sin API)
function getReply(input) {
  const t = normalize(input);
  if (/(^| )(hola|buenas|buen dia|buenos dias|buenas tardes|hey)/.test(t)) return KB.greeting;
  if (/(gracias|genial|perfecto|excelente|barbaro|buenisimo)/.test(t)) return KB.thanks;
  if (/(chau|adios|nos vemos|hasta luego|bye)/.test(t)) return KB.bye;
  if (/(precio|costo|cuanto|cotiz|presupuesto|tarifa|vale|sale)/.test(t)) return KB.pricing;
  if (/(contacto|telefono|email|mail|whatsapp|llamar|comunicar)/.test(t)) return KB.contact;
  if (/(reunion|cita|agendar|meeting|horario|disponibilidad|charla|reunirnos)/.test(t)) return KB.meeting;
  if (/(proceso|como trabaj|metodolog|pasos|tiempo|cuanto tarda|demora|plazo)/.test(t)) return KB.process;
  if (/(que podes|que haces|que ofreces|que hacen|servicios|opciones|ayuda)/.test(t)) return KB.whatDoYouDo;

  const caps = matchCapabilities(input);
  if (caps.length) {
    const body = caps.map((c) => `${c.emoji} ${c.title} — ${c.desc} ${c.benefit}`).join('\n\n');
    return `${body}\n\n¿Lo cotizamos sin cargo? 👉 [Pedir presupuesto](${PRESUPUESTO_URL}) o escribime por WhatsApp con el botón de arriba.`;
  }
  return KB.fallback;
}

function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef(null);

  const quickReplies = [
    { text: '¿Qué podés hacer?' },
    { text: 'Quiero vender online' },
    { text: 'Aparecer en Google' },
    { text: 'Automatizar mis redes' },
    { text: 'Precios' },
    { text: 'Contacto' },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setTimeout(() => addBotMessage(KB.greeting), 400);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addBotMessage = (text) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), text, isBot: true, timestamp: new Date() }]);
  };

  const addUserMessage = (text) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), text, isBot: false, timestamp: new Date() }]);
  };

  const simulateTyping = (duration = 700) => {
    setIsTyping(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        setIsTyping(false);
        resolve();
      }, duration);
    });
  };

  const handleSendMessage = async (message = inputValue) => {
    if (!message.trim()) return;
    addUserMessage(message);
    setInputValue('');
    setShowQuickReplies(false);
    await simulateTyping(700);
    addBotMessage(getReply(message));
  };

  const handleQuickReply = (reply) => handleSendMessage(reply.text);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const openCalendar = () => {
    window.open('https://calendly.com/marianoaliandri', '_blank');
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent('Hola Mariano! Vengo del chat de tu web y quiero mejorar la presencia digital de mi negocio.');
    window.open(`https://wa.me/5492995414422?text=${message}`, '_blank');
  };

  const closeChat = () => setIsOpen(false);

  const renderMessageWithLinks = (text, isBot) => {
    const linkClass = isBot
      ? 'text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-semibold'
      : 'text-blue-100 underline hover:text-white font-semibold';
    let processedText = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      `<a href="$2" target="_blank" rel="noopener noreferrer" class="${linkClass}">$1</a>`
    );
    processedText = processedText.replace(
      /(^|[^"(])(https?:\/\/[^\s]+)/g,
      `$1<a href="$2" target="_blank" rel="noopener noreferrer" class="${linkClass}">$2</a>`
    );
    return processedText;
  };

  return (
    <>
      {/* Botón del chat - Header version */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-12 h-12 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
          isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
          {isOpen ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </motion.div>

        {!isOpen && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 3 }}
          />
        )}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed top-20 right-6 z-[65] w-96 h-[500px] max-h-[calc(100vh-10rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Asistente</h3>
                <p className="text-xs text-blue-100">{isTyping ? 'Escribiendo…' : 'En línea • Responde al instante'}</p>
              </div>
              <div className="flex gap-2">
                <motion.button onClick={openWhatsApp} className="p-2.5 bg-white/30 rounded-lg hover:bg-white/40 transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="WhatsApp">
                  <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.106" />
                  </svg>
                </motion.button>
                <motion.button onClick={closeChat} className="p-2.5 bg-white/30 rounded-lg hover:bg-red-500 hover:bg-opacity-100 transition-all duration-200" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Cerrar chat">
                  <svg className="w-5 h-5" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={`max-w-[80%] p-3 rounded-2xl ${message.isBot ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'bg-blue-600 text-white'}`}>
                    <div className="text-sm whitespace-pre-line" dangerouslySetInnerHTML={{ __html: renderMessageWithLinks(message.text, message.isBot) }} />
                    <span className={`text-xs mt-1 block ${message.isBot ? 'text-gray-500 dark:text-gray-400' : 'text-blue-100'}`}>
                      {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </motion.div>
              )}

              {showQuickReplies && messages.length <= 1 && (
                <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Elegí una opción o escribí:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickReplies.map((reply, index) => (
                      <motion.button
                        key={reply.text}
                        onClick={() => handleQuickReply(reply)}
                        className="p-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + index * 0.08 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {reply.text}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribí tu mensaje…"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  disabled={isTyping}
                />
                <motion.button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: inputValue.trim() && !isTyping ? 1.05 : 1 }}
                  whileTap={{ scale: inputValue.trim() && !isTyping ? 0.95 : 1 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </motion.button>
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Enter para enviar</p>
                <motion.button
                  onClick={closeChat}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cerrar
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default AIChatBot;
