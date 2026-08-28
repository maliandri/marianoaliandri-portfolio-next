import { google } from 'googleapis';

export function getGSCAuth() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GSC_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Credenciales de service account no configuradas');
  return new google.auth.JWT(clientEmail, null, privateKey, ['https://www.googleapis.com/auth/webmasters.readonly']);
}

/**
 * Obtiene todos los sitios verificados en GSC dinámicamente.
 * Prefiere entradas sc-domain: (cubren todos los subdominios).
 * Deduplica por dominio base.
 * @returns {Array<{ domain, url, siteUrl }>}
 */
export async function getVerifiedSites(auth) {
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchconsole.sites.list();
  const siteEntries = res.data.siteEntry || [];

  const domainMap = new Map();

  for (const entry of siteEntries) {
    const siteUrl = entry.siteUrl;
    let domain;

    if (siteUrl.startsWith('sc-domain:')) {
      domain = siteUrl.replace('sc-domain:', '');
    } else {
      try {
        domain = new URL(siteUrl).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }
    }

    // Preferir sc-domain: sobre URL-prefix para el mismo dominio
    if (!domainMap.has(domain) || siteUrl.startsWith('sc-domain:')) {
      domainMap.set(domain, {
        domain,
        url: `https://${domain}`,
        siteUrl,
        permissionLevel: entry.permissionLevel || 'unknown',
      });
    }
  }

  return Array.from(domainMap.values());
}
