import crypto from 'node:crypto';

const TWEETS_URL = 'https://api.twitter.com/2/tweets';

// RFC 3986: encodeURIComponent deja sin escapar ! ' ( ) * y OAuth 1.0a los exige escapados.
const enc = (s) =>
  encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// Cabecera Authorization OAuth 1.0a (HMAC-SHA1). Como el POST es JSON, solo las
// credenciales oauth_* entran en la base de la firma (no hay params de query ni de form).
export function buildOAuth1Header({ method, url, creds, nonce, timestamp }) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce ?? crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${enc(k)}=${enc(oauth[k])}`)
    .join('&');
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&');
  const key = `${enc(creds.apiSecret)}&${enc(creds.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

export function xCredsFromEnv(env = process.env) {
  const creds = {
    apiKey: env.X_API_KEY,
    apiSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessSecret: env.X_ACCESS_SECRET,
  };
  return Object.values(creds).every(Boolean) ? creds : null;
}

export async function postToX(text, { creds = xCredsFromEnv(), fetchImpl = fetch } = {}) {
  if (!creds) throw new Error('Credenciales de X no configuradas (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)');
  const resp = await fetchImpl(TWEETS_URL, {
    method: 'POST',
    headers: {
      Authorization: buildOAuth1Header({ method: 'POST', url: TWEETS_URL, creds }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const detail = (await resp.text().catch(() => '')).slice(0, 200);
    throw new Error(`X ${resp.status}${detail ? `: ${detail}` : ''}`);
  }
  const data = await resp.json().catch(() => ({}));
  return data?.data?.id ?? null;
}
