// netlify/functions/linkedin-data.js
// Obtiene datos de LinkedIn (perfil, posts) usando el token almacenado
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function getAccessToken() {
  const doc = await db.doc('integrations/linkedin').get();
  if (!doc.exists) return null;

  const data = doc.data();
  if (data.expiresAt && Date.now() > data.expiresAt) return null;

  return data.accessToken;
}

async function linkedinAPI(path, token) {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': '202402',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`LinkedIn API error (${res.status}) for ${path}:`, errorText);
    throw new Error(`LinkedIn API ${res.status}: ${errorText}`);
  }

  return res.json();
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'LinkedIn not connected or token expired' })
      };
    }

    const { action } = JSON.parse(event.body || '{}');

    if (action === 'profile') {
      const profile = await linkedinAPI('/v2/userinfo', token);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            id: profile.sub,
            name: profile.name,
            givenName: profile.given_name,
            familyName: profile.family_name,
            email: profile.email,
            picture: profile.picture,
            locale: profile.locale
          }
        })
      };
    }

    if (action === 'posts') {
      // Obtener el person URN del perfil almacenado
      const doc = await db.doc('integrations/linkedin').get();
      const profileId = doc.data()?.profileId;

      if (!profileId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Profile ID not found' })
        };
      }

      const authorUrn = `urn:li:person:${profileId}`;

      try {
        // Obtener posts del usuario
        const postsData = await linkedinAPI(
          `/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=10&sortBy=LAST_MODIFIED`,
          token
        );

        const posts = (postsData.elements || []).map(post => {
          const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text ||
                       post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareMediaCategory || '';
          const media = post.specificContent?.['com.linkedin.ugc.ShareContent']?.media || [];

          return {
            id: post.id,
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            created: post.created?.time ? new Date(post.created.time).toISOString() : null,
            lastModified: post.lastModified?.time ? new Date(post.lastModified.time).toISOString() : null,
            visibility: post.visibility?.['com.linkedin.ugc.MemberNetworkVisibility'] || 'UNKNOWN',
            mediaCount: media.length,
            hasMedia: media.length > 0
          };
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              posts,
              total: postsData.paging?.total || posts.length
            }
          })
        };
      } catch (postsError) {
        // Si la API de posts falla (permisos insuficientes), devolver lista vacía
        console.warn('No se pudieron obtener posts:', postsError.message);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              posts: [],
              total: 0,
              note: 'Posts API requires additional permissions. Apply for Marketing Developer Platform for full access.'
            }
          })
        };
      }
    }

    if (action === 'analytics') {
      // Analytics requiere Marketing Developer Platform
      // Por ahora devolvemos un placeholder
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            available: false,
            message: 'Analytics completo requiere aprobacion de Marketing Developer Platform. Solicitalo en tu LinkedIn App > Products.',
            basicMetrics: null
          }
        })
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  } catch (error) {
    console.error('Error en linkedin-data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
