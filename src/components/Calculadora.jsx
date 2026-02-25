'use client';

// src/components/Calculadora.jsx
// ✨ VERSIÓN ADAPTADA PARA BADGE CENTRAL
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailService } from '../utils/emailService';
import { ExchangeService, formatUSD, formatARS } from '../utils/exchangeService';
import { createPaymentPreference } from '../utils/mercadoPagoConfig';

function ROICalculator({ isOpen: isOpenProp, onClose: onCloseProp, hideFloatingButton = false }) {
  const emailService = new EmailService();
  const fxService = new ExchangeService();

  // 🔄 Estado híbrido: controlado por padre O interno
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    company: '',
    email: '',
    phone: '',
    sector: '',
    employees: '',
    monthlyRevenue: '',
    currentDataTools: '',
    dataProcessingHours: '',
    decisionMakingTime: '',
    reportGenerationTime: ''
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ loading: false, sent: false, error: null });
  const [fx, setFx] = useState({ rate: null, source: null, loading: false, error: null });
  const [emailValidation, setEmailValidation] = useState({
    isValid: false,
    message: '',
    touched: false
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!email) return { isValid: false, message: '' };
    if (!emailRegex.test(email)) return { isValid: false, message: 'Formato de email inválido' };
    if (email.length > 320) return { isValid: false, message: 'Email demasiado largo' };
    const domain = email.split('@')[1];
    if (domain && domain.length < 2) return { isValid: false, message: 'Dominio inválido' };
    const disposableEmails = ['10minutemail.com','tempmail.org','guerrillamail.com','mailinator.com','temp-mail.org','throwaway.email','yopmail.com','maildrop.cc','sharklasers.com'];
    if (disposableEmails.some(d => domain?.toLowerCase().includes(d))) {
      return { isValid: false, message: 'Por favor usa un email corporativo válido' };
    }
    return { isValid: true, message: 'Email válido' };
  };

  const handleEmailChange = (email) => {
    setFormData(prev => ({ ...prev, email }));
    if (emailValidation.touched) setEmailValidation({ ...validateEmail(email), touched: true });
  };
  const handleEmailBlur = () => setEmailValidation({ ...validateEmail(formData.email), touched: true });

  // ===== Deep-link: solo si NO está controlado por padre
  useEffect(() => {
    if (isOpenProp !== undefined) return; // Controlado por padre, ignorar deep-links
    
    const path = window.location.pathname || '';
    const q = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || '').replace('#', '');
    if (hash === 'roi' || q.get('tool') === 'roi' || path.includes('/calculadora-roi')) {
      setIsOpenInternal(true);
    }
  }, [isOpenProp]);

  // ===== Funciones de apertura/cierre adaptadas
  const openWithUrl = () => {
    if (onCloseProp) return; // Si está controlado por padre, no hacer nada
    setIsOpenInternal(true);
    const url = new URL(window.location.href);
    url.hash = 'roi';
    url.searchParams.set('tool', 'roi');
    window.history.replaceState({}, '', url.toString());
  };

  const closeAndCleanUrl = () => {
    if (onCloseProp) {
      onCloseProp(); // Usar callback del padre
    } else {
      setIsOpenInternal(false); // Cerrar estado interno
    }
    const url = new URL(window.location.href);
    if (url.hash === '#roi') url.hash = '';
    if (url.searchParams.get('tool') === 'roi') url.searchParams.delete('tool');
    window.history.replaceState({}, '', url.toString());
  };

  // ===== Datos base
  const sectors = [
    { value: 'retail', label: 'Retail/Comercio', factor: 1.2 },
    { value: 'manufacturing', label: 'Manufactura', factor: 1.5 },
    { value: 'finance', label: 'Finanzas/Banca', factor: 1.8 },
    { value: 'healthcare', label: 'Salud', factor: 1.3 },
    { value: 'technology', label: 'Tecnología', factor: 1.6 },
    { value: 'consulting', label: 'Consultoría', factor: 1.4 },
    { value: 'education', label: 'Educación', factor: 1.1 },
    { value: 'logistics', label: 'Logística', factor: 1.3 },
    { value: 'other', label: 'Otro', factor: 1.0 }
  ];
  
  const employeeRanges = [
    { value: '1-10', label: '1-10 empleados', factor: 0.8 },
    { value: '11-50', label: '11-50 empleados', factor: 1.0 },
    { value: '51-200', label: '51-200 empleados', factor: 1.2 },
    { value: '201-500', label: '201-500 empleados', factor: 1.5 },
    { value: '500+', label: '500+ empleados', factor: 2.0 }
  ];
  
  const revenueRanges = [
    { value: '0-100k', label: 'Hasta $100K USD/mes', factor: 0.5 },
    { value: '100k-500k', label: '$100K - $500K USD/mes', factor: 1.0 },
    { value: '500k-1m', label: '$500K - $1M USD/mes', factor: 1.5 },
    { value: '1m-5m', label: '$1M - $5M USD/mes', factor: 2.0 },
    { value: '5m+', label: 'Más de $5M USD/mes', factor: 3.0 }
  ];

  // ===== Cálculo ROI
  const calculateROI = () => {
    setLoading(true);
    setTimeout(() => {
      const sectorData = sectors.find(s => s.value === formData.sector);
      const employeeData = employeeRanges.find(e => e.value === formData.employees);
      const revenueData = revenueRanges.find(r => r.value === formData.monthlyRevenue);

      const dataProcessingHours = parseInt(formData.dataProcessingHours) || 20;
      const decisionMakingTime = parseInt(formData.decisionMakingTime) || 5;
      const reportGenerationTime = parseInt(formData.reportGenerationTime) || 8;

      const sectorFactor = sectorData?.factor || 1.0;
      const employeeFactor = employeeData?.factor || 1.0;
      const revenueFactor = revenueData?.factor || 1.0;

      const timeReduction = 0.7;
      const errorReduction = 0.85;
      const decisionSpeed = 0.6;

      const monthlySavings = {
        timeProcessing: (dataProcessingHours * 4 * 50) * timeReduction * employeeFactor,
        fasterDecisions: (decisionMakingTime * 1000) * decisionSpeed * sectorFactor,
        reportEfficiency: (reportGenerationTime * 4 * 40) * timeReduction * revenueFactor,
        errorReduction: (dataProcessingHours * 2 * 100) * errorReduction
      };

      const totalMonthlySavings = Object.values(monthlySavings).reduce((a, b) => a + b, 0);
      const annualSavings = totalMonthlySavings * 12;

      const baseInvestment = 15000;
      const implementationCost = baseInvestment * sectorFactor * (employeeFactor * 0.5 + 0.5);

      const roi = ((annualSavings - implementationCost) / implementationCost) * 100;
      const paybackMonths = implementationCost / (totalMonthlySavings || 1);

      setResults({
        monthlySavings: Math.round(totalMonthlySavings),
        annualSavings: Math.round(annualSavings),
        implementationCost: Math.round(implementationCost),
        roi: Math.round(roi),
        paybackMonths: Math.round(paybackMonths * 10) / 10,
        breakdown: {
          timeProcessing: Math.round(monthlySavings.timeProcessing),
          fasterDecisions: Math.round(monthlySavings.fasterDecisions),
          reportEfficiency: Math.round(monthlySavings.reportEfficiency),
          errorReduction: Math.round(monthlySavings.errorReduction)
        },
        improvements: {
          timeReduction: Math.round(timeReduction * 100),
          errorReduction: Math.round(errorReduction * 100),
          decisionSpeed: Math.round(decisionSpeed * 100)
        }
      });

      setLoading(false);
      setStep(3);
    }, 800);
  };

  // Cotización al llegar a resultados
  useEffect(() => {
    const fetchRate = async () => {
      setFx(prev => ({ ...prev, loading: true, error: null }));
      try {
        const { rate, source } = await fxService.getLatest();
        setFx({ rate, source, loading: false, error: null });
      } catch (e) {
        setFx({ rate: 1050, source: 'fallback', loading: false, error: 'No se pudo obtener cotización, usando fallback' });
      }
    };
    if (step === 3 && results && !fx.rate && !fx.loading) fetchRate();
  }, [step, results]); // eslint-disable-line

  const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const resetCalculator = () => {
    setStep(1);
    setFormData({
      company: '',
      email: '',
      phone: '',
      sector: '',
      employees: '',
      monthlyRevenue: '',
      currentDataTools: '',
      dataProcessingHours: '',
      decisionMakingTime: '',
      reportGenerationTime: ''
    });
    setResults(null);
    setEmailStatus({ loading: false, sent: false, error: null });
    setEmailValidation({ isValid: false, message: '', touched: false });
    setFx({ rate: null, source: null, loading: false, error: null });
    closeAndCleanUrl();
  };

  const createPayment = async () => {
    setPaymentLoading(true);
    try {
      // Precio de consulta personalizada: USD 100
      const consultationPriceUSD = 100;
      const priceARS = fx.rate ? Math.ceil(consultationPriceUSD * fx.rate) : 100000;

      const paymentData = {
        title: `Consulta Personalizada ROI - ${formData.company}`,
        price: priceARS, // Precio en pesos argentinos
        quantity: 1,
        payer: {
          name: formData.company,
          email: formData.email,
          phone: { number: formData.phone }
        },
        metadata: {
          type: 'roi_consultation',
          company: formData.company,
          sector: formData.sector,
          employees: formData.employees,
          roi: results?.roi,
          annualSavings: results?.annualSavings,
          priceUSD: consultationPriceUSD,
          priceARS: priceARS,
          exchangeRate: fx.rate || 'test-mode'
        }
      };

      const preference = await createPaymentPreference(paymentData);
      console.log('✅ Preferencia creada:', preference.id);
      console.log('💵 Precio: USD', consultationPriceUSD, '→ ARS', formatARS(priceARS));

      // Redirigir directamente a Mercado Pago
      if (preference.init_point) {
        window.location.href = preference.init_point;
      } else {
        throw new Error('No se obtuvo la URL de pago');
      }
    } catch (error) {
      console.error('Error creando pago:', error);
      alert('Hubo un error al procesar el pago. Por favor, intenta de nuevo.');
      setPaymentLoading(false);
    }
  };

  const sendLeadData = async () => {
    const emailValid = validateEmail(formData.email);
    if (!emailValid.isValid) {
      setEmailValidation({ ...emailValid, touched: true });
      alert('Por favor, ingresa un email válido antes de continuar.');
      return;
    }
    setEmailStatus({ loading: true, sent: false, error: null });
    try {
      const leadData = {
        ...formData,
        calculatedROI: results,
        timestamp: new Date().toISOString(),
        source: 'ROI Calculator'
      };
      const response = await emailService.sendROILead(leadData);
      if (response.success) {
        setEmailStatus({ loading: false, sent: true, error: null });
        const leads = JSON.parse(localStorage.getItem('roi_leads') || '[]');
        leads.push(leadData);
        localStorage.setItem('roi_leads', JSON.stringify(leads));
        alert(`¡Gracias ${formData.company}! Te contactaremos pronto con un análisis detallado.`);
      }
    } catch (e) {
      setEmailStatus({ loading: false, sent: false, error: 'Error enviando información. Intenta por WhatsApp.' });
      alert('Error enviando información. Intenta contactar por WhatsApp.');
    }
  };

  const isStep1Valid =
    formData.company &&
    formData.email &&
    emailValidation.isValid &&
    formData.sector &&
    formData.employees &&
    formData.monthlyRevenue;

  return (
    <>
      {/* 🎯 Botón flotante - SOLO SI NO ESTÁ CONTROLADO POR BADGE */}
      {!hideFloatingButton && (
        <motion.button
          onClick={openWithUrl}
          className="fixed bottom-24 left-6 z-40 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">Calcular ROI</span>
        </motion.button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={closeAndCleanUrl}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto relative"
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Calculadora de ROI</h2>
                    <p className="text-green-100 mt-1">Descubre cuánto puedes ahorrar con análisis de datos</p>
                  </div>
                  <button onClick={closeAndCleanUrl} className="text-white hover:text-green-200 transition-colors">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm text-green-100">
                    <span>Paso {step} de 3</span>
                  </div>
                  <div className="mt-2 w-full bg-green-600 rounded-full h-2">
                    <motion.div 
                      className="bg-white rounded-full h-2" 
                      initial={{ width: 0 }} 
                      animate={{ width: `${(step / 3) * 100}%` }} 
                      transition={{ duration: 0.5 }} 
                    />
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Paso 1: Información de Empresa */}
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Información de tu Empresa
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Necesitamos algunos datos para calcular tu ROI personalizado
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nombre de la Empresa *
                        </label>
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Ej: Mi Empresa SA"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email Corporativo *
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          onBlur={handleEmailBlur}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          placeholder="tu@empresa.com"
                        />
                        {emailValidation.touched && !emailValidation.isValid && (
                          <p className="text-red-500 text-xs mt-1">{emailValidation.message}</p>
                        )}
                        {emailValidation.touched && emailValidation.isValid && (
                          <p className="text-green-500 text-xs mt-1">✓ Email válido</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          placeholder="+54 9 11 1234-5678"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Sector de la Empresa *
                        </label>
                        <select
                          value={formData.sector}
                          onChange={(e) => handleInputChange('sector', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Selecciona tu sector</option>
                          {sectors.map(sector => (
                            <option key={sector.value} value={sector.value}>
                              {sector.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Número de Empleados *
                        </label>
                        <select
                          value={formData.employees}
                          onChange={(e) => handleInputChange('employees', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Selecciona el rango</option>
                          {employeeRanges.map(range => (
                            <option key={range.value} value={range.value}>
                              {range.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Ingresos Mensuales *
                        </label>
                        <select
                          value={formData.monthlyRevenue}
                          onChange={(e) => handleInputChange('monthlyRevenue', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Selecciona el rango</option>
                          {revenueRanges.map(range => (
                            <option key={range.value} value={range.value}>
                              {range.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-6">
                      <motion.button
                        onClick={() => setStep(2)}
                        disabled={!isStep1Valid}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Siguiente →
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Paso 2: Situación Actual */}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Situación Actual de Datos
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Ayúdanos a entender cómo manejas los datos actualmente
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          ¿Qué herramientas usan actualmente para análisis de datos?
                        </label>
                        <textarea
                          value={formData.currentDataTools}
                          onChange={(e) => handleInputChange('currentDataTools', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          rows={3}
                          placeholder="Ej: Excel, Google Sheets, proceso manual..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Horas semanales procesando datos
                          </label>
                          <input
                            type="number"
                            value={formData.dataProcessingHours}
                            onChange={(e) => handleInputChange('dataProcessingHours', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                            placeholder="20"
                            min="1"
                            max="168"
                          />
                          <p className="text-xs text-gray-500 mt-1">Promedio del equipo</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Días para tomar decisiones importantes
                          </label>
                          <input
                            type="number"
                            value={formData.decisionMakingTime}
                            onChange={(e) => handleInputChange('decisionMakingTime', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                            placeholder="5"
                            min="1"
                            max="30"
                          />
                          <p className="text-xs text-gray-500 mt-1">Basadas en datos</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Horas semanales generando reportes
                          </label>
                          <input
                            type="number"
                            value={formData.reportGenerationTime}
                            onChange={(e) => handleInputChange('reportGenerationTime', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                            placeholder="8"
                            min="1"
                            max="40"
                          />
                          <p className="text-xs text-gray-500 mt-1">Para directivos</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-6">
                      <motion.button
                        onClick={() => setStep(1)}
                        className="px-8 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        ← Anterior
                      </motion.button>

                      <motion.button
                        onClick={calculateROI}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {loading ? 'Calculando...' : 'Calcular ROI 🚀'}
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && results && (
                  <div className="text-center py-12">
                    <h3 className="text-2xl font-bold mb-4">
                      ¡Resultados para {formData.company}!
                    </h3>
                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                      <div className="bg-green-100 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">ROI Anual</div>
                        <div className="text-2xl font-bold text-green-600">
                          {results.roi}%
                        </div>
                      </div>
                      <div className="bg-blue-100 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Ahorro Anual</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatUSD(results.annualSavings)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 items-center mt-6">
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={resetCalculator}
                          className="px-6 py-3 bg-gray-300 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          🔄 Nueva Calculación
                        </button>
                        <button
                          onClick={sendLeadData}
                          disabled={emailStatus.loading}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {emailStatus.loading ? 'Enviando...' : 'Recibir Análisis por Email'}
                        </button>
                      </div>

                      {/* Botón de pago de Mercado Pago */}
                      <div className="mt-4 w-full max-w-md">
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                          ¿Querés una consulta personalizada? 💼
                        </p>
                        <button
                          onClick={createPayment}
                          disabled={paymentLoading}
                          className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
                        >
                          {paymentLoading ? 'Redirigiendo a Mercado Pago...' : '💳 Pagar Consulta Personalizada'}
                        </button>
                        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                          USD 100 {fx.rate ? `≈ ${formatARS(Math.ceil(100 * fx.rate))}` : '(cotización en proceso)'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ROICalculator;