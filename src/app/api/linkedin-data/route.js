import { db } from '@/lib/firebase-admin';

async function getAccessToken() {
  const doc = await db.doc('integrations/linkedin').get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.expiresAt && Date.now() > data.expiresAt) return null;
  return data.accessToken;
}

async function linkedinAPI(path, token) {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202402', 'X-Restli-Protocol-Version': '2.0.0' },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LinkedIn API ${res.status}: ${errorText}`);
  }
  return res.json();
}

export async function POST(request) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return Response.json({ error: 'LinkedIn not connected or token expired' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'profile') {
      const profile = await linkedinAPI('/v2/userinfo', token);
      return Response.json({ success: true, data: { id: profile.sub, name: profile.name, givenName: profile.given_name, familyName: profile.family_name, email: profile.email, picture: profile.picture, locale: profile.locale } });
    }

    if (action === 'posts') {
      const doc = await db.doc('integrations/linkedin').get();
      const profileId = doc.data()?.profileId;
      if (!profileId) return Response.json({ error: 'Profile ID not found' }, { status: 400 });
      const authorUrn = `urn:li:person:${profileId}`;
      try {
        const postsData = await linkedinAPI(`/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=10&sortBy=LAST_MODIFIED`, token);
        const posts = (postsData.elements || []).map(post => {
          const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
          const media = post.specificContent?.['com.linkedin.ugc.ShareContent']?.media || [];
          return {
            id: post.id,
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            created: post.created?.time ? new Date(post.created.time).toISOString() : null,
            lastModified: post.lastModified?.time ? new Date(post.lastModified.time).toISOString() : null,
            visibility: post.visibility?.['com.linkedin.ugc.MemberNetworkVisibility'] || 'UNKNOWN',
            mediaCount: media.length, hasMedia: media.length > 0,
          };
        });
        return Response.json({ success: true, data: { posts, total: postsData.paging?.total || posts.length } });
      } catch (postsError) {
        return Response.json({ success: true, data: { posts: [], total: 0, note: 'Posts API requires additional permissions.' } });
      }
    }

    if (action === 'analytics') {
      return Response.json({ success: true, data: { available: false, message: 'Analytics requiere Marketing Developer Platform.' } });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
