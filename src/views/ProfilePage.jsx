'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { firebaseAuth } from '../utils/firebaseservice';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseservice';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [profileData, setProfileData] = useState({
    profession: '',
    birthDate: '',
    countryOrigin: '',
    countryResidence: '',
    currentJob: '',
    dependents: '',
    phone: '',
    linkedin: '',
    interests: [],
    hobbies: []
  });

  const interestOptions = [
    'Desarrollo Web', 'Data Analytics', 'Inteligencia Artificial',
    'Marketing Digital', 'E-commerce', 'Automatización',
    'Power BI', 'Python', 'Consultoría', 'ROI'
  ];

  const hobbyOptions = [
    'Tecnología', 'Lectura', 'Deportes', 'Música',
    'Cine', 'Fotografía', 'Gaming', 'Viajes'
  ];

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthChange(async (userData) => {
      setUser(userData);
      if (userData) {
        // Cargar datos del perfil desde Firestore
        try {
          const userDocRef = doc(db, 'users', userData.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfileData({
              profession: data.profession || '',
              birthDate: data.birthDate || '',
              countryOrigin: data.countryOrigin || '',
              countryResidence: data.countryResidence || '',
              currentJob: data.currentJob || '',
              dependents: data.dependents || '',
              phone: data.phone || '',
              linkedin: data.linkedin || '',
              interests: data.interests || [],
              hobbies: data.hobbies || []
            });
          }
        } catch (error) {
          console.error('Error cargando perfil:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const toggleArrayItem = (array, item) => {
    if (profileData[array].includes(item)) {
      setProfileData(prev => ({
        ...prev,
        [array]: prev[array].filter(i => i !== item)
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [array]: [...prev[array], item]
      }));
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        ...profileData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setMessage({ type: 'success', text: 'Perfil actualizado correctamente!' });

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Error guardando perfil:', error);
      setMessage({ type: 'error', text: 'Error al guardar. Por favor, intentá de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Necesitás iniciar sesión
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Por favor, iniciá sesión para ver tu perfil
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Botón de cierre */}
      <button
        onClick={() => router.push('/')}
        className="fixed top-6 left-6 z-50 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        title="Volver al inicio"
      >
        <svg
          className="w-6 h-6 text-gray-600 dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-6">
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-24 h-24 rounded-full border-4 border-blue-600"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {user.displayName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Datos proporcionados por Google
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Información Personal
          </h2>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profesión */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Profesión Actual
              </label>
              <input
                type="text"
                name="profession"
                value={profileData.profession}
                onChange={handleChange}
                placeholder="Ej: Desarrollador Full Stack"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                name="birthDate"
                value={profileData.birthDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* País de origen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                País de Origen
              </label>
              <input
                type="text"
                name="countryOrigin"
                value={profileData.countryOrigin}
                onChange={handleChange}
                placeholder="Ej: Argentina"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* País de residencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                País de Residencia
              </label>
              <input
                type="text"
                name="countryResidence"
                value={profileData.countryResidence}
                onChange={handleChange}
                placeholder="Ej: Argentina"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Empleo actual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Empresa/Empleo Actual
              </label>
              <input
                type="text"
                name="currentJob"
                value={profileData.currentJob}
                onChange={handleChange}
                placeholder="Ej: Tech Solutions SA"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Personas a cargo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Personas a Cargo
              </label>
              <input
                type="number"
                name="dependents"
                value={profileData.dependents}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                name="phone"
                value={profileData.phone}
                onChange={handleChange}
                placeholder="+54 9 11 1234-5678"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Perfil de LinkedIn
              </label>
              <input
                type="url"
                name="linkedin"
                value={profileData.linkedin}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/tu-perfil"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
          </div>

          {/* Intereses */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Intereses Profesionales
            </label>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleArrayItem('interests', interest)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    profileData.interests.includes(interest)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {/* Hobbies */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Hobbies e Intereses Personales
            </label>
            <div className="flex flex-wrap gap-2">
              {hobbyOptions.map((hobby) => (
                <button
                  key={hobby}
                  type="button"
                  onClick={() => toggleArrayItem('hobbies', hobby)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    profileData.hobbies.includes(hobby)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {hobby}
                </button>
              ))}
            </div>
          </div>

          {/* Botón guardar */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
