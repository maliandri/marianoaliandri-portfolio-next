/**
 * Buffer API Service
 * Servicio completo para integración con Buffer API
 * Incluye: publicación, programación, analytics, gestión de cuentas
 */

class BufferService {
  constructor() {
    this.baseURL = 'https://api.bufferapp.com/1';
    this.accessToken = process.env.NEXT_PUBLIC_BUFFER_ACCESS_TOKEN;
    this.profiles = null; // Cache de perfiles conectados
  }

  /**
   * Realiza peticiones HTTP a la API de Buffer
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}.json`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    // Agregar access_token como parámetro de query
    const separator = url.includes('?') ? '&' : '?';
    const fullURL = `${url}${separator}access_token=${this.accessToken}`;

    try {
      const response = await fetch(fullURL, config);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Buffer API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Buffer API Error:', error);
      throw error;
    }
  }

  /**
   * 1. GESTIÓN DE PERFILES
   */

  // Obtener información del usuario
  async getUser() {
    return await this.request('/user');
  }

  // Obtener perfiles de redes sociales conectados
  async getProfiles(forceRefresh = false) {
    if (this.profiles && !forceRefresh) {
      return this.profiles;
    }

    this.profiles = await this.request('/profiles');
    return this.profiles;
  }

  // Obtener perfil específico por ID
  async getProfile(profileId) {
    return await this.request(`/profiles/${profileId}`);
  }

  // Obtener perfiles por tipo de red social
  async getProfilesByService(service) {
    const profiles = await this.getProfiles();
    return profiles.filter(profile => profile.service === service);
  }

  /**
   * 2. PUBLICACIÓN DE CONTENIDO
   */

