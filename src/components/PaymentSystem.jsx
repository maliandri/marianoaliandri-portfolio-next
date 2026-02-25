'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Shield, CheckCircle, AlertCircle, X, ArrowRight } from 'lucide-react';

// ... (El resto de tus imports y variables de entorno se mantienen igual)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const MERCADOPAGO_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;


const PaymentSystem = ({ visible, onClose, initialAmount, initialDescription, clientData }) => {
    const [selectedMethod, setSelectedMethod] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(null);
    
    // --- NUEVO ESTADO ---
    // Para guardar los detalles de la conversión y el link de pago
    const [paymentDetails, setPaymentDetails] = useState(null);

    useEffect(() => {
        if (visible) {
            setAmount(initialAmount || '');
            setDescription(initialDescription || '');
            setPaymentStatus(null);
            setSelectedMethod('');
            setPaymentDetails(null); // Limpiar detalles al abrir
        }
    }, [visible, initialAmount, initialDescription]);


    // Función para formatear moneda (puedes ajustarla como prefieras)
    const formatCurrency = (value, currency = 'USD') => {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(value);
    };

    // --- LÓGICA MODIFICADA ---
    // 1. Prepara el pago en MercadoPago, pero NO redirige
    const prepareMercadoPagoPayment = async () => {
        if (!amount || !description) {
            setPaymentStatus({ type: 'error', message: 'Por favor completa todos los campos' });
            return;
        }
        setIsLoading(true);
        setPaymentStatus(null);
        try {
            const response = await fetch(`${BACKEND_URL}/api/create-web-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    projectData: { description },
                    clientData: {
                        company: clientData?.company || 'Cliente',
                        email: clientData?.email || 'cliente@email.com',
                        phone: clientData?.phone || ''
                    },
                    paymentType: 'full'
                })
            });
            const data = await response.json();
            if (data.success) {
                // Guarda los detalles para mostrarlos en la UI
                setPaymentDetails({
                    init_point: data.init_point,
                    amount_usd: data.amount_usd,
                    amount_ars: data.amount_ars,
                    exchange_rate: data.exchange_rate,
                });
            } else {
                throw new Error(data.error || 'Error al crear el pago');
            }
        } catch (error) {
            setPaymentStatus({ type: 'error', message: `Error al procesar el pago: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };
    
    // 2. Esta es la función que realmente redirige al usuario
    const redirectToMercadoPago = () => {
        if (paymentDetails?.init_point) {
            window.location.href = paymentDetails.init_point;
        }
    };


    const paymentMethods = [{ id: 'mercadopago', name: 'MercadoPago', description: 'Tarjetas de crédito/débito, efectivo', logo: '💳', color: 'bg-blue-500' }, { id: 'paypal', name: 'PayPal', description: 'Pago seguro internacional (USD)', logo: '🅿️', color: 'bg-yellow-500' }];
    const getStatusColors = (type) => { switch (type) { case 'success': return 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'; case 'error': return 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'; case 'info': return 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'; default: return ''; } };

    if (!visible) return null;

    return (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="relative max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full sm:w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 m-4 z-[10001]">
                <button onClick={() => { setPaymentDetails(null); onClose(); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-3">Sistema de Pagos</h2>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">Selecciona tu método de pago preferido para el servicio.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        {/* ... (Las secciones de descripción y monto se mantienen igual) ... */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Método de pago</label>
                            <div className="space-y-4">{paymentMethods.map((method) => (<div key={method.id} className={`p-5 border rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${selectedMethod === method.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`} onClick={() => {setSelectedMethod(method.id); setPaymentDetails(null);}}><div className="flex items-center space-x-4"><div className={`w-12 h-12 ${method.color} rounded-full flex-shrink-0 flex items-center justify-center text-white text-xl shadow-lg`}>{method.logo}</div><div><h3 className="font-bold text-lg text-gray-900 dark:text-white">{method.name}</h3><p className="text-sm text-gray-600 dark:text-gray-400">{method.description}</p></div></div></div>))}</div>
                        </motion.div>
                    </div>
                    <div className="space-y-6">
                        <AnimatePresence mode="wait">
                            {/* --- SECCIÓN MERCADOPAGO ACTUALIZADA --- */}
                            {selectedMethod === 'mercadopago' && (
                                <motion.div key="mercadopago" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="p-8 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-inner border border-gray-200 dark:border-gray-600">
                                    <h3 className="text-xl font-bold mb-5 text-gray-900 dark:text-white">Pagar con MercadoPago</h3>
                                    
                                    {!paymentDetails ? (
                                        // VISTA INICIAL
                                        <>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Debido a regulaciones locales, los pagos se procesan en Pesos Argentinos (ARS). Haz clic para ver el monto final.</p>
                                            <button onClick={prepareMercadoPagoPayment} disabled={isLoading || !amount || !description} className="w-full bg-gray-800 hover:bg-black text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] flex items-center justify-center">
                                                {isLoading ? 'Consultando...' : 'Ver Monto en ARS'}
                                                {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
                                            </button>
                                        </>
                                    ) : (
                                        // VISTA DE CONFIRMACIÓN
                                        <div className="space-y-4">
                                            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Monto Original:</p>
                                                <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(paymentDetails.amount_usd, 'USD')}</p>
                                            </div>
                                            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                                                <p className="text-sm text-blue-600 dark:text-blue-300">Total a Pagar en Pesos:</p>
                                                <p className="text-3xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(paymentDetails.amount_ars, 'ARS')}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(Tasa de cambio aplicada: ${paymentDetails.exchange_rate}/USD)</p>
                                            </div>
                                            <button onClick={redirectToMercadoPago} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01]">
                                                Confirmar y Pagar Ahora
                                            </button>
                                            <button onClick={() => setPaymentDetails(null)} className="w-full text-sm text-gray-600 dark:text-gray-400 hover:underline mt-2">
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* ... (El resto de tus métodos de pago y la sección de placeholder se mantienen igual) ... */}
                        </AnimatePresence>
                        <AnimatePresence>{paymentStatus && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`p-5 rounded-xl flex items-center space-x-4 shadow-md ${getStatusColors(paymentStatus.type)}`}>{paymentStatus.type === 'success' && <CheckCircle className="w-6 h-6"/>}{paymentStatus.type === 'error' && <AlertCircle className="w-6 h-6"/>}<span className="text-sm font-medium">{paymentStatus.message}</span></motion.div>)}</AnimatePresence>
                        {/* ... (La sección de pagos seguros se mantiene igual) ... */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSystem;