// src/utils/firebaseService.js
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as limitQuery
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';

// 🔥 CONFIGURACIÓN DE FIREBASE - MARIANO ALIANDRI (FIRESTORE)
// Las credenciales se cargan desde variables de entorno (.env)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase con Firestore y Auth
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Firebase Analytics (GA4) — solo en browser, isSupported() descarta SSR y
// navegadores sin soporte (ej. bloqueadores de tracking). analyticsPromise se
// resuelve una sola vez y las llamadas a trackGAEvent quedan encoladas hasta
// entonces, sin perder eventos disparados apenas carga la página.
const analyticsPromise = typeof window !== 'undefined'
  ? isSupported().then(supported => (supported ? getAnalytics(app) : null)).catch(() => null)
  : Promise.resolve(null);

// Evento genérico de GA4 — page_view, clicks en CTAs, etc. No hace nada si
// Analytics no está disponible (SSR, bloqueador, measurementId sin configurar).
export function trackGAEvent(eventName, params = {}) {
  analyticsPromise.then(analytics => {
    if (analytics) logEvent(analytics, eventName, params);
  });
}

// Clase para manejar analytics de tu portfolio con Firestore
export class FirebaseAnalyticsService {
  constructor() {
    this.db = db;
    console.log('🔥 Firebase Firestore inicializado para Portfolio Mariano Aliandri');
  }

  // Generar ID único para cada visitante
  getVisitorId() {
    let visitorId = localStorage.getItem('marianoPortfolioVisitorId');
    if (!visitorId) {
      visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('marianoPortfolioVisitorId', visitorId);
    }
    return visitorId;
  }

  // Asegura que exista el documento de estadísticas
  async ensureStatsDoc() {
    const statsRef = doc(this.db, 'analytics', 'stats');
    const snap = await getDoc(statsRef);
    if (!snap.exists()) {
      await setDoc(
        statsRef,
        { totalVisits: 0, uniqueVisitors: 0, likes: 0, dislikes: 0 },
        { merge: true }
      );
    }
  }

  // Registrar una visita al portfolio
  async recordVisit() {
    try {
      const visitId = this.getVisitorId();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      await this.ensureStatsDoc();

      console.log('📊 Registrando visita...', visitId);

      // Referencia al documento de estadísticas
      const statsRef = doc(this.db, 'analytics', 'stats');

      // Obtener estadísticas actuales
      const statsDoc = await getDoc(statsRef);

      if (statsDoc.exists()) {
        // Incrementar visitas totales
        await updateDoc(statsRef, {
          totalVisits: increment(1)
        });
      } else {
        // Crear documento inicial (backup si otro cliente aún no lo creó)
        await setDoc(statsRef, {
          totalVisits: 1,
          uniqueVisitors: 0,
          likes: 0,
          dislikes: 0
        });
      }

      // Verificar si es visitante único
      const visitorRef = doc(this.db, 'visitors', visitId);
      const visitorDoc = await getDoc(visitorRef);

      if (!visitorDoc.exists()) {
        // Nuevo visitante
        await setDoc(visitorRef, {
          firstVisit: serverTimestamp(),
          visitCount: 1,
          lastVisit: serverTimestamp(),
          userAgent: navigator.userAgent.substring(0, 100),
          date: today
        });

        // Incrementar visitantes únicos
        await updateDoc(statsRef, {
          uniqueVisitors: increment(1)
        });
        console.log('✨ Nuevo visitante registrado');
      } else {
        // Visitante que regresa
        await updateDoc(visitorRef, {
          visitCount: increment(1),
          lastVisit: serverTimestamp()
        });
        console.log('🔄 Visitante recurrente');
      }

      console.log('✅ Visita registrada correctamente en Firestore');
    } catch (error) {
      console.error('❌ Error registrando visita:', error);
      throw error;
    }
  }

  // Manejar likes y dislikes del portfolio (ATÓMICO con transacciones)
  async handleVote(voteType) {
    try {
      const userId = this.getVisitorId();
      const userVoteRef = doc(this.db, 'userVotes', userId);
      const statsRef = doc(this.db, 'analytics', 'stats');

      // Asegurar doc de estadísticas
      await this.ensureStatsDoc();

      let resultType = null;

      await runTransaction(this.db, async (tx) => {
        const [voteSnap, statsSnap] = await Promise.all([
          tx.get(userVoteRef),
          tx.get(statsRef)
        ]);

        if (!statsSnap.exists()) {
          tx.set(statsRef, { totalVisits: 0, uniqueVisitors: 0, likes: 0, dislikes: 0 });
        }

        const prev = voteSnap.exists() ? (voteSnap.data().type || null) : null;

        // Quitar el mismo voto
        if (prev === voteType) {
          resultType = null;
          tx.set(
            userVoteRef,
            { type: null, timestamp: serverTimestamp() },
            { merge: true }
          );
          if (voteType === 'like') tx.update(statsRef, { likes: increment(-1) });
          else tx.update(statsRef, { dislikes: increment(-1) });
          return;
        }

        // Cambiar voto (like -> dislike o viceversa)
        if (prev && prev !== voteType) {
          if (prev === 'like') {
            tx.update(statsRef, { likes: increment(-1), dislikes: increment(1) });
          } else {
            tx.update(statsRef, { dislikes: increment(-1), likes: increment(1) });
          }
          tx.set(
            userVoteRef,
            { type: voteType, timestamp: serverTimestamp(), previousVote: prev },
            { merge: true }
          );
          resultType = voteType;
          return;
        }

        // Voto nuevo
        if (!prev) {
          if (voteType === 'like') tx.update(statsRef, { likes: increment(1) });
          else tx.update(statsRef, { dislikes: increment(1) });
          tx.set(
            userVoteRef,
            { type: voteType, timestamp: serverTimestamp() },
            { merge: true }
          );
          resultType = voteType;
        }
      });

      console.log(`✅ Voto aplicado:`, resultType);
      return resultType;
    } catch (error) {
      console.error('❌ Error en votación (tx):', error);
      throw error;
    }
  }

  // Obtener estadísticas del portfolio
  async getStats() {
    try {
      const statsRef = doc(this.db, 'analytics', 'stats');
      const statsDoc = await getDoc(statsRef);

      if (statsDoc.exists()) {
        const data = statsDoc.data();
        console.log('📊 Estadísticas cargadas:', data);
        return {
          totalVisits: data.totalVisits || 0,
          uniqueVisitors: data.uniqueVisitors || 0,
          likes: data.likes || 0,
          dislikes: data.dislikes || 0,
          registeredUsers: data.registeredUsers || 0
        };
      } else {
        console.log('📊 No hay estadísticas aún, inicializando...');
        // Crear documento inicial
        await setDoc(statsRef, {
          totalVisits: 0,
          uniqueVisitors: 0,
          likes: 0,
          dislikes: 0,
          registeredUsers: 0
        });
        return {
          totalVisits: 0,
          uniqueVisitors: 0,
          likes: 0,
          dislikes: 0,
          registeredUsers: 0
        };
      }
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        totalVisits: 0,
        uniqueVisitors: 0,
        likes: 0,
        dislikes: 0,
        registeredUsers: 0
      };
    }
  }

  // Obtener voto del usuario actual
  async getUserVote() {
    try {
      const userId = this.getVisitorId();
      const userVoteRef = doc(this.db, 'userVotes', userId);
      const userVoteDoc = await getDoc(userVoteRef);

      const vote = userVoteDoc.exists() ? userVoteDoc.data().type : null;
      console.log('🗳️ Voto del usuario:', vote);
      return vote;
    } catch (error) {
      console.error('❌ Error obteniendo voto:', error);
      return null;
    }
  }

  // Suscribirse a cambios en tiempo real de estadísticas
  subscribeToStats(callback) {
    try {
      const statsRef = doc(this.db, 'analytics', 'stats');

      const unsubscribe = onSnapshot(
        statsRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const stats = {
              totalVisits: data.totalVisits || 0,
              uniqueVisitors: data.uniqueVisitors || 0,
              likes: data.likes || 0,
              dislikes: data.dislikes || 0,
              registeredUsers: data.registeredUsers || 0
            };
            console.log('📊 Estadísticas actualizadas en tiempo real:', stats);
            callback(stats);
          }
        },
        (error) => {
          console.error('❌ Error en suscripción a estadísticas:', error);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error creando suscripción:', error);
      return () => {}; // cleanup vacío
    }
  }

  // Registrar evento de calculadora ROI
  async trackROICalculation(company, result) {
    try {
      const eventRef = doc(this.db, 'events', `roi_${Date.now()}`);
      await setDoc(eventRef, {
        type: 'roi_calculation',
        company: company,
        roi: result.roi,
        savings: result.annualSavings,
        timestamp: serverTimestamp(),
        visitorId: this.getVisitorId()
      });
      console.log('📊 Calculación ROI registrada en Firestore');
    } catch (error) {
      console.error('❌ Error registrando evento ROI:', error);
    }
  }

  // Registrar evento de calculadora Web
  async trackWebCalculation(company, result) {
    try {
      const eventRef = doc(this.db, 'events', `web_${Date.now()}`);
      await setDoc(eventRef, {
        type: 'web_calculation',
        company: company,
        cost: result.developmentCost,
        roi: result.roi,
        timestamp: serverTimestamp(),
        visitorId: this.getVisitorId()
      });
      console.log('🌐 Calculación Web registrada en Firestore');
    } catch (error) {
      console.error('❌ Error registrando evento Web:', error);
    }
  }

  // Registrar visita a una página
  async trackPageView(pagePath, pageTitle = '') {
    try {
      const visitId = this.getVisitorId();
      const eventRef = doc(this.db, 'pageViews', `${visitId}_${Date.now()}`);

      await setDoc(eventRef, {
        path: pagePath,
        title: pageTitle,
        timestamp: serverTimestamp(),
        visitorId: visitId,
        userAgent: navigator.userAgent.substring(0, 100)
      });

      // Incrementar contador de la página en documento agregado
      const pageStatsRef = doc(this.db, 'pageStats', pagePath.replace(/\//g, '_'));
      const pageStatsDoc = await getDoc(pageStatsRef);

      if (pageStatsDoc.exists()) {
        await updateDoc(pageStatsRef, {
          views: increment(1),
          lastView: serverTimestamp()
        });
      } else {
        await setDoc(pageStatsRef, {
          path: pagePath,
          title: pageTitle,
          views: 1,
          lastView: serverTimestamp()
        });
      }

      console.log('📄 Vista de página registrada:', pagePath);
    } catch (error) {
      console.error('❌ Error registrando vista de página:', error);
    }
  }

  // Registrar visita a un producto
  async trackProductView(productId, productName) {
    try {
      const visitId = this.getVisitorId();
      const eventRef = doc(this.db, 'productViews', `${visitId}_${productId}_${Date.now()}`);

      await setDoc(eventRef, {
        productId: productId,
        productName: productName,
        timestamp: serverTimestamp(),
        visitorId: visitId
      });

      // Incrementar contador del producto
      const productStatsRef = doc(this.db, 'productStats', productId);
      const productStatsDoc = await getDoc(productStatsRef);

      if (productStatsDoc.exists()) {
        await updateDoc(productStatsRef, {
          views: increment(1),
          lastView: serverTimestamp()
        });
      } else {
        await setDoc(productStatsRef, {
          productId: productId,
          productName: productName,
          views: 1,
          lastView: serverTimestamp()
        });
      }

      console.log('🛍️ Vista de producto registrada:', productName);
    } catch (error) {
      console.error('❌ Error registrando vista de producto:', error);
    }
  }

  // Obtener páginas más visitadas
  async getTopPages(limit = 10) {
    try {
      const { collection, query, orderBy, limit: limitQuery, getDocs } = await import('firebase/firestore');

      const pagesRef = collection(this.db, 'pageStats');
      const q = query(pagesRef, orderBy('views', 'desc'), limitQuery(limit));
      const snapshot = await getDocs(q);

      const topPages = [];
      snapshot.forEach((doc) => {
        topPages.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('📊 Páginas más visitadas cargadas:', topPages.length);
      return topPages;
    } catch (error) {
      console.error('❌ Error obteniendo páginas más visitadas:', error);
      return [];
    }
  }

  // Obtener productos más visitados
  async getTopProducts(limit = 10) {
    try {
      const { collection, query, orderBy, limit: limitQuery, getDocs } = await import('firebase/firestore');

      const productsRef = collection(this.db, 'productStats');
      const q = query(productsRef, orderBy('views', 'desc'), limitQuery(limit));
      const snapshot = await getDocs(q);

      const topProducts = [];
      snapshot.forEach((doc) => {
        topProducts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('📊 Productos más visitados cargados:', topProducts.length);
      return topProducts;
    } catch (error) {
      console.error('❌ Error obteniendo productos más visitados:', error);
      return [];
    }
  }

  // Obtener total de usuarios registrados con Google
  async getRegisteredUsersCount() {
    try {
      const { collection, getDocs } = await import('firebase/firestore');

      const usersRef = collection(this.db, 'users');
      const snapshot = await getDocs(usersRef);

      const count = snapshot.size;
      console.log('👥 Total de usuarios registrados:', count);
      return count;
    } catch (error) {
      console.error('❌ Error obteniendo conteo de usuarios:', error);
      return 0;
    }
  }

  // Obtener estadísticas completas (extendidas)
  async getExtendedStats() {
    try {
      const [basicStats, topPages, topProducts] = await Promise.all([
        this.getStats(),
        this.getTopPages(5),
        this.getTopProducts(5)
      ]);

      return {
        ...basicStats,
        topPages,
        topProducts
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas extendidas:', error);
      return {
        totalVisits: 0,
        uniqueVisitors: 0,
        likes: 0,
        dislikes: 0,
        topPages: [],
        topProducts: [],
        registeredUsers: 0
      };
    }
  }
}

// Crear instancia global
export const firebaseAnalytics = new FirebaseAnalyticsService();

// ========================================
// 🔐 SERVICIO DE AUTENTICACIÓN CON GOOGLE
// ========================================

export class FirebaseAuthService {
  constructor() {
    this.auth = auth;
    this.googleProvider = googleProvider;
    this.db = db;
    console.log('🔐 Firebase Auth inicializado para Portfolio Mariano Aliandri');
  }

  // Verificar resultado de redirect al cargar la página
  async checkRedirectResult() {
    try {
      const result = await getRedirectResult(this.auth);
      if (result && result.user) {
        console.log('✅ Login con redirect exitoso:', result.user.displayName);
        const user = result.user;

        try {
          const userRef = doc(this.db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const isNewUser = !userSnap.exists();

          if (isNewUser) {
            await setDoc(userRef, {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              lastLogin: serverTimestamp(),
              createdAt: serverTimestamp(),
              welcomeEmailSent: false
            });
            // Incrementar contador de usuarios registrados en analytics
            const statsRef = doc(this.db, 'analytics', 'stats');
            await updateDoc(statsRef, { registeredUsers: increment(1) }).catch(() => {});
          } else {
            await setDoc(userRef, {
              displayName: user.displayName,
              photoURL: user.photoURL,
              lastLogin: serverTimestamp()
            }, { merge: true });
          }

          if (isNewUser) {
            this._sendWelcomeEmail(user.displayName, user.email, userRef);
          }

          console.log(`✅ Datos de usuario ${isNewUser ? 'creados' : 'actualizados'} en Firestore`);
        } catch (firestoreError) {
          console.warn('⚠️ No se pudieron guardar datos en Firestore:', firestoreError.message);
        }

        return { success: true, user: result.user };
      }
      return { success: true, user: null };
    } catch (error) {
      console.error('❌ Error en redirect result:', error);
      return { success: false, error: error.message };
    }
  }

  // Login con Google (Popup)
  async loginWithGoogle() {
    try {
      console.log('🔑 Iniciando login con Google (popup)...');
      const result = await signInWithPopup(this.auth, this.googleProvider);
      const user = result.user;

      // Verificar si es primer login y guardar datos
      try {
        const userRef = doc(this.db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const isNewUser = !userSnap.exists();

        if (isNewUser) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: serverTimestamp(),
            createdAt: serverTimestamp(),
            welcomeEmailSent: false
          });
          // Incrementar contador de usuarios registrados en analytics
          const statsRef = doc(this.db, 'analytics', 'stats');
          await updateDoc(statsRef, { registeredUsers: increment(1) }).catch(() => {});
        } else {
          await setDoc(userRef, {
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: serverTimestamp()
          }, { merge: true });
        }

        // Enviar email de bienvenida si es nuevo usuario
        if (isNewUser) {
          this._sendWelcomeEmail(user.displayName, user.email, userRef);
        }

        console.log(`✅ Datos de usuario ${isNewUser ? 'creados' : 'actualizados'} en Firestore`);
      } catch (firestoreError) {
        console.warn('⚠️ No se pudieron guardar datos en Firestore:', firestoreError.message);
      }

      console.log('✅ Login exitoso:', user.displayName);
      return {
        success: true,
        user: {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        }
      };
    } catch (error) {
      console.error('❌ Error en login popup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Enviar email de bienvenida (no bloqueante)
  async _sendWelcomeEmail(name, email, userRef) {
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'welcome',
          to: email,
          recipientName: name,
        }),
      });
      if (res.ok) {
        await setDoc(userRef, { welcomeEmailSent: true }, { merge: true });
        console.log('📧 Email de bienvenida enviado a', email);
      }
    } catch (err) {
      console.warn('⚠️ Error enviando email de bienvenida:', err.message);
    }
  }

  // Login con Google (Redirect) - Más confiable en producción
  async loginWithGoogleRedirect() {
    try {
      console.log('🔑 Iniciando login con Google (redirect)...');
      await signInWithRedirect(this.auth, this.googleProvider);
      // El redirect ocurre aquí, el código siguiente no se ejecuta
      return { success: true };
    } catch (error) {
      console.error('❌ Error en login redirect:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Logout
  async logout() {
    try {
      await signOut(this.auth);
      console.log('👋 Logout exitoso');
      return { success: true };
    } catch (error) {
      console.error('❌ Error en logout:', error);
      return { success: false, error: error.message };
    }
  }

  // Obtener usuario actual
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // Escuchar cambios en el estado de autenticación
  onAuthChange(callback) {
    return onAuthStateChanged(this.auth, (user) => {
      if (user) {
        console.log('👤 Usuario autenticado:', user.displayName);
        callback({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
      } else {
        console.log('👤 Usuario no autenticado');
        callback(null);
      }
    });
  }

  // Obtener datos completos del usuario desde Firestore
  async getUserData(uid) {
    try {
      const userRef = doc(this.db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo datos del usuario:', error);
      return null;
    }
  }
}

// Crear instancia global de autenticación
export const firebaseAuth = new FirebaseAuthService();

// ===== SERVICIO DE PREGUNTAS Y RESPUESTAS =====
class FirebaseQAService {
  constructor() {
    this.db = db;
  }

  async submitQuestion(productId, productName, questionText, user) {
    if (!user) throw new Error('Usuario no autenticado');
    if (questionText.length < 10 || questionText.length > 500) {
      throw new Error('La pregunta debe tener entre 10 y 500 caracteres');
    }

    const ref = await addDoc(collection(this.db, 'productQuestions'), {
      productId,
      productName,
      questionText,
      questionAuthorUid: user.uid,
      questionAuthorName: user.displayName || 'Usuario',
      questionAuthorPhoto: user.photoURL || '',
      createdAt: serverTimestamp(),
      answerText: null,
      answeredAt: null,
      answeredBy: null,
      isVisible: true
    });

    return ref;
  }

  async getQuestionsByProduct(productId, maxResults = 50) {
    const q = query(
      collection(this.db, 'productQuestions'),
      where('productId', '==', productId),
      where('isVisible', '==', true),
      orderBy('createdAt', 'desc'),
      limitQuery(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async answerQuestion(questionId, answerText) {
    await updateDoc(doc(this.db, 'productQuestions', questionId), {
      answerText,
      answeredAt: serverTimestamp(),
      answeredBy: 'Mariano Aliandri'
    });
  }

  async hideQuestion(questionId) {
    await updateDoc(doc(this.db, 'productQuestions', questionId), {
      isVisible: false
    });
  }

  async getAllQuestions() {
    const q = query(
      collection(this.db, 'productQuestions'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export const firebaseQA = new FirebaseQAService();

// Exportar db para uso directo en páginas
export { db };
