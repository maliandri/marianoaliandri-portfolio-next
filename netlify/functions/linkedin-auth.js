// netlify/functions/linkedin-auth.js
// Maneja el flujo OAuth 2.0 de LinkedIn
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

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.URL
  ? `${process.env.URL}/.netlify/functions/linkedin-auth`
  : 'https://marianoaliandri.com.ar/.netlify/functions/linkedin-auth';

const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // GET = callback de LinkedIn después del OAuth
  if (event.httpMethod === 'GET') {
    const { code, error, state } = event.queryStringParameters || {};

    if (error) {
      return {
        statusCode: 302,
        headers: { Location: '/admin?linkedin=error&message=' + encodeURIComponent(error) }
      };
    }

    if (code) {
      try {
        // Intercambiar code por access_token
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: LINKEDIN_CLIENT_ID,
            client_secret: LINKEDIN_CLIENT_SECRET
          })
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.access_token) {
          console.error('Error obteniendo token:', tokenData);
          return {
            statusCode: 302,
            headers: { Location: '/admin?linkedin=error&message=token_exchange_failed' }
          };
        }

        // Obtener perfil para identificar al usuario
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const profile = await profileRes.json();

        // Guardar token en Firestore
        await db.doc('integrations/linkedin').set({
          accessToken: tokenData.access_token,
          expiresIn: tokenData.expires_in,
          expiresAt: Date.now() + (tokenData.expires_in * 1000),
          refreshToken: tokenData.refresh_token || null,
          scope: tokenData.scope,
          profileId: profile.sub,
          profileName: profile.name,
          profilePicture: profile.picture,
          profileEmail: profile.email,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('LinkedIn conectado para:', profile.name);

        return {
          statusCode: 302,
          headers: { Location: '/admin?linkedin=success' }
        };
      } catch (err) {
        console.error('Error en OAuth callback:', err);
        return {
          statusCode: 302,
          headers: { Location: '/admin?linkedin=error&message=' + encodeURIComponent(err.message) }
        };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code parameter' }) };
  }

  // POST = acciones del admin
  if (event.httpMethod === 'POST') {
    const { action } = JSON.parse(event.body || '{}');

    if (action === 'getAuthUrl') {
      if (!LINKEDIN_CLIENT_ID) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'LINKEDIN_CLIENT_ID not configured' })
        };
      }

      const state = Math.random().toString(36).substring(7);
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `response_type=code&` +
        `client_id=${LINKEDIN_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(SCOPES.join(' '))}&` +
        `state=${state}`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ authUrl, state })
      };
    }

    if (action === 'status') {
      try {
        const doc = await db.doc('integrations/linkedin').get();
        if (!doc.exists) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ connected: false })
          };
        }

        const data = doc.data();
        const isExpired = data.expiresAt && Date.now() > data.expiresAt;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            connected: !isExpired,
            expired: isExpired,
            profileName: data.profileName,
            profilePicture: data.profilePicture,
            profileEmail: data.profileEmail,
            connectedAt: data.connectedAt?.toDate?.()?.toISOString() || null,
            expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null
          })
        };
      } catch (err) {
        console.error('Error checking status:', err);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: err.message })
        };
      }
    }

    if (action === 'disconnect') {
      try {
        await db.doc('integrations/linkedin').delete();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: err.message })
        };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
