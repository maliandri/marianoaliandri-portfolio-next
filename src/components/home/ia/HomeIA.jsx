import Link from 'next/link';
import { IA_NICHOS } from '@/data/iaNichos';
import { display, mono } from '@/components/iaPara/fonts';
import s from '@/components/iaPara/iaPara.module.css';
import AudienceSwitch from '@/components/home/AudienceSwitch';
import Contact from '@/components/home/Contact';
import ChatDemo from './ChatDemo';
import HeroEscena from './HeroEscena';
import AbrirChatButton from './AbrirChatButton';

// Home "IA para tu negocio" (audiencia por defecto del sitio).
// Spec: docs/superpowers/specs/2026-11-23-reposicionamiento-ia.md

const WA_URL = `https://wa.me/5492995414422?text=${encodeURIComponent('Hola Mariano, quiero ver cómo conectar mi negocio a la IA.')}`;

const PASOS = [
  { titulo: 'Ordenamos tus datos', texto: 'Pasamos las planillas, los Excel y los grupos de WhatsApp a un sistema propio en la nube, con base de datos. Si ya tenés uno, usamos el tuyo.' },
  { titulo: 'Lo conectamos a la IA', texto: 'Le doy a la IA las herramientas para usar tu sistema: qué puede consultar, qué puede hacer y quién la puede usar. Se conecta con MCP, el estándar abierto que usan Claude y ChatGPT.' },
  { titulo: 'Preguntás y aprobás', texto: 'Desde la app de Claude o ChatGPT, en la compu o en el celular. La IA consulta, arma el borrador y te pregunta antes de mandar nada.' },
];

const CONSULTA = [
  { q: '¿Qué obras vienen atrasadas?', d: 'obras · etapas · fechas' },
  { q: '¿Quién me debe y desde cuándo?', d: 'cobros · clientes' },
  { q: '¿Alcanza el material para la obra Fernández?', d: 'stock · compras' },
];
const ACCION = [
  { q: 'Armá el presupuesto de la ampliación', d: 'borrador → lo revisás → se envía' },
  { q: 'Avisale al cliente que pasamos a terminaciones', d: 'mensaje listo → aprobás → sale' },
  { q: 'Registrá el cobro de la seña', d: 'te muestra el cambio antes de guardarlo' },
];

const FRENOS = [
  { titulo: 'Nada sale sin tu OK', texto: 'Mails, mensajes y cambios en el sistema esperan tu aprobación.' },
  { titulo: 'Solo entra quien vos decís', texto: 'Acceso con cuenta de Google y permisos por persona.' },
  { titulo: 'Topes de gasto', texto: 'Límites por día para que nada se dispare sin control.' },
  { titulo: 'Todo queda registrado', texto: 'Cada consulta y cada acción, con fecha y quién la hizo.' },
];

const eyebrow = 'text-xs font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-400';
const h2 = `${s.display} text-3xl md:text-5xl font-extrabold text-fg leading-[1.05] tracking-tight text-balance`;
const card = 'bg-card border border-fg/10 rounded-2xl';
const chip = `${s.mono} text-[11px] px-2 py-0.5 rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300`;

