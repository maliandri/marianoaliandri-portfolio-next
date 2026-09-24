// Arma enlaces mailto: con las casillas en CCO, partidas en tandas que entren en el
// largo máximo de URL que aguantan Windows y la mayoría de los gestores de mail.

// Windows/Outlook cortan el enlace cerca de los 2000 caracteres; se deja margen.
export const MAX_MAILTO_LENGTH = 1800;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minúsculas, sin duplicados, sin vacíos ni inválidos; conserva el orden de aparición.
export function cleanEmails(emails) {
  const seen = new Set();
  const out = [];
  for (const raw of emails || []) {
    const e = String(raw ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

// La arroba se deja sin codificar: es válida en mailto y ahorra 2 caracteres por casilla.
const encAddr = (s) => encodeURIComponent(s).replace(/%40/g, '@');
// Los gestores esperan CRLF en el cuerpo del mailto.
const encText = (s) => encodeURIComponent(String(s ?? '').replace(/\r?\n/g, '\r\n'));

export function buildMailBatches(emails, { subject = '', body = '', to = '' } = {}) {
  const list = cleanEmails(emails);
  if (!list.length) return [];

  const base = `mailto:${to ? encAddr(to) : ''}?subject=${encText(subject)}&body=${encText(body)}&bcc=`;
  const batches = [];
  let current = [];
  let used = base.length;

  const flush = () => {
    if (!current.length) return;
    batches.push({ emails: current, url: base + current.map(encAddr).join(',') });
    current = [];
    used = base.length;
  };

  for (const email of list) {
    const add = encAddr(email).length + (current.length ? 1 : 0); // +1 por la coma
    if (current.length && used + add > MAX_MAILTO_LENGTH) flush();
    used += encAddr(email).length + (current.length ? 1 : 0);
    current.push(email);
  }
  flush();
  return batches;
}
