import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';

// Solo para las páginas /ia-para: títulos con carácter (Bricolage) y el "comprobante" de lo que
// hizo la IA en monoespaciada. El texto corrido sigue siendo Inter, como el resto del sitio.
export const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-ia-display', display: 'swap' });
export const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-ia-mono', display: 'swap' });