function Seccion({ id, children, className = '' }) {
  return (
    <section id={id} className={`px-6 py-20 md:py-24 border-t border-fg/10 ${className}`}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

export default function HomeIA() {
  return (
    <div className={`fx-grain ${display.variable} ${mono.variable}`}>
      {/* HERO como escena de scroll (HeroEscena). El h1 se pinta quieto al cargar: es el elemento LCP. */}
      <HeroEscena
        demo={<ChatDemo />}
        texto={<>
            <AudienceSwitch variant="inline" />
            <span className={eyebrow}>Sistemas con IA para negocios · Neuquén</span>
            <h1 className={`${s.display} text-5xl md:text-6xl xl:text-7xl font-extrabold text-fg leading-[1.02] tracking-tight text-balance`}>
              Preguntale a tu negocio. <span className="text-gradient">Te contesta con tus datos.</span>
            </h1>
            <p className="text-lg text-fg-400 leading-relaxed max-w-xl">
              Armo el sistema de tu negocio (obras, stock, turnos, clientes, cobros) y lo conecto a Claude, ChatGPT o Gemini.
              Tu equipo pregunta desde el celular, la IA responde con datos reales y hace tareas solo cuando vos lo aprobás.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 glow-btn">
                Contame tu negocio <span aria-hidden>→</span>
              </a>
              <a href="#casos" className="flex items-center gap-2 border border-fg/20 hover:border-fg/50 text-fg font-semibold px-7 py-3.5 pill-btn transition-colors">
                Ver casos reales
              </a>
            </div>
            <p className={`${s.mono} text-xs text-fg-500`}>Funciona con Claude · ChatGPT · Gemini</p>
        </>}
      />

      {/* CÓMO FUNCIONA — numerado porque es el orden real del trabajo */}
      <Seccion id="como-funciona">
        <p className={eyebrow}>Cómo funciona</p>
        <h2 className={`${h2} mt-3 mb-12`}>Tres pasos y tu sistema habla</h2>
        <ol className="grid md:grid-cols-3 gap-8">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex flex-col gap-3">
              <span className={`${s.mono} text-xs text-indigo-600 dark:text-indigo-400`}>Paso {i + 1}</span>
              <h3 className="text-xl font-bold text-fg">{p.titulo}</h3>
              <p className="text-fg-400 leading-relaxed">{p.texto}</p>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* CONSULTA / ACTÚA */}
      <Seccion>
        <p className={eyebrow}>Qué puede hacer</p>
        <h2 className={`${h2} mt-3`}>Consulta sola. Actúa con tu permiso.</h2>
        <p className="text-lg text-fg-400 mt-4 mb-12 max-w-2xl">
          Las consultas son libres. Todo lo que sale hacia afuera (un mail, un mensaje, un cambio en el sistema) espera tu aprobación.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          {[['Consulta', CONSULTA], ['Hace, con tu aprobación', ACCION]].map(([titulo, items]) => (
            <div key={titulo} className="flex flex-col gap-3">
              <h3 className="text-lg font-bold text-fg">{titulo}</h3>
              <ul className="flex flex-col gap-2.5">
                {items.map(it => (
                  <li key={it.q} className={`${card} px-4 py-3`}>
                    <p className="text-fg-200">{it.q}</p>
                    <p className={`${s.mono} text-[11px] text-fg-500 mt-1`}>{it.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Seccion>

      {/* CASOS REALES */}
      <Seccion id="casos">
        <p className={eyebrow}>Casos reales, en uso hoy</p>
        <h2 className={`${h2} mt-3 mb-12`}>No es una demo. Ya está andando.</h2>
        <div className="grid md:grid-cols-3 gap-5">
          <article className={`${card} glow-frame p-6 flex flex-col gap-3`}>
            <span className={`${s.mono} text-[11px] uppercase tracking-wider text-fg-500`}>Cliente · obras y fabricación</span>
            <h3 className="text-xl font-bold text-fg">Un negocio que le pregunta a Claude por sus obras</h3>
            <p className="text-fg-400 text-[15px] leading-relaxed">
              Obras por etapas, stock, presupuestos y cobros en un solo sistema. El dueño pregunta desde el celular qué falta,
              cuánto le deben o si alcanza el material, y Claude le arma el presupuesto.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
              {['detalle_obra', 'consultar_stock', 'alcanza_material', 'crear_presupuesto', 'registrar_cobro'].map(t => <code key={t} className={chip}>{t}</code>)}
            </div>
          </article>
          <article className={`${card} glow-frame p-6 flex flex-col gap-3`}>
            <span className={`${s.mono} text-[11px] uppercase tracking-wider text-fg-500`}>Mi propio negocio</span>
            <p className={`${s.display} text-5xl font-extrabold text-gradient leading-none`}>42</p>
            <h3 className="text-xl font-bold text-fg">herramientas que uso todos los días</h3>
            <p className="text-fg-400 text-[15px] leading-relaxed">
              Busca negocios que necesitan una web, audita sus sitios, prepara los mails, arma presupuestos con link de pago y
              publica en redes. Yo apruebo y la IA hace el resto.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
              {['search_leads', 'create_budget', 'publish_free_post', 'get_site_stats'].map(t => <code key={t} className={chip}>{t}</code>)}
            </div>
          </article>
          <article className={`${card} glow-frame p-6 flex flex-col gap-3`}>
            <span className={`${s.mono} text-[11px] uppercase tracking-wider text-fg-500`}>En este sitio</span>
            <h3 className="text-xl font-bold text-fg">Un chat que cotiza con precios reales</h3>
            <p className="text-fg-400 text-[15px] leading-relaxed">
              El asistente de esta página conoce mi catálogo y calcula un presupuesto en dólares y en pesos al momento.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {['ver_servicios', 'cotizar'].map(t => <code key={t} className={chip}>{t}</code>)}
            </div>
            <AbrirChatButton className="mt-auto self-start border border-fg/20 hover:border-fg/50 text-fg font-semibold text-sm px-5 py-2.5 pill-btn transition-colors">
              Probalo ahora
            </AbrirChatButton>
          </article>
        </div>
      </Seccion>

      {/* RUBROS — sale solo de IA_NICHOS */}
      <Seccion id="rubros">
        <p className={eyebrow}>Por rubro</p>
        <h2 className={`${h2} mt-3 mb-10`}>¿Qué le preguntarías a tu negocio?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {IA_NICHOS.map(n => (
            <Link key={n.slug} href={`/ia-para/${n.slug}/`} className={`${card} p-5 flex flex-col gap-2 hover:border-indigo-500/50 transition-colors group`}>
              <h3 className="font-bold text-fg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{n.titulo}</h3>
              <p className="text-sm text-fg-500 leading-snug">{n.pregunta}</p>
            </Link>
          ))}
        </div>
      </Seccion>

      {/* FRENOS */}
      <Seccion>
        <p className={eyebrow}>Seguridad</p>
        <h2 className={`${h2} mt-3 mb-10`}>La IA usa tu sistema con reglas</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {FRENOS.map(f => (
            <div key={f.titulo} className="flex flex-col gap-2">
              <h3 className="font-bold text-fg">{f.titulo}</h3>
              <p className="text-fg-400 text-[15px] leading-relaxed">{f.texto}</p>
            </div>
          ))}
        </div>
      </Seccion>

      {/* CONTACTO */}
      <Seccion id="contacto">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div className="flex flex-col gap-5">
            <p className={eyebrow}>Empecemos</p>
            <h2 className={h2}>Contame cómo trabaja tu negocio hoy</h2>
            <p className="text-lg text-fg-400 max-w-xl">
              Planillas, Excel, un sistema viejo o todo por WhatsApp. En una charla de 20 minutos te digo qué podría responderte
              la IA y cuánto cuesta.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 glow-btn">
                Escribime por WhatsApp
              </a>
              <Link href="/presupuesto/" className="flex items-center gap-2 border border-fg/20 hover:border-fg/50 text-fg font-semibold px-7 py-3.5 pill-btn transition-colors">
                Pedir presupuesto
              </Link>
            </div>
          </div>
          <div className={`${card} p-6 flex flex-col gap-2`}>
            <p className={eyebrow}>Directo</p>
            <p className={`${s.mono} text-fg`}>+54 9 299 541-4422</p>
            <p className={`${s.mono} text-fg`}>yo@marianoaliandri.com.ar</p>
            <p className="text-sm text-fg-500">Neuquén · trabajo con negocios de todo el país</p>
          </div>
        </div>
        <div className="mt-12">
          <Contact />
        </div>
      </Seccion>
    </div>
  );
}
