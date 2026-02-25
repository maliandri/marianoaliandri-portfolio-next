import admin, { db } from '@/lib/firebase-admin';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

function getRedirectUri(request) {
  const baseUrl = new URL(request.url).origin;
  return `${baseUrl}/api/linkedin-auth`;
}

// GET: OAuth callback from LinkedIn
export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const baseUrl = new URL(request.url).origin;

  if (error) {
    return Response.redirect(new URL(`/admin?linkedin=error&message=${encodeURIComponent(error)}`, baseUrl));
  }

  if (code) {
    try {
      const REDIRECT_URI = getRedirectUri(request);
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: LINKEDIN_CLIENT_ID, client_secret: LINKEDIN_CLIENT_SECRET }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        return Response.redirect(new URL('/admin?linkedin=error&message=token_exchange_failed', baseUrl));
      }

      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json();

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
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return Response.redirect(new URL('/admin?linkedin=success', baseUrl));
    } catch (err) {
      return Response.redirect(new URL(`/admin?linkedin=error&message=${encodeURIComponent(err.message)}`, baseUrl));
    }
  }

  return Response.json({ error: 'Missing code parameter' }, { status: 400 });
}

// POST: Admin actions (getAuthUrl, status, disconnect)
export async function POST(request) {
  try {
    const { action } = await request.json();

    if (action === 'getAuthUrl') {
      if (!LINKEDIN_CLIENT_ID) {
        return Response.json({ error: 'LINKEDIN_CLIENT_ID not configured' }, { status: 500 });
      }
      const REDIRECT_URI = getRedirectUri(request);
      const state = Math.random().toString(36).substring(7);
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}`;
      return Response.json({ authUrl, state });
    }

    if (action === 'status') {
      const doc = await db.doc('integrations/linkedin').get();
      if (!doc.exists) return Response.json({ connected: false });
      const data = doc.data();
      const isExpired = data.expiresAt && Date.now() > data.expiresAt;
      return Response.json({
        connected: !isExpired, expired: isExpired,
        profileName: data.profileName, profilePicture: data.profilePicture, profileEmail: data.profileEmail,
        connectedAt: data.connectedAt?.toDate?.()?.toISOString() || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      });
    }

    if (action === 'disconnect') {
      await db.doc('integrations/linkedin').delete();
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
