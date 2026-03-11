// Logos de servicios en Cloudinary — 1080x1080 con fondo blanco para Instagram/Facebook
// Transformaciones: w_1080,h_1080,c_pad,b_white,f_jpg (logo centrado, fondo blanco, JPG)
const T = 'w_1080,h_1080,c_pad,b_white,f_jpg';
const BASE = 'https://res.cloudinary.com/dlshym1te/image/upload';

export const SERVICE_LOGOS = {
  'vercel':       `${BASE}/${T}/v1773262073/service-logos/vercel.svg`,
  'netlify':      `${BASE}/${T}/v1773262074/service-logos/netlify.svg`,
  'mercadopago':  `${BASE}/${T}/v1773262076/service-logos/mercadopago.svg`,
  'firebase':     `${BASE}/${T}/v1773262079/service-logos/firebase.svg`,
  'mongodb':      `${BASE}/${T}/v1773262081/service-logos/mongodb.svg`,
  'supabase':     `${BASE}/${T}/v1773262085/service-logos/supabase.svg`,
  'cloudinary':   `${BASE}/${T}/v1773262088/service-logos/cloudinary.svg`,
  'make':         `${BASE}/${T}/v1773262090/service-logos/make.svg`,
  'resend':       `${BASE}/${T}/v1773262093/service-logos/resend.svg`,
  'googlegemini': `${BASE}/${T}/v1773262096/service-logos/googlegemini.svg`,
  'nextdotjs':    `${BASE}/${T}/v1773262098/service-logos/nextdotjs.svg`,
  'react':        `${BASE}/${T}/v1773262100/service-logos/react.svg`,
  'tailwindcss':  `${BASE}/${T}/v1773262104/service-logos/tailwindcss.svg`,
  'framermotion': `${BASE}/${T}/v1773262106/service-logos/framermotion.svg`,
};
