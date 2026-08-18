'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db, firebaseQA } from '../utils/firebaseservice';
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
import AuditRequestsManager from '../components/admin/AuditRequestsManager';
import SentEmailsManager from '../components/admin/SentEmailsManager';
import SubscriptionsManager from '../components/admin/SubscriptionsManager';
import StyleQuizManager from '../components/admin/StyleQuizManager';
import LeadFinderPanel from '../components/audit/LeadFinderPanel';
import { useLinkedInStatus, useLinkedInProfile, useLinkedInPosts, useLinkedInAnalytics, useLinkedInConnect, useLinkedInDisconnect } from '../hooks/useLinkedIn';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'users', label: 'Usuarios', icon: '👥' },
  { id: 'orders', label: 'Órdenes', icon: '📦' },
  { id: 'products', label: 'Productos', icon: '🛍️' },
  { id: 'social', label: 'Redes Sociales', icon: '📱' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'leads', label: 'Lead Finder', icon: '🎯' },
  { id: 'questions', label: 'Preguntas', icon: '💬' },
  { id: 'proyectos', label: 'Proyectos', icon: '🌐' },
  { id: 'zonas', label: 'Zonas', icon: '🗺️' },
  { id: 'cron', label: 'Cron Social', icon: '⏰' },
  { id: 'presupuestos', label: 'Presupuestos', icon: '💰' },
  { id: 'suscripciones', label: 'Suscripciones', icon: '🔁' },
  { id: 'auditorias', label: 'Auditorías', icon: '📋' },
  { id: 'style-quiz', label: 'Test de Estilo', icon: '🎨' },
  { id: 'audit-requests', label: 'Solicitudes SEO', icon: '🔍' },
  { id: 'emails', label: 'Emails', icon: '📧' },
];

// Secciones agrupadas por tipo (para la barra de navegación de escritorio)
const ADMIN_GROUPS = [
  { id: 'panel',     label: 'Panel',          icon: '📊', tabs: ['dashboard'] },
  { id: 'tienda',    label: 'Tienda',         icon: '🛍️', tabs: ['products', 'orders', 'presupuestos', 'suscripciones', 'users'] },
  { id: 'redes',     label: 'Redes Sociales', icon: '📱', tabs: ['social', 'linkedin', 'cron'] },
  { id: 'marketing', label: 'Marketing',      icon: '🎯', tabs: ['leads', 'zonas', 'auditorias', 'audit-requests', 'emails', 'style-quiz'] },
  { id: 'sitio',     label: 'Sitio',          icon: '🌐', tabs: ['proyectos', 'questions'] },
];

const TAB_MAP = Object.fromEntries(ADMIN_TABS.map(t => [t.id, t]));