  // Publicar inmediatamente
  async publishNow(profileIds, text, options = {}) {
    const body = {
      text,
      profile_ids: Array.isArray(profileIds) ? profileIds : [profileIds],
      now: true,
      ...options
    };

    return await this.request('/updates/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Programar publicación
  async schedulePost(profileIds, text, scheduledAt, options = {}) {
    const body = {
      text,
      profile_ids: Array.isArray(profileIds) ? profileIds : [profileIds],
      scheduled_at: scheduledAt, // Unix timestamp
      ...options
    };

    return await this.request('/updates/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Agregar a la cola (Buffer decide cuándo publicar)
  async addToQueue(profileIds, text, options = {}) {
    const body = {
      text,
      profile_ids: Array.isArray(profileIds) ? profileIds : [profileIds],
      ...options
    };

    return await this.request('/updates/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Publicar con imagen
  async publishWithMedia(profileIds, text, mediaUrls, options = {}) {
    const body = {
      text,
      profile_ids: Array.isArray(profileIds) ? profileIds : [profileIds],
      media: {
        photo: Array.isArray(mediaUrls) ? mediaUrls[0] : mediaUrls,
      },
      ...options
    };

    return await this.request('/updates/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Publicar con link
  async publishWithLink(profileIds, text, link, options = {}) {
    const body = {
      text,
      profile_ids: Array.isArray(profileIds) ? profileIds : [profileIds],
      media: {
        link,
      },
      ...options
    };

    return await this.request('/updates/create', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * 3. GESTIÓN DE PUBLICACIONES
   */

  // Obtener publicación específica
  async getUpdate(updateId) {
    return await this.request(`/updates/${updateId}`);
  }

  // Obtener publicaciones pendientes
  async getPendingUpdates(profileId) {
    return await this.request(`/profiles/${profileId}/updates/pending`);
  }

  // Obtener publicaciones enviadas
  async getSentUpdates(profileId) {
    return await this.request(`/profiles/${profileId}/updates/sent`);
  }

  // Editar publicación programada
  async updateScheduledPost(updateId, text, scheduledAt) {
    const body = {
      text,
      scheduled_at: scheduledAt,
    };

    return await this.request(`/updates/${updateId}/update`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Eliminar publicación pendiente
  async deleteUpdate(updateId) {
    return await this.request(`/updates/${updateId}/destroy`, {
      method: 'POST',
    });
  }

  // Mover publicación al inicio de la cola
  async moveToTop(updateId) {
    return await this.request(`/updates/${updateId}/move_to_top`, {
      method: 'POST',
    });
  }

  // Compartir publicación ahora
  async shareNow(updateId) {
    return await this.request(`/updates/${updateId}/share`, {
      method: 'POST',
    });
  }

  /**
   * 4. ANALYTICS Y ESTADÍSTICAS
   */

  // Obtener interacciones de una publicación
  async getUpdateInteractions(updateId) {
    return await this.request(`/updates/${updateId}/interactions`);
  }

  // Obtener analytics de perfil (últimos 30 días)
  async getProfileAnalytics(profileId) {
    const sentUpdates = await this.getSentUpdates(profileId);

    const analytics = {
      totalPosts: sentUpdates.length,
      totalClicks: 0,
      totalReaches: 0,
      totalEngagements: 0,
      posts: []
    };

    for (const update of sentUpdates.slice(0, 100)) { // Últimos 100 posts
      try {
        const interactions = await this.getUpdateInteractions(update.id);

        analytics.totalClicks += interactions.clicks || 0;
        analytics.totalReaches += interactions.reach || 0;
        analytics.totalEngagements += interactions.engagements || 0;

        analytics.posts.push({
          id: update.id,
          text: update.text,
          sentAt: update.sent_at,
          clicks: interactions.clicks || 0,
          reach: interactions.reach || 0,
          engagements: interactions.engagements || 0,
        });
      } catch (error) {
        console.error(`Error getting interactions for update ${update.id}:`, error);
      }
    }

    return analytics;
  }

  /**
   * 5. MÉTODOS ESPECÍFICOS PARA EL PORTFOLIO
   */

  // Publicar nuevo proyecto en todas las redes
  async publishNewProject(project) {
    try {
      const profiles = await this.getProfiles();
      const profileIds = profiles.map(p => p.id);

      const text = this.generateProjectText(project);

      const result = await this.publishWithLink(
        profileIds,
        text,
        `https://marianoaliandri.com.ar/#proyectos`,
        {
          shorten: true,
        }
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generar texto para proyecto
  generateProjectText(project) {
    const emojis = {
      'Web Scrapper': '🕷️',
      'Power BI': '📊',
      'Python': '🐍',
      'React': '⚛️',
      'default': '🚀'
    };

    const emoji = Object.keys(emojis).find(key =>
      project.title?.includes(key)
    ) || 'default';

    return `${emojis[emoji]} Nuevo proyecto: ${project.title}

${project.description}

#DesarrolloWeb #PowerBI #Python #React #FullStack #DataAnalytics

Ver más en mi portfolio 👇`;
  }

  // Compartir calculadora
  async shareCalculator(calculatorType, stats = {}) {
    try {
      const profiles = await this.getProfiles();
      const linkedInProfiles = profiles.filter(p => p.service === 'linkedin');

      const texts = {
        roi: `📈 ¿Cuánto vale realmente tu proyecto web?

Probé mi Calculadora de ROI interactiva y descubrí insights increíbles sobre inversión en desarrollo web.

${stats.totalCalculations ? `Ya hay ${stats.totalCalculations} empresas calculando su retorno de inversión.` : ''}

¿Querés calcular el tuyo? Es gratis 👇
https://marianoaliandri.com.ar/roi

#ROI #DesarrolloWeb #Emprendedores #BusinessIntelligence`,

        web: `💻 ¿Cuánto cuesta desarrollar tu página web?

Creé una calculadora inteligente que estima costos según tus necesidades:
✅ Tipo de sitio
✅ Funcionalidades
✅ Diseño personalizado
✅ Integraciones

Obtené tu presupuesto en segundos 👇
https://marianoaliandri.com.ar/web

#DesarrolloWeb #Freelance #Presupuestos #WebDevelopment`,

        ats: `📄 ¿Tu CV pasa los sistemas ATS?

Desarrollé un analizador gratuito que evalúa tu CV contra Applicant Tracking Systems.

Descubrí qué tan optimizado está tu currículum para búsquedas laborales.

Probalo gratis 👇
https://marianoaliandri.com.ar/ats

#RecursosHumanos #CV #EmpleoTech #CarreraProfesional`
      };

      const text = texts[calculatorType] || texts.web;

      return await this.addToQueue(
        linkedInProfiles.map(p => p.id),
        text,
        { shorten: true }
      );
    } catch (error) {
      console.error('Error sharing calculator:', error);
      throw error;
    }
  }

  // Webhook desde Marian Bot - Nueva reunión agendada
  async publishMeetingScheduled(meetingData) {
    try {
      const profiles = await this.getProfiles();
      const linkedInProfiles = profiles.filter(p => p.service === 'linkedin');

      const text = `🎯 Nueva reunión agendada

Gracias ${meetingData.clientName || 'al cliente'} por confiar en mi servicio de ${meetingData.service || 'consultoría'}.

¿Necesitás asesoramiento en desarrollo web, Power BI o análisis de datos?

Agendá tu reunión gratuita 👇
https://marianoaliandri.com.ar/#contact

#Consultoría #DesarrolloWeb #PowerBI #DataAnalytics`;

      return await this.schedulePost(
        linkedInProfiles.map(p => p.id),
        text,
        Math.floor(Date.now() / 1000) + 3600 // Publicar en 1 hora
      );
    } catch (error) {
      console.error('Error publishing meeting:', error);
      throw error;
    }
  }

  // Contenido reciclado - Repostear proyectos antiguos
  async recycleContent() {
    try {
      const profiles = await this.getProfiles();
      const linkedInProfiles = profiles.filter(p => p.service === 'linkedin');

      // Lista de contenido evergreen
      const evergreenContent = [
        {
          text: `🚀 ¿Sabías que un buen dashboard de Power BI puede reducir hasta 70% el tiempo de análisis de datos?

Especializado en transformar datos en decisiones.

Conocé mis servicios de Business Intelligence 👇
https://marianoaliandri.com.ar

#PowerBI #BusinessIntelligence #DataAnalytics #Dashboards`,
          interval: 30 // días
        },
        {
          text: `⚛️ React + Python: La combinación perfecta para aplicaciones web modernas

Frontend dinámico + Backend robusto = Soluciones escalables

¿Tenés un proyecto en mente?
https://marianoaliandri.com.ar/#contact

#React #Python #FullStack #DesarrolloWeb`,
          interval: 45
        },
        {
          text: `📊 3 señales de que tu empresa necesita dashboards automatizados:

1️⃣ Pasás horas compilando reportes manualmente
2️⃣ Los datos están dispersos en múltiples archivos
3️⃣ Las decisiones se toman sin información en tiempo real

¿Te suena familiar? Hablemos 👇
https://marianoaliandri.com.ar

#Automatización #PowerBI #Productividad #BI`,
          interval: 60
        }
      ];

      // Seleccionar contenido aleatorio
      const randomContent = evergreenContent[
        Math.floor(Math.random() * evergreenContent.length)
      ];

      return await this.addToQueue(
        linkedInProfiles.map(p => p.id),
        randomContent.text
      );
    } catch (error) {
      console.error('Error recycling content:', error);
      throw error;
    }
  }

  /**
   * 6. UTILIDADES
   */

  // Verificar si el token es válido
  async isAuthenticated() {
    try {
      await this.getUser();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Obtener límites de la cuenta
  async getAccountLimits() {
    const user = await this.getUser();
    return {
      plan: user.plan,
      profilesLimit: user.profile_limit || 3,
      postsLimit: user.posts_limit || 10,
    };
  }

  // Formatear fecha para Buffer (Unix timestamp)
  formatDate(date) {
    return Math.floor(new Date(date).getTime() / 1000);
  }

  // Generar hashtags automáticos
  generateHashtags(category) {
    const hashtagMap = {
      web: ['#DesarrolloWeb', '#WebDevelopment', '#React', '#Frontend'],
      powerbi: ['#PowerBI', '#BusinessIntelligence', '#DataAnalytics', '#BI'],
      python: ['#Python', '#DataScience', '#Backend', '#Programming'],
      general: ['#FullStack', '#Tech', '#Desarrollo', '#Innovation']
    };

    return hashtagMap[category] || hashtagMap.general;
  }
}

// Singleton instance
const bufferService = new BufferService();

export default bufferService;
