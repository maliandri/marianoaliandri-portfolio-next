'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db, firebaseQA } from '../utils/firebaseservice';
import cloudinaryService from '../utils/cloudinaryService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SocialMediaDashboard from '../components/social/SocialMediaDashboard';
import SocialPublisher from '../components/admin/SocialPublisher';
import CanvasReelGenerator from '../components/admin/CanvasReelGenerator';
import CronScheduler from '../components/admin/CronScheduler';
import ZoneAnalysis from '../components/admin/ZoneAnalysis';
import LabsPublisher from '../components/admin/LabsPublisher';
import BudgetManager from '../components/admin/BudgetManager';
import QuoteBuilder from '../components/admin/QuoteBuilder';
import BenefitsEditor from '../components/admin/BenefitsEditor';
import AuditoriasManager from '../components/admin/AuditoriasManager';
import AuditoriasUnificado from '../components/admin/AuditoriasUnificado';
import NoticiasBotManager from '../components/admin/NoticiasBotManager';
import PaymentPlanEditor from '../components/admin/PaymentPlanEditor';
import StoreExcelManager from '../components/admin/StoreExcelManager';
import AuditRequestsManager from '../components/admin/AuditRequestsManager';
import SentEmailsManager from '../components/admin/SentEmailsManager';
import SubscriptionsManager from '../components/admin/SubscriptionsManager';
import StyleQuizManager from '../components/admin/StyleQuizManager';
import LeadMapPanel from '../components/admin/LeadMapPanel';
import FreeForDevBrowser from '../components/admin/FreeForDevBrowser';
import PlansManager from '../components/admin/PlansManager';
import LeadFinderPanel from '../components/audit/LeadFinderPanel';
import { useLinkedInStatus, useLinkedInProfile, useLinkedInPosts, useLinkedInAnalytics, useLinkedInConnect, useLinkedInDisconnect } from '../hooks/useLinkedIn';
import { ADMIN_NAV_DEFAULT } from '../data/adminNav';
import NavConfigEditor from '../components/admin/NavConfigEditor';
import KeywordExplorer from '../components/audit/KeywordExplorer';
import AppSidebar from '../components/AppSidebar';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

// Navegación de 3 niveles (estilo almamod): 1º sidebar (secciones) · 2º pestañas arriba
// (items de la sección) · 3º pestañas abajo (sub-items, solo si el item tiene "children").
// Estructura editable desde Sitio > Configurar Interfaz (nav_config/admin en Firestore) —
// ADMIN_NAV_DEFAULT es la semilla y el fallback si todavía no hay config guardada.
// Vista plana (compat con el resto del panel: título del header, dispatch de contenido) —
// se arma SIEMPRE sobre el default, no sobre la config editable, porque cada id acá
// mapea a un bloque de contenido fijo en este archivo.
const ADMIN_TABS = ADMIN_NAV_DEFAULT.flatMap(g => g.items);
const TAB_MAP = Object.fromEntries(ADMIN_TABS.map(t => [t.id, t]));
const KNOWN_TAB_IDS = new Set(ADMIN_TABS.map(t => t.id));

// Valida una config cargada de Firestore contra los ids reales que existen en el código
// (por si se borró un tab del código después de guardar una config vieja que lo mencionaba).
function sanitizeNavConfig(sections) {
  if (!Array.isArray(sections) || !sections.length) return null;
  const cleaned = sections
    .map(s => ({ ...s, items: (s.items || []).filter(i => KNOWN_TAB_IDS.has(i.id)) }))
    .filter(s => s.items.length > 0);
  return cleaned.length ? cleaned : null;
}

function findNavLocation(navTree, tabId) {
  for (const group of navTree) {
    const item = group.items.find(i => i.id === tabId);
    if (item) return { group, item };
  }
  return null;
}

// Paleta "almamod" — navy + acento azul + esquina cortada (bottom-right) como firma visual
const NAVY = '#12182b';
const NAVY_SOFT = '#1a2340';
const ACCENT = '#2d4a8a';
const CREAM = '#f8f7f5';
const BORDER_CREAM = '#e2ddd7';
const CUT = 'rounded-2xl';
const CUT_SM = 'rounded-lg';