function PresupuestosTab() {
  const [sub, setSub] = useState('solicitudes');
  const [editBudget, setEditBudget] = useState(null);

  const handleOpenInBuilder = (budget) => {
    setEditBudget(budget);
    setSub('nuevo');
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex gap-2 flex-wrap">
        {[['solicitudes', '📥 Solicitudes'], ['nuevo', '✏️ Crear presupuesto'], ['beneficios', '⚙️ Catálogo']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setSub(id); if (id === 'nuevo' && sub !== 'nuevo') setEditBudget(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              sub === id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [socialSubTab, setSocialSubTab] = useState('publicar');
  const [navOpen, setNavOpen] = useState(false);

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
      await deleteDoc(doc(db, 'products', productId));
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

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-md"
        >
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1.5 text-center">Panel de Administración</h1>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8 text-sm">Acceso restringido</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400"
                placeholder="Usuario"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Iniciar Sesión
            </button>
          </form>

          <button
            onClick={() => router.push('/')}
            className="mt-6 w-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-sm"
          >
            ← Volver al sitio
          </button>
        </motion.div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 md:flex">
      {/* Sidebar vertical agrupado por tipo */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 p-4 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-2 pb-4 mb-2 border-b border-gray-100 dark:border-neutral-800">
          <p className="text-base font-semibold text-gray-900 dark:text-white">Admin</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{username}</p>
        </div>
        <nav className="space-y-5">
          {ADMIN_GROUPS.map(group => (
            <div key={group.id}>
              <p className="px-3 mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <span>{group.icon}</span>{group.label}
              </p>
              <div className="space-y-0.5">
                {group.tabs.map(id => TAB_MAP[id]).filter(Boolean).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setNavOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Backdrop en mobile cuando el menú está abierto */}
      {navOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Columna principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-gray-200 dark:border-neutral-800">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNavOpen(v => !v)}
                aria-label="Menú"
                className="md:hidden flex flex-col gap-[3px] p-2 -ml-2 text-gray-700 dark:text-gray-200"
              >
                <span className={`block h-0.5 w-5 bg-current transition-transform ${navOpen ? 'translate-y-[5px] rotate-45' : ''}`} />
                <span className={`block h-0.5 w-5 bg-current transition-opacity ${navOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-5 bg-current transition-transform ${navOpen ? '-translate-y-[5px] -rotate-45' : ''}`} />
              </button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {(TAB_MAP[activeTab] || ADMIN_TABS[0]).label}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
              >
                🌐 <span className="hidden sm:inline">Ver sitio</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-2 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-sm font-medium"
              >
                🚪 <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Órdenes</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.totalOrders}</p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Análisis CV</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.cvAnalysis}</p>
                  </div>
                  <div className="text-4xl">📄</div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tienda</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.storeOrders}</p>
                  </div>
                  <div className="text-4xl">🛍️</div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Revenue Total</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{formatARS(stats.totalRevenue)}</p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Órdenes Recientes</h2>
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
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Todas las Órdenes ({orders.length})</h2>
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono text-sm text-gray-500 dark:text-gray-400">#{order.id.slice(-12)}</span>
                      <span className={`ml-3 px-2 py-1 rounded-full text-xs ${
                        order.type === 'cv_analysis'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      }`}>
                        {order.type === 'cv_analysis' ? 'CV Analysis' : 'Tienda'}
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      📧 Reenviar Email
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && activeTab === 'products' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Productos de la Tienda ({products.length})</h2>
              <div className="flex gap-3">
                <button
                  onClick={updateAllDescriptions}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  disabled={loading}
                >
                  📝 Actualizar Descripciones
                </button>
                <button
                  onClick={resetProducts}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                  disabled={loading}
                >
                  🔄 Resetear Productos (10)
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onUpdate={updateProduct}
                  onDelete={deleteProduct}
                  formatARS={formatARS}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && activeTab === 'social' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-neutral-800 pb-1">
              {[
                { id: 'publicar',     label: '📢 Publicar' },
                { id: 'servicios',    label: '🖼️ Servicios' },
                { id: 'estadisticas', label: '📊 Estadísticas' },
                { id: 'productos',    label: '🛍️ Productos' },
                { id: 'proyectos',    label: '📁 Proyectos' },
                { id: 'reel',         label: '🎬 Reel' },
                { id: 'labs',         label: '🧪 Labs' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSocialSubTab(sub.id)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                    socialSubTab === sub.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            {socialSubTab === 'publicar'     && <SocialMediaDashboard key="publicar"     initialTab="custom" />}
            {socialSubTab === 'servicios'    && <SocialPublisher />}
            {socialSubTab === 'estadisticas' && <SocialMediaDashboard key="estadisticas" initialTab="statistics" />}
            {socialSubTab === 'productos'    && <SocialMediaDashboard key="productos"    initialTab="products" />}
            {socialSubTab === 'proyectos'    && <SocialMediaDashboard key="proyectos"    initialTab="proyectos" />}
            {socialSubTab === 'reel'         && <CanvasReelGenerator />}
            {socialSubTab === 'labs'         && <LabsPublisher />}
          </div>
        )}

        {!loading && activeTab === 'linkedin' && (
          <LinkedInPanel />
        )}

        {activeTab === 'leads' && (
          <LeadFinderPanel />
        )}

        {!loading && activeTab === 'questions' && (
          <AdminQuestionsPanel />
        )}

        {activeTab === 'proyectos' && (
          <AdminProyectosPanel db={db} />
        )}

        {activeTab === 'zonas' && (
          <div className="p-6">
            <ZoneAnalysis />
          </div>
        )}
        {activeTab === 'cron' && (
          <div className="p-6">
            <CronScheduler />
          </div>
        )}
        {activeTab === 'presupuestos' && (
          <PresupuestosTab />
        )}
        {activeTab === 'suscripciones' && (
          <div className="p-6">
            <SubscriptionsManager />
          </div>
        )}
        {activeTab === 'auditorias' && (
          <div className="p-6">
            <AuditoriasManager />
          </div>
        )}
        {activeTab === 'style-quiz' && (
          <div className="p-6">
            <StyleQuizManager />
          </div>
        )}
        {activeTab === 'audit-requests' && (
          <AuditRequestsManager />
        )}
        {activeTab === 'emails' && (
          <div className="p-6">
            <SentEmailsManager />
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

// Panel de edición de Proyectos
const EMPTY_EDIT = { descripcionCorta: '', stack: '', funcionalidades: '', impacto: '', orden: 99, visible: true };

function AdminProyectosPanel({ db }) {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [edits, setEdits] = useState({});
  const [expanded, setExpanded] = useState({});
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState(null);

  useEffect(() => {
    fetch('/api/proyectos')
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setField = (domain, field, value) =>
    setEdits(prev => ({ ...prev, [domain]: { ...prev[domain], [field]: value } }));

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

  if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Proyectos — desde Google Search Console
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{proyectos.length} sitios detectados</span>
          <button
            onClick={async () => {
              setCapturing(true);
              setCaptureResult(null);
              try {
                const res = await fetch('/api/capture-projects', { method: 'POST' });
                const data = await res.json();
                setCaptureResult(data);
              } catch (e) {
                setCaptureResult({ error: e.message });
              } finally {
                setCapturing(false);
              }
            }}
            disabled={capturing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {capturing ? '📸 Capturando...' : '📸 Capturar screenshots'}
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

      {proyectos.map(p => {
        const e = edits[p.domain] || EMPTY_EDIT;
        const isSaving = saving === p.domain;
        const isOpen = !!expanded[p.domain];
        return (
          <div key={p.domain} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            {/* Header colapsable */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setExpanded(prev => ({ ...prev, [p.domain]: !prev[p.domain] }))}
            >
              <div className="flex items-center gap-3">
                <img
                  src={p.screenshotUrl}
                  alt={p.domain}
                  className="w-14 h-9 object-cover rounded border border-gray-200 dark:border-gray-600"
                  onError={ev => { ev.target.style.display = 'none'; }}
                />
                <div className="text-left">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{p.domain}</span>
                  <div className="text-xs text-gray-500 mt-0.5">{p.clicks} clicks · {p.impressions} imp. · orden {e.orden}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {e.descripcionCorta && (
                  <span className="hidden sm:block text-xs text-green-600 dark:text-green-400 font-medium">Completo</span>
                )}
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Contenido expandido */}
            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-neutral-800 pt-4">

                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Descripción corta</label>
                  <textarea
                    rows={2}
                    value={e.descripcionCorta}
                    onChange={ev => setField(p.domain, 'descripcionCorta', ev.target.value)}
                    placeholder="→ Sitio de ventas de viviendas modulares que convierte visitas en leads calificados..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Stack técnico</label>
                  <textarea
                    rows={2}
                    value={e.stack}
                    onChange={ev => setField(p.domain, 'stack', ev.target.value)}
                    placeholder="→ React 19 + Vite · Tailwind CSS · Framer Motion · Google Gemini · Supabase..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Funcionalidades destacadas</label>
                  <textarea
                    rows={5}
                    value={e.funcionalidades}
                    onChange={ev => setField(p.domain, 'funcionalidades', ev.target.value)}
                    placeholder={"→ Chatbot de ventas con IA — asesora al cliente y captura leads\n→ Catálogo interactivo con filtros en tiempo real\n→ SEO híbrido SPA + HTML estático"}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Dato de impacto</label>
                  <textarea
                    rows={2}
                    value={e.impacto}
                    onChange={ev => setField(p.domain, 'impacto', ev.target.value)}
                    placeholder="→ 97/100 de salud SEO en Ahrefs, indexado en GSC con presencia en búsquedas de..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Orden</label>
                    <input
                      type="number"
                      value={e.orden}
                      min={0}
                      onChange={ev => setField(p.domain, 'orden', ev.target.value)}
                      className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
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
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
            </button>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {connectMutation.isPending ? 'Conectando...' : 'Conectar LinkedIn'}
            </button>
          )}
        </div>
      </div>

      {/* Perfil */}
      {isConnected && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Perfil</h3>
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
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Posts Recientes {postsData?.total ? `(${postsData.total})` : ''}
          </h3>
          {postsLoading ? (
            <p className="text-sm text-gray-500 animate-pulse">Cargando posts...</p>
          ) : postsData?.posts?.length > 0 ? (
            <div className="space-y-3">
              {postsData.posts.map((post, i) => (
                <div key={post.id || i} className="border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{post.text || '(Sin texto)'}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {post.created && (
                      <span>{new Date(post.created).toLocaleDateString('es-AR')}</span>
                    )}
                    {post.hasMedia && <span>📎 Con media</span>}
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
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Analytics</h3>
          {analyticsData.available ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Se llenará cuando Marketing Developer Platform esté aprobada */}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 dark:bg-neutral-950/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">{analyticsData.message}</p>
              <a
                href="https://www.linkedin.com/developers/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Ir a LinkedIn Developers
              </a>
            </div>
          )}
        </div>
      )}

      {/* Info si no está conectado */}
      {!isConnected && !status?.expired && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">Como conectar LinkedIn</h3>
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

function ProductCard({ product, onUpdate, onDelete, formatARS }) {
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

  return (
    <div className="border border-gray-200 dark:border-neutral-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      {editing ? (
        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título del Producto
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Desarrollo Web Premium"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Descripción del producto..."
            />
          </div>

          {/* Precio USD (principal) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              💵 Precio (USD) - Principal
            </label>
            <input
              type="number"
              value={formData.priceUSD}
              onChange={(e) => handleChange('priceUSD', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              💰 Precio (ARS) - Opcional
            </label>
            <input
              type="number"
              value={formData.priceARS}
              onChange={(e) => handleChange('priceARS', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Se calcula automáticamente"
              min="0"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Dejalo vacío para usar conversión automática USD→ARS
            </p>
          </div>

          {/* Cuota mensual alquiler */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              🏠 Cuota Mensual Alquiler (USD)
            </label>
            <input
              type="number"
              value={formData.rentalMonthly}
              onChange={(e) => handleChange('rentalMonthly', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              💾 Guardar Cambios
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {product.name || product.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {product.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              {product.priceUSD && (
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  USD {product.priceUSD}
                </span>
              )}
              {product.priceARS && (
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {formatARS(product.priceARS)}
                </span>
              )}
              {product.rentalMonthly > 0 && (
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  🏠 Alquiler: USD {product.rentalMonthly}/mes · Seña USD {Math.round(product.priceUSD * 0.35)}
                </span>
              )}
              {!product.priceUSD && !product.priceARS && (
                <span className="text-sm text-gray-500">Sin precio configurado</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => onDelete(product.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                🗑️ Eliminar
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

  useEffect(() => { setLocalUsers(users); }, [users]);

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
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Usuarios Registrados ({localUsers.length})</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Al registrarse por primera vez, se les envia automaticamente un email de bienvenida.</p>

        {actionResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            actionResult.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {actionResult.msg}
          </div>
        )}

        <div className="space-y-3">
          {localUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-neutral-800 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{user.displayName || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(user.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => resendWelcome(user)}
                  disabled={sendingId === user.id}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  {sendingId === user.id ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  Reenviar Salutacion
                </button>
                <button
                  onClick={() => deleteUser(user)}
                  disabled={deletingId === user.id}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium disabled:opacity-50"
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Preguntas de Productos
        </h2>
        <button
          onClick={loadQuestions}
          className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-neutral-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
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
            <div key={q.id} className={`bg-white dark:bg-neutral-900 rounded-lg border p-4 ${!q.isVisible ? 'opacity-50 border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-neutral-800'}`}>
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
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {q.productName || q.productId}
                  </span>
                  {q.answerText ? (
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">Respondida</span>
                  ) : (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">Pendiente</span>
                  )}
                </div>
              </div>

              {/* Pregunta */}
              <p className="text-gray-700 dark:text-gray-300 mb-3">{q.questionText}</p>

              {/* Respuesta existente */}
              {q.answerText && (
                <div className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 rounded-r-lg p-3 mb-3">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
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