// Sub-tab controlado desde el nivel 3 de navegación (barra de pestañas del panel)
function PresupuestosTab({ sub, onOpenNuevo }) {
  const [editBudget, setEditBudget] = useState(null);

  const handleOpenInBuilder = (budget) => {
    setEditBudget(budget);
    onOpenNuevo();
  };

  return (
    <div className="space-y-5">
      {sub === 'solicitudes' && <BudgetManager onOpenInBuilder={handleOpenInBuilder} />}
      {sub === 'nuevo'       && <QuoteBuilder key={editBudget?.id || 'new'} initialData={editBudget} />}
      {sub === 'beneficios'  && <BenefitsEditor />}
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState('panel');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [productsView, setProductsView] = useState('grid'); // 'grid' | 'list' (tab Productos)
  const [navOpen, setNavOpen] = useState(false);
  const [navTree, setNavTree] = useState(ADMIN_NAV_DEFAULT);

  // Config editable desde Sitio > Configurar Interfaz — si hay una guardada en
  // Firestore la usamos, si no seguimos con el default hardcodeado de arriba.
  useEffect(() => {
    fetch('/api/nav-config?tree=admin')
      .then(r => r.json())
      .then(data => {
        const clean = sanitizeNavConfig(data.sections);
        if (clean) setNavTree(clean);
      })
      .catch(() => {});
  }, []);

  // Navega a un tab resolviendo automáticamente su grupo (nivel 1) y su primer
  // sub-tab (nivel 3, si tiene). Único punto de entrada para cambiar de pantalla.
  const goToTab = (tabId, subId) => {
    const loc = findNavLocation(navTree, tabId);
    if (!loc) return;
    setActiveGroup(loc.group.id);
    setActiveTab(tabId);
    setActiveSubTab(subId ?? loc.item.children?.[0]?.id ?? null);
    setNavOpen(false);
  };

  // Cerrar el drawer mobile con Escape
  useEffect(() => {
    if (!navOpen) return;
    const onKey = e => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Data states
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    cvAnalysis: 0,
    storeOrders: 0
  });

  const router = useRouter();

  // Check if already authenticated (session)
  useEffect(() => {
    const isAdmin = sessionStorage.getItem('adminAuth');
    if (isAdmin === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Load data when authenticated — siempre via API route (Firebase Admin)
  useEffect(() => {
    if (isAuthenticated) {
      let cancelled = false;

      const loadData = async () => {
        setLoading(true);
        try {
          const response = await fetch('/api/admin-get-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: sessionStorage.getItem('adminUsername'),
              password: sessionStorage.getItem('adminPassword'),
            }),
          });

          if (!response.ok) throw new Error(`Error ${response.status}`);
          const result = await response.json();
          if (cancelled) return;

          if (result.success) {
            setUsers(result.data.users || []);
            setOrders(result.data.orders || []);
            setProducts(result.data.products || []);
            setStats(result.data.stats || {});
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          if (!cancelled) {
            console.error('❌ Error cargando datos admin:', error);
            setLoginError('Error cargando datos.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      loadData();
      return () => { cancelled = true; };
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        sessionStorage.setItem('adminAuth', 'true');
        sessionStorage.setItem('adminUsername', username);
        sessionStorage.setItem('adminPassword', password);
        setIsAuthenticated(true);
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
    } catch {
      setLoginError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    sessionStorage.removeItem('adminUsername');
    sessionStorage.removeItem('adminPassword');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const resetProducts = async () => {
    if (!confirm('⚠️ ¿Resetear TODOS los productos?\n\n' +
                 'Esto va a:\n' +
                 '- Eliminar todos los productos existentes\n' +
                 '- Crear 10 productos nuevos con precios USD\n\n' +
                 '¿Continuar?')) return;

    try {
      setLoading(true);
      const response = await fetch('/api/reset-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: sessionStorage.getItem('adminPassword')
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('✅ Productos reseteados!\n\n' +
              '🛍️ Productos creados: ' + result.productsCreated + '\n\n' +
              'Recargando...');
        window.location.reload();
      } else {
        throw new Error('Error reseteando productos');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateAllDescriptions = async () => {
    if (!confirm('📝 ¿Actualizar descripciones de TODOS los productos?\n\n' +
                 'Esto va a actualizar las 10 descripciones con:\n' +
                 '- Beneficios detallados\n' +
                 '- Características específicas\n' +
                 '- Información técnica\n\n' +
                 '¿Continuar?')) return;

    try {
      setLoading(true);
      const response = await fetch('/api/update-all-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: sessionStorage.getItem('adminPassword')
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('✅ Descripciones actualizadas!\n\n' +
              '📝 Productos actualizados: ' + result.products.length + '\n\n' +
              'Recargando...');

        window.location.reload();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error actualizando descripciones');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const resendCVEmail = async (order) => {
    try {
      setLoading(true);
      const response = await fetch('/api/send-cv-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: order.customerEmail,
          cvAnalysis: JSON.parse(order.cvAnalysis || '[]'),
          paymentId: order.paymentId,
          amount: order.totalARS,
          timestamp: order.createdAt
        })
      });

      if (response.ok) {
        alert('Email reenviado exitosamente a ' + order.customerEmail);
      } else {
        throw new Error('Error en el envío');
      }
    } catch (error) {
      alert('Error reenviando email: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Etapas de un pedido de Tienda (ver docs/superpowers/specs/2026-09-22-area-cliente-design.md).
  const ORDER_STAGES = [
    { id: 'pago_confirmado', label: 'Pago confirmado' },
    { id: 'en_desarrollo', label: 'En desarrollo' },
    { id: 'en_revision', label: 'En revisión' },
    { id: 'entregado', label: 'Entregado' },
  ];

  const updateOrderStage = async (order, stage) => {
    const note = window.prompt(`Nota para el cliente sobre este cambio a "${ORDER_STAGES.find(s => s.id === stage)?.label}" (opcional, se incluye en el email):`, '') || '';
    try {
      setLoading(true);
      const response = await fetch('/api/orders/update-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: sessionStorage.getItem('adminPassword'),
          orderId: order.id,
          stage,
          note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error actualizando la etapa');

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, stage } : o));
    } catch (error) {
      alert('❌ Error actualizando la etapa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (productId, updates) => {
    try {
      const isDev = window.location.hostname === 'localhost';

      if (isDev) {
        // DESARROLLO: usar Client SDK directamente
        const productRef = doc(db, 'products', productId);
        await updateDoc(productRef, {
          ...updates,
          updatedAt: new Date()
        });
      } else {
        // PRODUCCIÓN: usar Netlify Function con Admin SDK
        const response = await fetch('/api/update-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminPassword: sessionStorage.getItem('adminPassword'),
            productId,
            updates
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error actualizando producto');
        }
      }

      alert('✅ Producto actualizado exitosamente');

      // Actualizar el estado local sin recargar desde Firestore
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId ? { ...p, ...updates } : p
        )
      );
    } catch (error) {
      alert('❌ Error actualizando producto: ' + error.message);
    }
  };

  const deleteProduct = async (productId) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      // Borrado server-side: las reglas de Firestore son write:false para
      // `products`, asi que el SDK cliente da "permisos insuficientes".
      const res = await fetch('/api/store-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteOne',
          adminPassword: sessionStorage.getItem('adminPassword'),
          id: productId,
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');
      alert('Producto eliminado');

      // Recargar solo productos
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      const productsData = [];
      snapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
    } catch (error) {
      alert('Error eliminando producto: ' + error.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return 'N/A';
    }
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatARS = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Login Screen — paleta navy/cream con esquina cortada (estilo almamod)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: CREAM }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 ${CUT_SM} text-2xl font-black text-white mb-3`}
              style={{ background: NAVY }}
            >
              M
            </div>
            <p className="text-xs tracking-widest uppercase" style={{ color: '#6b7280' }}>Panel de administración</p>
          </div>

          <div
            className={`bg-white ${CUT} p-8`}
            style={{ border: `1px solid ${BORDER_CREAM}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
          >
            <h1 className="text-xl font-bold mb-6" style={{ color: NAVY }}>Iniciar sesión</h1>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d4a5c' }}>Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className={`w-full px-3.5 py-2.5 bg-white ${CUT_SM} text-sm focus:outline-none transition-colors`}
                  style={{ border: `1px solid ${BORDER_CREAM}`, color: NAVY }}
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = BORDER_CREAM}
                  placeholder="Usuario"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d4a5c' }}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={`w-full px-3.5 py-2.5 bg-white ${CUT_SM} text-sm focus:outline-none transition-colors`}
                  style={{ border: `1px solid ${BORDER_CREAM}`, color: NAVY }}
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = BORDER_CREAM}
                  placeholder="••••••••"
                  required
                />
              </div>

              {loginError && (
                <div className={`${CUT_SM} px-3.5 py-2.5 text-sm`} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 ${CUT_SM} font-bold text-sm text-white transition-transform`}
                style={{ background: loading ? '#9ca3af' : NAVY, cursor: loading ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>

          <button
            onClick={() => router.push('/')}
            className="mt-5 w-full text-center text-sm transition-colors"
            style={{ color: '#6b7280' }}
          >
            ← Volver al sitio
          </button>
        </motion.div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className={`admin-theme ${jakarta.className} min-h-screen bg-gray-50 dark:bg-neutral-950 md:flex`}>
      {/* Sidebar navy, colapsable en desktop, drawer en mobile (estilo almamod) --
          componente compartido con el área de cliente, ver src/components/AppSidebar.jsx */}
      <AppSidebar
        sections={navTree.map(group => ({
          id: group.id,
          label: group.label,
          items: group.items.map(it => ({ id: it.id, label: it.label, icon: it.icon, onClick: () => goToTab(it.id) })),
        }))}
        activeId={activeTab}
        navOpen={navOpen}
        onNavOpenChange={setNavOpen}
        storageKey="admin_sidebar_collapsed"
        headerTitle="Panel interno"
        headerSubtitle={username}
      />

      {/* Columna principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header: título de la pantalla + acciones; los sub-items del tab activo van como pestañas */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#0b0f17]/90 backdrop-blur border-b border-gray-200 dark:border-[#243350]">
          <div className="px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setNavOpen(v => !v)}
                aria-label="Menú"
                className="md:hidden flex flex-col gap-[3px] p-2 -ml-2 text-gray-700 dark:text-gray-200"
              >
                <span className={`block h-0.5 w-5 bg-current transition-transform ${navOpen ? 'translate-y-[5px] rotate-45' : ''}`} />
                <span className={`block h-0.5 w-5 bg-current transition-opacity ${navOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-5 bg-current transition-transform ${navOpen ? '-translate-y-[5px] -rotate-45' : ''}`} />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white truncate">
                  {findNavLocation(navTree, activeTab)?.item.label || 'Panel'}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {navTree.find(g => g.id === activeGroup)?.label || ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => router.push('/')}
                className={`px-3 py-2 border border-gray-300 dark:border-[#243350] text-gray-700 dark:text-gray-300 ${CUT_SM} hover:bg-gray-50 dark:hover:bg-[#172033] transition-colors text-sm font-medium`}
              >
                Ver sitio
              </button>
              <button
                onClick={handleLogout}
                className={`px-3 py-2 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 ${CUT_SM} hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-sm font-medium`}
              >
                Salir
              </button>
            </div>
          </div>

          {TAB_MAP[activeTab]?.children && (
            <div className="px-4 sm:px-8 flex gap-1 overflow-x-auto">
              {TAB_MAP[activeTab].children.map(child => (
                <button
                  key={child.id}
                  onClick={() => setActiveSubTab(child.id)}
                  className={`px-3.5 py-2.5 text-sm whitespace-nowrap -mb-px border-b-2 transition-colors ${
                    activeSubTab === child.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium'
                  }`}
                >
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 px-4 sm:px-8 py-6">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Total órdenes</p>
                <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-2">{stats.totalOrders}</p>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Análisis CV</p>
                <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-2">{stats.cvAnalysis}</p>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Tienda</p>
                <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-2">{stats.storeOrders}</p>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Revenue total</p>
                <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-2">{formatARS(stats.totalRevenue)}</p>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Órdenes recientes</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.slice(0, 10).map(order => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">{order.id.slice(-8)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            order.type === 'cv_analysis'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          }`}>
                            {order.type === 'cv_analysis' ? 'CV Analysis' : 'Tienda'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{order.customerEmail || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-semibold">{formatARS(order.totalARS || 0)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'users' && (
          <AdminUsersPanel users={users} formatDate={formatDate} />
        )}

        {!loading && activeTab === 'orders' && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Todas las órdenes ({orders.length})</h2>
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono text-sm text-gray-500 dark:text-gray-400">#{order.id.slice(-12)}</span>
                      <span className={`ml-3 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        order.type === 'cv_analysis'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          : order.type === 'leadfinder_plan'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                      }`}>
                        {order.type === 'cv_analysis' ? 'CV Analysis' : order.type === 'leadfinder_plan' ? 'Lead Finder Pro' : 'Tienda'}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{formatARS(order.totalARS || 0)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Cliente:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{order.customerEmail || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Fecha:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{formatDate(order.createdAt)}</span>
                    </div>
                  </div>

                  {order.type === 'cv_analysis' && (
                    <button
                      onClick={() => resendCVEmail(order)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Reenviar email
                    </button>
                  )}

                  {order.type === 'store' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Etapa:</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                        {ORDER_STAGES.find(s => s.id === (order.stage || 'pago_confirmado'))?.label}
                      </span>
                      <select
                        defaultValue=""
                        disabled={loading}
                        onChange={e => { if (e.target.value) { updateOrderStage(order, e.target.value); e.target.value = ''; } }}
                        className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-900 dark:text-white disabled:opacity-50"
                      >
                        <option value="" disabled>Avanzar a...</option>
                        {ORDER_STAGES.filter(s => ORDER_STAGES.findIndex(x => x.id === s.id) > ORDER_STAGES.findIndex(x => x.id === (order.stage || 'pago_confirmado'))).map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && activeTab === 'products' && (
          <>
          <StoreExcelManager />
          <PaymentPlanEditor />
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Productos de la tienda ({products.length})</h2>
              <div className="flex flex-wrap items-center gap-3">
                {/* Toggle Grid / Lista */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setProductsView('grid')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${productsView === 'grid' ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setProductsView('list')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${productsView === 'list' ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Lista
                  </button>
                </div>
                <button
                  onClick={updateAllDescriptions}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                  disabled={loading}
                >
                  Actualizar descripciones
                </button>
                <button
                  onClick={resetProducts}
                  className="px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-lg transition-colors text-sm font-medium"
                  disabled={loading}
                >
                  Resetear productos (10)
                </button>
              </div>
            </div>

            <div className={productsView === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
              {products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onUpdate={updateProduct}
                  onDelete={deleteProduct}
                  formatARS={formatARS}
                  compact={productsView === 'list'}
                />
              ))}
            </div>
          </div>
          </>
        )}

        {!loading && activeTab === 'social' && (
          <div>
            {activeSubTab === 'publicar'     && <SocialMediaDashboard key="publicar"     initialTab="custom" />}
            {activeSubTab === 'servicios'    && <SocialPublisher />}
            {activeSubTab === 'estadisticas' && <SocialMediaDashboard key="estadisticas" initialTab="statistics" />}
            {activeSubTab === 'productos'    && <SocialMediaDashboard key="productos"    initialTab="products" />}
            {activeSubTab === 'proyectos'    && <SocialMediaDashboard key="proyectos"    initialTab="proyectos" />}
            {activeSubTab === 'reel'         && <CanvasReelGenerator />}
            {activeSubTab === 'labs'         && <LabsPublisher />}
          </div>
        )}

        {!loading && activeTab === 'linkedin' && (
          <LinkedInPanel />
        )}

        {activeTab === 'leads' && (
          <LeadFinderPanel />
        )}

        {activeTab === 'leads-map' && (
          <LeadMapPanel onClose={() => goToTab('leads')} />
        )}

        {activeTab === 'leadfinder-plans' && (
          <div>
            <PlansManager />
          </div>
        )}

        {!loading && activeTab === 'questions' && (
          <AdminQuestionsPanel />
        )}

        {activeTab === 'nav-config' && (
          <div>
            <NavConfigEditor />
          </div>
        )}

        {activeTab === 'rubros-buscados' && (
          <div>
            <KeywordExplorer embedded />
          </div>
        )}

        {activeTab === 'proyectos' && (
          <AdminProyectosPanel db={db} />
        )}

        {activeTab === 'zonas' && (
          <div>
            <ZoneAnalysis />
          </div>
        )}
        {activeTab === 'cron' && (
          <div>
            <CronScheduler />
          </div>
        )}
        {activeTab === 'presupuestos' && (
          <PresupuestosTab sub={activeSubTab} onOpenNuevo={() => setActiveSubTab('nuevo')} />
        )}
        {activeTab === 'suscripciones' && (
          <div>
            <SubscriptionsManager />
          </div>
        )}
        {activeTab === 'auditorias' && (
          <div>
            <AuditoriasManager />
          </div>
        )}
        {activeTab === 'auditorias-todas' && (
          <div>
            <AuditoriasUnificado />
          </div>
        )}
        {activeTab === 'noticias-bot' && (
          <div>
            <NoticiasBotManager />
          </div>
        )}
        {activeTab === 'style-quiz' && (
          <div>
            <StyleQuizManager />
          </div>
        )}
        {activeTab === 'audit-requests' && (
          <AuditRequestsManager />
        )}
        {activeTab === 'emails' && (
          <div>
            <SentEmailsManager />
          </div>
        )}
        {activeTab === 'free-for-dev' && (
          <div>
            <FreeForDevBrowser />
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

// Panel de edición de Proyectos
const EMPTY_EDIT = { descripcionCorta: '', stack: '', funcionalidades: '', impacto: '', orden: 99, visible: true };

const PERMISSION_INFO = {
  siteOwner:          { label: 'Propietario',        className: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  siteFullUser:        { label: 'Acceso completo',     className: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  siteRestrictedUser:  { label: 'Acceso restringido',  className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' },
  siteUnverifiedUser:  { label: 'Sin verificar',       className: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

function GscStatusBadge({ permissionLevel, statsError }) {
  if (statsError) {
    return (
      <span
        title={typeof statsError === 'string' ? statsError : 'Error consultando Search Console'}
        className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
      >
        Sin acceso a estadísticas
      </span>
    );
  }
  const info = PERMISSION_INFO[permissionLevel] || { label: permissionLevel || 'desconocido', className: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400' };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${info.className}`}>{info.label}</span>;
}

const SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-fbsvc@marianoaliandri-3b135.iam.gserviceaccount.com';

function AdminProyectosPanel({ db }) {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [edits, setEdits] = useState({});
  const [expanded, setExpanded] = useState({});
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState(null);
  const [recapturing, setRecapturing] = useState(null); // domain en curso, o null
  const [lightbox, setLightbox] = useState(null); // domain abierto en el visor, o null
  const [uploadingMedia, setUploadingMedia] = useState(null); // domain en curso, o null

  const loadProyectos = () =>
    fetch('/api/proyectos?all=1')
      .then(r => r.json())
      .then(data => {
        const list = data.proyectos || [];
        setProyectos(list);
        const initial = {};
        list.forEach(p => {
          initial[p.domain] = {
            descripcionCorta: p.descripcionCorta || '',
            stack: p.stack || '',
            funcionalidades: p.funcionalidades || '',
            impacto: p.impacto || '',
            orden: p.orden ?? 99,
            visible: p.visible !== false,
          };
        });
        setEdits(initial);
      })
      .catch(() => {});

  useEffect(() => {
    loadProyectos().finally(() => setLoading(false));
  }, []);

  const setField = (domain, field, value) =>
    setEdits(prev => ({ ...prev, [domain]: { ...prev[domain], [field]: value } }));

  const recapture = async (domain) => {
    setRecapturing(domain);
    try {
      const res = await fetch('/api/capture-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (data.error || data.failed?.length) {
        alert(`❌ Error recapturando ${domain}: ${data.error || data.failed[0]?.error}`);
      } else {
        await loadProyectos();
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
    } finally {
      setRecapturing(null);
    }
  };

  const handleSave = async (domain) => {
    setSaving(domain);
    try {
      const e = edits[domain];
      const res = await fetch('/api/proyectos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, ...e, orden: Number(e.orden) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      alert(`✅ ${domain} guardado`);
    } catch (err) {
      alert('❌ Error: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleMediaUpload = async (domain, file) => {
    setUploadingMedia(domain);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const isVideo = file.type.startsWith('video/');
      const url = isVideo
        ? await cloudinaryService.uploadBase64Video(base64, `proyectos-media/${domain}`)
        : await cloudinaryService.uploadBase64Image(base64, `proyectos-media/${domain}`);

      const res = await fetch('/api/proyectos/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, url, type: isVideo ? 'video' : 'image' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error guardando el medio');
      await loadProyectos();
    } catch (err) {
      alert('❌ Error subiendo archivo: ' + err.message);
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleTogglePublicable = async (domain, mediaId, publicable) => {
    try {
      const res = await fetch('/api/proyectos/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, mediaId, publicable }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error actualizando');
      await loadProyectos();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const handleDownloadMedia = async (url, filename) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('❌ Error descargando: ' + err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Proyectos — desde Google Search Console
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{proyectos.length} sitios detectados</span>
          <button
            onClick={async () => {
              setCapturing(true);
              setCaptureResult(null);
              try {
                const res = await fetch('/api/capture-projects', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                });
                const data = await res.json();
                setCaptureResult(data);
                await loadProyectos();
              } catch (e) {
                setCaptureResult({ error: e.message });
              } finally {
                setCapturing(false);
              }
            }}
            disabled={capturing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {capturing ? 'Capturando...' : 'Capturar screenshots'}
          </button>
        </div>
      </div>

      {captureResult && (
        <div className={`rounded-xl p-3 text-sm mb-2 ${captureResult.error ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
          {captureResult.error
            ? `❌ ${captureResult.error}`
            : <>
                ✅ {captureResult.uploaded?.length} capturas subidas a Cloudinary / carpeta MarianWeb
                {captureResult.failed?.length > 0 && <span className="text-yellow-400 ml-2">· {captureResult.failed.length} fallidas</span>}
              </>
          }
        </div>
      )}

      {/* Config GSC — cuenta de servicio a agregar en cada propiedad nueva */}
      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-700 dark:text-indigo-300">
        Para que un sitio aparezca acá, agregá esta cuenta de servicio como usuario <strong>Completo</strong> en
        Search Console → esa propiedad → Configuración → Usuarios y permisos:
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <code className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-500/30 text-[11px] break-all">
            {SERVICE_ACCOUNT_EMAIL}
          </code>
          <button
            onClick={() => navigator.clipboard?.writeText(SERVICE_ACCOUNT_EMAIL)}
            className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium"
          >
            Copiar
          </button>
        </div>
      </div>

      {/* Resumen general — clicks/impresiones por sitio */}
      {proyectos.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Resumen — clicks e impresiones (últimos 28 días)</h4>
          <ResponsiveContainer width="100%" height={Math.max(220, proyectos.length * 42)}>
            <BarChart data={proyectos.map(p => ({ domain: p.domain, clicks: p.clicks, impressions: p.impressions }))} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-gray-200 dark:text-neutral-800" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" />
              <YAxis type="category" dataKey="domain" tick={{ fontSize: 11 }} width={140} stroke="currentColor" className="text-gray-400" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="impressions" name="Impresiones" fill="#c7d2fe" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {proyectos.map(p => {
        const e = edits[p.domain] || EMPTY_EDIT;
        const isSaving = saving === p.domain;
        const isOpen = !!expanded[p.domain];
        return (
          <div key={p.domain} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            {/* Header colapsable */}
            <div className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <button
                type="button"
                onClick={() => setExpanded(prev => ({ ...prev, [p.domain]: !prev[p.domain] }))}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <span
                  role="button"
                  tabIndex={0}
                  title="Ver imagen completa"
                  onClick={e => { e.stopPropagation(); setLightbox(p.domain); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setLightbox(p.domain); } }}
                  className="shrink-0 relative group"
                >
                  <img
                    src={p.screenshotUrl}
                    alt={p.domain}
                    className="w-14 h-9 object-cover rounded border border-gray-200 dark:border-gray-600 group-hover:opacity-75 transition-opacity"
                    onError={ev => { ev.target.style.display = 'none'; }}
                  />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{p.domain}</span>
                    <GscStatusBadge permissionLevel={p.permissionLevel} statsError={p.statsError} />
                    {!e.visible && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400">Oculto</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.clicks} clicks · {p.impressions} imp. · orden {e.orden}</div>
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {e.descripcionCorta && (
                  <span className="hidden sm:block text-xs text-green-600 dark:text-green-400 font-medium">Completo</span>
                )}
                <button
                  type="button"
                  onClick={() => recapture(p.domain)}
                  disabled={recapturing === p.domain}
                  title="Recapturar screenshot de este sitio"
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {recapturing === p.domain ? '...' : 'Recapturar'}
                </button>
                <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [p.domain]: !prev[p.domain] }))}>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Contenido expandido */}
            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-neutral-800 pt-4">

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Descripción corta</label>
                  <textarea
                    rows={2}
                    value={e.descripcionCorta}
                    onChange={ev => setField(p.domain, 'descripcionCorta', ev.target.value)}
                    placeholder="→ Sitio de ventas de viviendas modulares que convierte visitas en leads calificados..."
                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Stack técnico</label>
                  <textarea
                    rows={2}
                    value={e.stack}
                    onChange={ev => setField(p.domain, 'stack', ev.target.value)}
                    placeholder="→ React 19 + Vite · Tailwind CSS · Framer Motion · Google Gemini · Supabase..."
                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Funcionalidades destacadas</label>
                  <textarea
                    rows={5}
                    value={e.funcionalidades}
                    onChange={ev => setField(p.domain, 'funcionalidades', ev.target.value)}
                    placeholder={"→ Chatbot de ventas con IA — asesora al cliente y captura leads\n→ Catálogo interactivo con filtros en tiempo real\n→ SEO híbrido SPA + HTML estático"}
                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Dato de impacto</label>
                  <textarea
                    rows={2}
                    value={e.impacto}
                    onChange={ev => setField(p.domain, 'impacto', ev.target.value)}
                    placeholder="→ 97/100 de salud SEO en Ahrefs, indexado en GSC con presencia en búsquedas de..."
                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Fotos y videos</label>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      disabled={uploadingMedia === p.domain}
                      onChange={ev => {
                        const file = ev.target.files?.[0];
                        if (file) handleMediaUpload(p.domain, file);
                        ev.target.value = '';
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                    />
                    {uploadingMedia === p.domain && <span className="text-xs text-indigo-500">Subiendo...</span>}
                  </div>
                  {p.media?.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {p.media.map(m => (
                        <div key={m.id} className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                          {m.type === 'video' ? (
                            <video src={m.url} muted className="w-full h-20 object-cover bg-black" />
                          ) : (
                            <img src={m.url} alt="" className="w-full h-20 object-cover" />
                          )}
                          <div className="p-1.5 space-y-1">
                            <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                              <input
                                type="checkbox"
                                checked={m.publicable}
                                onChange={ev => handleTogglePublicable(p.domain, m.id, ev.target.checked)}
                                className="w-3 h-3"
                              />
                              Publicable
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDownloadMedia(m.url, `${p.domain}-${m.id}.${m.type === 'video' ? 'mp4' : 'jpg'}`)}
                              className="w-full text-[10px] px-1.5 py-1 rounded border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800"
                            >
                              Descargar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Orden</label>
                    <input
                      type="number"
                      value={e.orden}
                      min={0}
                      onChange={ev => setField(p.domain, 'orden', ev.target.value)}
                      className="w-20 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4">
                    <input
                      type="checkbox"
                      checked={e.visible}
                      onChange={ev => setField(p.domain, 'visible', ev.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    Visible en el portfolio
                  </label>
                  <button
                    onClick={() => handleSave(p.domain)}
                    disabled={isSaving}
                    className="ml-auto mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Visor de imagen completa + recaptura */}
      {lightbox && (() => {
        const p = proyectos.find(pr => pr.domain === lightbox);
        if (!p) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <div
              className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={p.screenshotUrl} alt={p.domain} className="w-full max-h-[70vh] object-contain bg-gray-100 dark:bg-neutral-950" />
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{p.domain}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {p.screenshotUpdatedAt ? `Última captura: ${new Date(p.screenshotUpdatedAt).toLocaleString('es-AR')}` : 'Sin captura manual todavía (mostrando fallback en vivo)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => recapture(p.domain)}
                    disabled={recapturing === p.domain}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {recapturing === p.domain ? 'Recapturando...' : 'Recapturar'}
                  </button>
                  <button
                    onClick={() => setLightbox(null)}
                    className="px-3 py-2 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Panel de LinkedIn
function LinkedInPanel() {
  const { data: status, isLoading: statusLoading } = useLinkedInStatus();
  const isConnected = status?.connected;
  const { data: profile, isLoading: profileLoading } = useLinkedInProfile(isConnected);
  const { data: postsData, isLoading: postsLoading } = useLinkedInPosts(isConnected);
  const { data: analyticsData } = useLinkedInAnalytics(isConnected);
  const connectMutation = useLinkedInConnect();
  const disconnectMutation = useLinkedInDisconnect();

  if (statusLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado de conexión */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isConnected ? `Conectado como ${status.profileName}` : 'LinkedIn no conectado'}
              </h3>
              {isConnected && status.expiresAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Token expira: {new Date(status.expiresAt).toLocaleDateString('es-AR')}
                </p>
              )}
              {status?.expired && (
                <p className="text-xs text-red-500">Token expirado - reconectar</p>
              )}
            </div>
          </div>
          {isConnected ? (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="px-4 py-2 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
            </button>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {connectMutation.isPending ? 'Conectando...' : 'Conectar LinkedIn'}
            </button>
          )}
        </div>
      </div>

      {/* Perfil */}
      {isConnected && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Perfil</h3>
          {profileLoading ? (
            <p className="text-sm text-gray-500 animate-pulse">Cargando perfil...</p>
          ) : profile ? (
            <div className="flex items-center gap-4">
              {profile.picture && (
                <img
                  src={profile.picture}
                  alt={profile.name}
                  className="w-16 h-16 rounded-full border-2 border-blue-500"
                />
              )}
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{profile.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">ID: {profile.id}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No se pudo cargar el perfil</p>
          )}
        </div>
      )}

      {/* Posts */}
      {isConnected && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            Posts recientes {postsData?.total ? `(${postsData.total})` : ''}
          </h3>
          {postsLoading ? (
            <p className="text-sm text-gray-500 animate-pulse">Cargando posts...</p>
          ) : postsData?.posts?.length > 0 ? (
            <div className="space-y-3">
              {postsData.posts.map((post, i) => (
                <div key={post.id || i} className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{post.text || '(Sin texto)'}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {post.created && (
                      <span>{new Date(post.created).toLocaleDateString('es-AR')}</span>
                    )}
                    {post.hasMedia && <span>Con media</span>}
                    <span className="capitalize">{post.visibility?.toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {postsData?.note || 'No se encontraron posts'}
              </p>
              {postsData?.note && (
                <p className="text-xs text-gray-400 mt-2">
                  Para ver posts con metricas detalladas, solicita acceso a Marketing Developer Platform en tu LinkedIn App.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analytics */}
      {isConnected && analyticsData && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Analytics</h3>
          {analyticsData.available ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Se llenará cuando Marketing Developer Platform esté aprobada */}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">{analyticsData.message}</p>
              <a
                href="https://www.linkedin.com/developers/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Ir a LinkedIn Developers
              </a>
            </div>
          )}
        </div>
      )}

      {/* Info si no está conectado */}
      {!isConnected && !status?.expired && (
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-5 border border-blue-200 dark:border-blue-500/20">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-3">Cómo conectar LinkedIn</h3>
          <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-decimal list-inside">
            <li>Asegurate de tener la app creada en LinkedIn Developers</li>
            <li>Configura LINKEDIN_CLIENT_ID y LINKEDIN_CLIENT_SECRET en Netlify</li>
            <li>Agrega la redirect URL: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://marianoaliandri.com.ar/api/linkedin-auth</code></li>
            <li>Click en "Conectar LinkedIn" y autoriza la app</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onUpdate, onDelete, formatARS, compact = false }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name || product.title || '',
    description: product.description || '',
    priceUSD: product.priceUSD || 0,
    priceARS: product.priceARS || 0,
    rentalMonthly: product.rentalMonthly || 0,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const updates = {
      name: formData.name,
      description: formData.description,
      priceUSD: parseFloat(formData.priceUSD) || 0
    };

    if (formData.priceARS) {
      updates.priceARS = parseFloat(formData.priceARS);
    }

    if (formData.rentalMonthly) {
      updates.rentalMonthly = parseFloat(formData.rentalMonthly);
    }

    onUpdate(product.id, updates);
    setEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: product.name || product.title || '',
      description: product.description || '',
      priceUSD: product.priceUSD || 0,
      priceARS: product.priceARS || 0,
      rentalMonthly: product.rentalMonthly || 0,
    });
    setEditing(false);
  };

  // --- IA de contenido + galería de imágenes ---
  const [aiBusy, setAiBusy] = useState(null); // 'content' | 'pexels' | 'upload' | null
  const [aiMsg, setAiMsg] = useState('');
  const [gen, setGen] = useState(null); // contenido generado pendiente de aplicar
  const [images, setImages] = useState(
    Array.isArray(product.images) && product.images.length
      ? product.images
      : (product.image ? [product.image] : [])
  );
  const imgFileRef = useRef(null);

  // Persiste la galería (image = portada = primera del array)
  const saveImages = (next) => {
    setImages(next);
    onUpdate(product.id, { images: next, image: next[0] || null });
  };

  const generateContent = async () => {
    setAiBusy('content'); setAiMsg(''); setGen(null);
    try {
      const res = await fetch('/api/product-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name || product.title || '',
          description: product.description || product.shortDescription || '',
          category: product.category || '',
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');
      setGen(d.content);
    } catch (e) {
      setAiMsg('✕ ' + e.message);
    } finally {
      setAiBusy(null);
    }
  };

  const applyContent = () => {
    if (!gen) return;
    onUpdate(product.id, {
      description: gen.descripcion,
      shortDescription: gen.descripcion,
      ideaDesarrollo: gen.ideaDesarrollo,
      features: gen.features,
      deliverables: gen.deliverables,
      tags: gen.tags,
    });
    setGen(null);
  };

  // Agrega una foto de Pexels a la galería
  const addPexels = async () => {
    setAiBusy('pexels'); setAiMsg('');
    try {
      const res = await fetch('/api/product-image-pexels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: sessionStorage.getItem('adminPassword'),
          id: product.id,
          name: product.name || product.title || '',
          category: product.category || '',
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');
      saveImages([...images, d.imageUrl]);
      setAiMsg(`✓ Foto agregada${d.credit ? ` (${d.credit})` : ''}`);
    } catch (e) {
      setAiMsg('✕ ' + e.message);
    } finally {
      setAiBusy(null);
    }
  };

  // Sube una o varias fotos propias a Cloudinary y las agrega a la galería
  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setAiBusy('upload'); setAiMsg('');
    try {
      const uploaded = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('upload_preset', 'zone_analysis_images');
        form.append('folder', 'store-products');
        const up = await fetch('https://api.cloudinary.com/v1_1/dlshym1te/image/upload', { method: 'POST', body: form });
        const ud = await up.json();
        if (!up.ok || !ud.secure_url) throw new Error(ud?.error?.message || 'Error subiendo a Cloudinary');
        uploaded.push(ud.secure_url);
      }
      saveImages([...images, ...uploaded]);
      setAiMsg(`✓ ${uploaded.length} foto(s) subida(s)`);
    } catch (e) {
      setAiMsg('✕ ' + e.message);
    } finally {
      setAiBusy(null);
      if (imgFileRef.current) imgFileRef.current.value = '';
    }
  };

  const removeImage = (idx) => saveImages(images.filter((_, i) => i !== idx));
  const makeCover = (idx) => {
    if (idx === 0) return;
    const next = [...images];
    const [pick] = next.splice(idx, 1);
    saveImages([pick, ...next]);
  };

  // Vista compacta (fila de lista) cuando no se está editando
  if (compact && !editing) {
    return (
      <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors">
        <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0 flex items-center justify-center">
          {images[0] ? (
            <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-gray-400">—</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{product.name || product.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{product.description}</p>
        </div>
        <div className="text-right whitespace-nowrap hidden sm:block">
          {product.priceUSD ? (
            <span className="text-sm font-bold text-green-600 dark:text-green-400">USD {product.priceUSD}</span>
          ) : (
            <span className="text-xs text-gray-400">Sin precio</span>
          )}
          {images.length > 1 && <span className="block text-[10px] text-gray-400">{images.length} fotos</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="px-2.5 py-1.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg text-xs font-medium" title="Editar">Editar</button>
          <button onClick={() => onDelete(product.id)} className="px-2.5 py-1.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-xs font-medium" title="Eliminar">Eliminar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4">
      {editing ? (
        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
              Título del Producto
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ej: Desarrollo Web Premium"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Descripción del producto..."
            />
          </div>

          {/* Precio USD (principal) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
              Precio (USD) - Principal
            </label>
            <input
              type="number"
              value={formData.priceUSD}
              onChange={(e) => handleChange('priceUSD', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="0"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Este precio se usa en Calculadora ROI, Calculadora Web y Tienda
            </p>
          </div>

          {/* Precio ARS (opcional - se calcula automáticamente) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
              Precio (ARS) - Opcional
            </label>
            <input
              type="number"
              value={formData.priceARS}
              onChange={(e) => handleChange('priceARS', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Se calcula automáticamente"
              min="0"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Dejalo vacío para usar conversión automática USD→ARS
            </p>
          </div>

          {/* Cuota mensual alquiler */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
              Cuota mensual alquiler (USD)
            </label>
            <input
              type="number"
              value={formData.rentalMonthly}
              onChange={(e) => handleChange('rentalMonthly', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="0 = sin opción de alquiler"
              min="0"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              La seña se calcula automáticamente (35% del precio USD). 0 = no mostrar alquiler.
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Guardar cambios
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Portada */}
          <div className="w-full h-36 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-2">
            {images[0] ? (
              <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">Sin foto</span>
            )}
          </div>

          {/* Galería de miniaturas */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((url, idx) => (
                <div key={idx} className="relative group w-14 h-14 rounded-md overflow-hidden border border-gray-200 dark:border-neutral-700">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-indigo-600/80 text-white text-[9px] text-center leading-tight">portada</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    {idx !== 0 && (
                      <button onClick={() => makeCover(idx)} title="Poner de portada" className="text-white text-xs">★</button>
                    )}
                    <button onClick={() => removeImage(idx)} title="Quitar" className="text-white text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
            {product.name || product.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {product.description}
          </p>
          {product.ideaDesarrollo && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 line-clamp-2">{product.ideaDesarrollo}</p>
          )}

          {/* Acciones de fotos + contenido */}
          <div className="flex flex-wrap items-center gap-2 my-3">
            <button
              onClick={addPexels}
              disabled={aiBusy !== null}
              className="px-3 py-1.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {aiBusy === 'pexels' ? 'Buscando…' : '+ Foto Pexels'}
            </button>
            <button
              onClick={() => imgFileRef.current?.click()}
              disabled={aiBusy !== null}
              className="px-3 py-1.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {aiBusy === 'upload' ? 'Subiendo…' : 'Subir fotos'}
            </button>
            <input ref={imgFileRef} type="file" accept="image/*" multiple onChange={(e) => uploadFiles(e.target.files)} className="hidden" />
            <button
              onClick={generateContent}
              disabled={aiBusy !== null}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-medium disabled:opacity-50"
            >
              {aiBusy === 'content' ? 'Generando…' : 'Generar contenido'}
            </button>
            {aiMsg && <span className="text-xs text-gray-600 dark:text-gray-300 w-full">{aiMsg}</span>}
          </div>

          {/* Preview del contenido generado */}
          {gen && (
            <div className="mb-3 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 p-3 text-sm space-y-2">
              <p className="text-gray-800 dark:text-gray-200"><strong>Descripción:</strong> {gen.descripcion}</p>
              {gen.ideaDesarrollo && <p className="text-gray-700 dark:text-gray-300"><strong>Idea de desarrollo:</strong> {gen.ideaDesarrollo}</p>}
              {gen.features?.length > 0 && (
                <p className="text-gray-700 dark:text-gray-300"><strong>Features:</strong> {gen.features.join(' · ')}</p>
              )}
              {gen.tags?.length > 0 && (
                <p className="text-xs text-gray-500">Tags: {gen.tags.join(', ')}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={applyContent} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                  Aplicar y guardar
                </button>
                <button onClick={() => setGen(null)} className="px-3 py-1.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg text-xs">
                  Descartar
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              {product.priceUSD && (
                <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  USD {product.priceUSD}
                </span>
              )}
              {product.priceARS && (
                <span className="text-base font-semibold text-gray-600 dark:text-gray-300">
                  {formatARS(product.priceARS)}
                </span>
              )}
              {product.rentalMonthly > 0 && (
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  Alquiler: USD {product.rentalMonthly}/mes · Seña USD {Math.round(product.priceUSD * 0.35)}
                </span>
              )}
              {!product.priceUSD && !product.priceARS && (
                <span className="text-sm text-gray-500">Sin precio configurado</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg transition-colors text-sm font-medium"
              >
                Editar
              </button>
              <button
                onClick={() => onDelete(product.id)}
                className="px-4 py-2 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminUsersPanel({ users, formatDate }) {
  const [sendingId, setSendingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [localUsers, setLocalUsers] = useState(users);
  const [compedUids, setCompedUids] = useState(new Set());
  const [grantingId, setGrantingId] = useState(null);

  useEffect(() => { setLocalUsers(users); }, [users]);

  useEffect(() => {
    const adminPassword = sessionStorage.getItem('adminPassword');
    fetch(`/api/admin-leadfinder-access?adminPassword=${encodeURIComponent(adminPassword)}`)
      .then(r => r.json())
      .then(data => setCompedUids(new Set(data.uids || [])))
      .catch(() => {});
  }, []);

  const toggleLeadFinderAccess = async (user) => {
    const isGranted = compedUids.has(user.id);
    if (!isGranted && !confirm(`¿Dar acceso gratuito e ilimitado a Lead Finder Pro a ${user.displayName || user.email}?`)) return;
    setGrantingId(user.id);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const res = await fetch('/api/admin-leadfinder-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, uid: user.id, grant: !isGranted }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setCompedUids(prev => {
        const next = new Set(prev);
        if (isGranted) next.delete(user.id); else next.add(user.id);
        return next;
      });
    } catch (err) {
      setActionResult({ type: 'error', msg: 'Error: ' + err.message });
    } finally {
      setGrantingId(null);
    }
  };

  const resendWelcome = async (user) => {
    setSendingId(user.id);
    setActionResult(null);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'welcome',
          to: user.email,
          recipientName: user.displayName || '',
        }),
      });
      if (res.ok) {
        setActionResult({ type: 'success', msg: `Salutacion enviada a ${user.email}` });
      } else {
        const err = await res.json().catch(() => ({}));
        const detail = err.details || err.error || `HTTP ${res.status}`;
        setActionResult({ type: 'error', msg: `Error: ${detail}` });
        console.error('send-email error:', err);
      }
    } catch {
      setActionResult({ type: 'error', msg: 'Error de conexion' });
    } finally {
      setSendingId(null);
    }
  };

  const deleteUser = async (user) => {
    if (!confirm(`Eliminar a ${user.displayName || user.email} de la base de datos?\n\nEsto elimina solo el registro en Firestore, no la cuenta de Google.`)) return;

    setDeletingId(user.id);
    setActionResult(null);
    try {
      await deleteDoc(doc(db, 'users', user.id));
      // Decrementar contador de usuarios registrados en analytics
      await updateDoc(doc(db, 'analytics', 'stats'), { registeredUsers: increment(-1) }).catch(() => {});
      setLocalUsers(prev => prev.filter(u => u.id !== user.id));
      setActionResult({ type: 'success', msg: `${user.displayName || user.email} eliminado` });
    } catch (err) {
      setActionResult({ type: 'error', msg: 'Error eliminando: ' + err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Usuarios</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-2">{localUsers.length}</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Lead Finder Pro gratis</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-2">{compedUids.size}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Usuarios registrados ({localUsers.length})</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Al registrarse por primera vez, se les envia automaticamente un email de bienvenida.</p>

        {actionResult && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
            actionResult.type === 'success'
              ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
          }`}>
            {actionResult.msg}
          </div>
        )}

        <div className="space-y-3">
          {localUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm truncate flex items-center gap-1.5">
                    {user.displayName || 'Sin nombre'}
                    {compedUids.has(user.id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium">
                        Lead Finder Pro gratis
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(user.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => toggleLeadFinderAccess(user)}
                  disabled={grantingId === user.id}
                  title="Otorgar/revocar acceso gratuito a Lead Finder Pro"
                  className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-medium disabled:opacity-50 ${
                    compedUids.has(user.id)
                      ? 'border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800'
                      : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                  }`}
                >
                  {grantingId === user.id ? '...' : compedUids.has(user.id) ? 'Revocar' : 'Dar acceso gratis'}
                </button>
                <button
                  onClick={() => resendWelcome(user)}
                  disabled={sendingId === user.id}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  {sendingId === user.id ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  Reenviar salutación
                </button>
                <button
                  onClick={() => deleteUser(user)}
                  disabled={deletingId === user.id}
                  className="px-3 py-1.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-xs font-medium disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminQuestionsPanel() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending', 'answered', 'hidden', 'all'
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await firebaseQA.getAllQuestions();
      setQuestions(data);
    } catch (err) {
      console.error('Error cargando preguntas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId) => {
    if (!answerText.trim()) return;
    setSubmitting(true);
    try {
      await firebaseQA.answerQuestion(questionId, answerText.trim());
      setAnsweringId(null);
      setAnswerText('');
      await loadQuestions();
    } catch (err) {
      console.error('Error respondiendo:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHide = async (questionId) => {
    try {
      await firebaseQA.hideQuestion(questionId);
      await loadQuestions();
    } catch (err) {
      console.error('Error ocultando:', err);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = questions.filter(q => {
    if (filter === 'pending') return q.isVisible && !q.answerText;
    if (filter === 'answered') return q.isVisible && q.answerText;
    if (filter === 'hidden') return !q.isVisible;
    return true;
  });

  const pendingCount = questions.filter(q => q.isVisible && !q.answerText).length;
  const answeredCount = questions.filter(q => q.isVisible && q.answerText).length;
  const hiddenCount = questions.filter(q => !q.isVisible).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Preguntas de productos
        </h2>
        <button
          onClick={loadQuestions}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'pending', label: `Pendientes (${pendingCount})`, color: 'yellow' },
          { id: 'answered', label: `Respondidas (${answeredCount})`, color: 'green' },
          { id: 'hidden', label: `Ocultas (${hiddenCount})`, color: 'red' },
          { id: 'all', label: `Todas (${questions.length})`, color: 'gray' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de preguntas */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No hay preguntas en esta categoria
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(q => (
            <div key={q.id} className={`bg-white dark:bg-neutral-900 rounded-2xl border p-5 ${!q.isVisible ? 'opacity-50 border-red-300 dark:border-red-500/30' : 'border-gray-200 dark:border-neutral-800'}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  {q.questionAuthorPhoto ? (
                    <img src={q.questionAuthorPhoto} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                      {(q.questionAuthorName || '?')[0]}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">{q.questionAuthorName}</span>
                    <span className="text-xs text-gray-400 ml-2">{formatDate(q.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                    {q.productName || q.productId}
                  </span>
                  {q.answerText ? (
                    <span className="text-[11px] font-semibold bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Respondida</span>
                  ) : (
                    <span className="text-[11px] font-semibold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">Pendiente</span>
                  )}
                </div>
              </div>

              {/* Pregunta */}
              <p className="text-gray-700 dark:text-gray-300 mb-3">{q.questionText}</p>

              {/* Respuesta existente */}
              {q.answerText && (
                <div className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 rounded-r-xl p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{q.answeredBy || 'Mariano Aliandri'}</span>
                    <span className="text-xs text-gray-400">{formatDate(q.answeredAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{q.answerText}</p>
                </div>
              )}

              {/* Form de respuesta */}
              {answeringId === q.id ? (
                <div className="space-y-2">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Escribi tu respuesta..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAnswer(q.id)}
                      disabled={submitting || !answerText.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      {submitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Publicar Respuesta
                    </button>
                    <button
                      onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                      className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!q.answerText && q.isVisible && (
                    <button
                      onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      Responder
                    </button>
                  )}
                  {q.isVisible && (
                    <button
                      onClick={() => handleHide(q.id)}
                      className="px-3 py-1.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                    >
                      Ocultar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
