'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebaseservice';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';

const MEDIOS_LOCALES = [
  { handle: '@lmneuquen',       label: 'LM Neuquén' },
  { handle: '@diariorionegro',  label: 'Río Negro' },
  { handle: '@aninoticias',     label: 'ANI Noticias' },
  { handle: '@noticiasnet',     label: 'Noticias.net' },
  { handle: '@neuqueninforma',  label: 'Nqn Informa' },
  { handle: '@elpatagonico',    label: 'El Patagónico' },
  { handle: '@cronista',        label: 'El Cronista' },
  { handle: '@infobae',         label: 'Infobae' },
];

const TIPOS = [
  { id: 'restaurant', label: 'Restaurantes', emoji: '🍽️' },
  { id: 'combustible', label: 'Combustible', emoji: '⛽' },
  { id: 'supermercado', label: 'Supermercados', emoji: '🛒' },
  { id: 'comercio', label: 'Comercios', emoji: '🏪' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'todos', label: 'Todos', emoji: '📍' },
];

const RADIOS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

const CONGESTION_ICONS = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' };
const CONGESTION_LABELS = { LOW: 'Fluido', MEDIUM: 'Moderado', HIGH: 'Congestionado' };
const CONGESTION_COLORS = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#ef4444', UNKNOWN: '#374151' };

// Calcula dimensiones de la zona en cuadras (bloque estándar ~100m)
function calcCuadras(bounds) {
  if (!bounds) return null;
  const R = 111000;
  const centerLat = (bounds.north + bounds.south) / 2;
  const heightM = (bounds.north - bounds.south) * R;
  const widthM = (bounds.east - bounds.west) * R * Math.cos(centerLat * Math.PI / 180);
  return {
    cuadrasAlto: Math.round(heightM / 100),
    cuadrasAncho: Math.round(widthM / 100),
    metrosAlto: Math.round(heightM),
    metrosAncho: Math.round(widthM),
  };
}

// Panel de heatmap capturado como imagen social
function HeatmapPanel({ result, bounds, innerRef }) {
  if (!result) return null;
  const cuadras = calcCuadras(bounds);

  // Contar horas por nivel de congestión
  const congCount = (result.hourly || []).reduce(
    (acc, h) => { acc[h.congestion] = (acc[h.congestion] || 0) + 1; return acc; },
    { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  );
  const dominantCong = congCount.HIGH >= 4 ? 'HIGH' : congCount.MEDIUM >= congCount.LOW ? 'MEDIUM' : 'LOW';

  // Períodos del día
  const PERIODS = [
    { label: 'Mañana', range: [6, 12], icon: '🌅' },
    { label: 'Mediodía', range: [12, 15], icon: '☀️' },
    { label: 'Tarde', range: [15, 20], icon: '🌆' },
    { label: 'Noche', range: [20, 23], icon: '🌙' },
  ];
  const periodCong = PERIODS.map(p => {
    const hours = (result.hourly || []).filter(h => h.hour >= p.range[0] && h.hour < p.range[1]);
    const avgMin = hours.length ? Math.round(hours.reduce((s, h) => s + (h.minutes || 0), 0) / hours.length) : 0;
    const maxCong = hours.reduce((best, h) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
      return rank[h.congestion] > rank[best] ? h.congestion : best;
    }, 'UNKNOWN');
    return { ...p, avgMin, maxCong };
  });

  const s = {
    wrap:     { background: '#111827', padding: '24px', borderRadius: '16px', width: '600px', fontFamily: 'system-ui, sans-serif' },
    header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
    tag:      { color: CONGESTION_COLORS[dominantCong], fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' },
    title:    { color: '#fff', fontSize: '20px', fontWeight: 700, margin: 0 },
    subtitle: { color: '#6b7280', fontSize: '12px', marginTop: '4px' },
    cuadBadge:{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.5)', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' },
    cuadLabel:{ color: '#a78bfa', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', margin: '0 0 2px' },
    cuadVal:  { color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 },
    cuadSub:  { color: '#6b7280', fontSize: '9px', margin: '2px 0 0' },
    sectionLabel: { color: '#9ca3af', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' },
    heatGrid: { display: 'grid', gridTemplateColumns: `repeat(${(result.hourly || []).length}, 1fr)`, gap: '3px', marginBottom: '6px' },
    heatCell: (h) => ({
      background: CONGESTION_COLORS[h.congestion] || CONGESTION_COLORS.UNKNOWN,
      opacity: h.congestion === 'UNKNOWN' ? 0.25 : 0.9,
      borderRadius: '4px',
      height: '36px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: '3px',
    }),
    heatHour: { color: 'rgba(0,0,0,0.6)', fontSize: '7px', fontWeight: 700 },
    heatBar:  (h) => ({
      width: '100%',
      height: h.minutes ? `${Math.max((h.minutes / Math.max(...(result.hourly||[]).filter(x=>x.minutes).map(x=>x.minutes),1)) * 28, 4)}px` : '3px',
      background: CONGESTION_COLORS[h.congestion] || CONGESTION_COLORS.UNKNOWN,
      borderRadius: '3px 3px 0 0',
    }),
    legend:   { display: 'flex', gap: '12px', marginBottom: '16px' },
    legendDot:{ width: '10px', height: '10px', borderRadius: '2px' },
    statsGrid:{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' },
    statBox:  (color) => ({
      background: `${color}1a`, border: `1px solid ${color}4d`,
      borderRadius: '10px', padding: '12px', textAlign: 'center',
    }),
    statLabel:{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', margin: '0 0 4px' },
    statVal:  { color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0 },
    statSub:  { color: '#9ca3af', fontSize: '9px', margin: '3px 0 0' },
    perGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' },
    perBox:   (cong) => ({
      background: `${CONGESTION_COLORS[cong] || '#374151'}1a`,
      border: `1px solid ${CONGESTION_COLORS[cong] || '#374151'}4d`,
      borderRadius: '8px', padding: '10px 6px', textAlign: 'center',
    }),
    deltaBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center', marginBottom: '12px' },
    brand:    { textAlign: 'right' },
    brandText:{ color: '#374151', fontSize: '9px' },
  };

  return (
    <div ref={innerRef} style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.tag}>🗺️ Análisis de Zona · {CONGESTION_LABELS[dominantCong]}</p>
          <h2 style={s.title}>{result.zona_titulo}</h2>
          <p style={s.subtitle}>{result.fecha} · tráfico 6:00–22:00</p>
        </div>
        {cuadras && (
          <div style={s.cuadBadge}>
            <p style={s.cuadLabel}>📐 DIMENSIÓN</p>
            <p style={s.cuadVal}>{cuadras.cuadrasAncho} × {cuadras.cuadrasAlto}</p>
            <p style={s.cuadSub}>cuadras ({cuadras.metrosAncho}m × {cuadras.metrosAlto}m)</p>
          </div>
        )}
      </div>

      {/* Heatmap horario */}
      <p style={s.sectionLabel}>Tráfico horario — intensidad de congestión</p>
      <div style={{ position: 'relative' }}>
        <div style={s.heatGrid}>
          {(result.hourly || []).map(h => (
            <div key={h.hour} style={s.heatCell(h)}>
              <div style={s.heatBar(h)} />
              <span style={s.heatHour}>{h.hour}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={s.legend}>
        {[['LOW', '#22c55e', 'Fluido'], ['MEDIUM', '#eab308', 'Moderado'], ['HIGH', '#ef4444', 'Congestionado']].map(([k, c, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ ...s.legendDot, background: c }} />
            <span style={{ color: '#9ca3af', fontSize: '10px' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Estadísticas principales */}
      <div style={s.statsGrid}>
        <div style={s.statBox('#ef4444')}>
          <p style={{ ...s.statLabel, color: '#f87171' }}>🔴 HORA PICO</p>
          <p style={s.statVal}>{result.peak_hours?.[0]?.label ?? '—'}</p>
          <p style={s.statSub}>{result.peak_hours?.[0]?.minutes} min de viaje</p>
        </div>
        <div style={s.statBox('#22c55e')}>
          <p style={{ ...s.statLabel, color: '#4ade80' }}>🟢 HORA VALLE</p>
          <p style={s.statVal}>{result.valley_hour?.label ?? '—'}</p>
          <p style={s.statSub}>{result.valley_hour?.minutes} min de viaje</p>
        </div>
        <div style={s.statBox('#3b82f6')}>
          <p style={{ ...s.statLabel, color: '#60a5fa' }}>🏪 LOCALES</p>
          <p style={s.statVal}>{result.commercial?.total_places ?? '—'}</p>
          <p style={s.statSub}>⭐ {result.commercial?.avg_rating} promedio</p>
        </div>
      </div>

      {/* Concentración por período (Feature 3) */}
      <p style={s.sectionLabel}>Concentración de tráfico por período</p>
      <div style={s.perGrid}>
        {periodCong.map(p => (
          <div key={p.label} style={s.perBox(p.maxCong)}>
            <div style={{ fontSize: '18px', marginBottom: '4px' }}>{p.icon}</div>
            <p style={{ color: '#fff', fontSize: '11px', fontWeight: 700, margin: '0 0 2px' }}>{p.label}</p>
            <p style={{ color: CONGESTION_COLORS[p.maxCong], fontSize: '9px', fontWeight: 600, margin: '0 0 2px' }}>
              {CONGESTION_LABELS[p.maxCong] || '—'}
            </p>
            {p.avgMin > 0 && <p style={{ color: '#6b7280', fontSize: '9px', margin: 0 }}>~{p.avgMin} min</p>}
          </div>
        ))}
      </div>

      {/* Delta pico vs valle */}
      {result.delta_minutes > 0 && (
        <div style={s.deltaBox}>
          <span style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 600 }}>
            En hora pico tardás {result.delta_minutes} min más que en hora valle (+{result.delta_percent}%)
          </span>
        </div>
      )}

      <div style={s.brand}>
        <span style={s.brandText}>marianoaliandri.com.ar · Análisis Urbano</span>
      </div>
    </div>
  );
}

function PeriodoPicker({ label, value, onChange }) {
  return (
    <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600 space-y-3">
      <p className="text-purple-400 font-semibold text-sm">{label}</p>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Etiqueta</label>
        <input
          type="text"
          value={value.label}
          onChange={e => onChange({ ...value, label: e.target.value })}
          placeholder="Ej: Enero mañana"
          className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Desde — fecha</label>
          <input
            type="date"
            value={value.dateFrom}
            onChange={e => onChange({ ...value, dateFrom: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Desde — hora</label>
          <input
            type="time"
            value={value.timeFrom}
            onChange={e => onChange({ ...value, timeFrom: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Hasta — fecha</label>
          <input
            type="date"
            value={value.dateTo}
            onChange={e => onChange({ ...value, dateTo: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Hasta — hora</label>
          <input
            type="time"
            value={value.timeTo}
            onChange={e => onChange({ ...value, timeTo: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
    </div>
  );
}

// Tamaño por defecto del rectángulo: ~1km × 1km
const DEFAULT_OFFSET_LAT = 0.004;
const DEFAULT_OFFSET_LNG = 0.006;

export default function ZoneAnalysis() {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const rectangleRef = useRef(null);
  const [addressInput, setAddressInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Zona config
  const [titulo, setTitulo] = useState('');
  const [bounds, setBounds] = useState(null);
  const [tipos, setTipos]   = useState(['todos']);
  const [fecha, setFecha]   = useState(yesterday);

  // UI states
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState([]);

  // Publicar
  const [showPublish, setShowPublish] = useState(false);
  const [pubNetwork, setPubNetwork] = useState('Instagram');
  const [pubTone, setPubTone] = useState('técnico');
  const [extraContext, setExtraContext] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');

  // Preview
  const [selectedMedios, setSelectedMedios] = useState([]);
  const [chartCaptureError, setChartCaptureError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewCaption, setPreviewCaption] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [chartImageUrl, setChartImageUrl] = useState(null);
  const [heatmapImageUrl, setHeatmapImageUrl] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const resultsRef = useRef(null);
  const heatmapRef = useRef(null);

  // Zonas guardadas
  const [zonasGuardadas, setZonasGuardadas] = useState([]);

  // Load Google Maps
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places', 'drawing'] });
    loader.load().then(initMap).catch(e => console.error('Maps load error:', e));
  }, []);

  const placeRectangle = useCallback((centerLat, centerLng) => {
    if (!googleMapRef.current || !window.google) return;
    const newBounds = {
      north: centerLat + DEFAULT_OFFSET_LAT,
      south: centerLat - DEFAULT_OFFSET_LAT,
      east:  centerLng + DEFAULT_OFFSET_LNG,
      west:  centerLng - DEFAULT_OFFSET_LNG,
    };
    if (rectangleRef.current) rectangleRef.current.setMap(null);
    const rect = new window.google.maps.Rectangle({
      map: googleMapRef.current,
      bounds: newBounds,
      strokeColor: '#7c3aed',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#7c3aed',
      fillOpacity: 0.15,
      editable: true,
      draggable: true,
    });
    rectangleRef.current = rect;
    setBounds(newBounds);
    window.google.maps.event.addListener(rect, 'bounds_changed', () => {
      const b = rect.getBounds();
      if (!b) return;
      setBounds({
        north: b.getNorthEast().lat(),
        east:  b.getNorthEast().lng(),
        south: b.getSouthWest().lat(),
        west:  b.getSouthWest().lng(),
      });
    });
    googleMapRef.current.fitBounds(newBounds, 60);
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const centerLat = -38.9516, centerLng = -68.0591;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 14,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'simplified' }] }],
    });
    googleMapRef.current = map;
    placeRectangle(centerLat, centerLng);
  }, [placeRectangle]);

  const handleGeocode = async () => {
    if (!addressInput.trim()) return;
    setIsGeocoding(true);
    setGeocodeError('');
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addressInput)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se encontró la dirección');
      setAddressInput(data.formatted_address);
      placeRectangle(data.lat, data.lng);
    } catch (e) {
      setGeocodeError(e.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Load historial
  useEffect(() => {
    const loadHistorial = async () => {
      try {
        const q = query(collection(db, 'analisis_zonas'), orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        setHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        const zq = query(collection(db, 'zonas_analisis'), orderBy('createdAt', 'desc'), limit(10));
        const zsnap = await getDocs(zq);
        setZonasGuardadas(zsnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    };
    loadHistorial();
  }, []);

  const toggleTipo = (id) => {
    if (id === 'todos') { setTipos(['todos']); return; }
    setTipos(prev => {
      const without = prev.filter(t => t !== 'todos');
      return without.includes(id) ? without.filter(t => t !== id) || ['todos'] : [...without, id];
    });
  };

  const handleAnalizar = async () => {
    if (!titulo.trim()) { setError('Ingresá un título para la zona'); return; }
    if (!bounds) { setError('Definí la zona en el mapa'); return; }
    setError('');
    setIsAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch('/api/zone-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zona: { titulo, bounds, tipos, fecha } }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el análisis');

      setResult(data);
      setStep(4);

      // Guardar en Firestore
      await addDoc(collection(db, 'analisis_zonas'), {
        zona_titulo: titulo, bounds, fecha,
        hourly: data.hourly,
        peak_hours: data.peak_hours,
        commercial: data.commercial,
        map_image_url: data.map_image_url,
        createdAt: serverTimestamp(),
      });

      setHistorial(prev => [{ zona_titulo: titulo, fecha, ...data }, ...prev].slice(0, 5));
    } catch (e) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uploadToCloudinary = async (dataUrl) => {
    // Convertir dataUrl a Blob con atob (más confiable que fetch para data URIs)
    const [meta, b64] = dataUrl.split(',');
    const mime = meta.match(/:(.*?);/)[1];
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });

    const form = new FormData();
    form.append('file', blob, 'capture.png');
    form.append('upload_preset', 'Mariano_cargas_web');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (data.error) throw new Error(`Cloudinary: ${data.error.message}`);
    return data.secure_url;
  };

  const captureChart = async () => {
    if (!resultsRef.current) return null;
    setIsCapturing(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(resultsRef.current, { backgroundColor: '#1f2937', pixelRatio: 2, fontEmbedCSS: '' });
      return await uploadToCloudinary(dataUrl);
    } catch (e) {
      setChartCaptureError(e.message);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const captureHeatmap = async () => {
    if (!heatmapRef.current) return null;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(heatmapRef.current, { backgroundColor: '#111827', pixelRatio: 2, fontEmbedCSS: '' });
      return await uploadToCloudinary(dataUrl);
    } catch (e) {
      setChartCaptureError(e.message);
      return null;
    }
  };

  const handleGeneratePreview = async () => {
    if (!result) return;
    setShowPreview(true);
    setIsGeneratingPreview(true);
    setPreviewCaption('');
    setChartImageUrl(null);
    setHeatmapImageUrl(null);
    setChartCaptureError('');

    const [heatUrl, chartUrl, captionRes] = await Promise.all([
      captureHeatmap(),
      captureChart(),
      fetch('/api/zone-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone: pubTone,
          networks: pubNetwork,
          extraContext: extraContext.trim(),
          medios: selectedMedios,
          result: {
            zona_titulo:   result.zona_titulo,
            fecha:         result.fecha,
            summary:       result.summary,
            peak_hours:    result.peak_hours,
            valley_hour:   result.valley_hour,
            delta_minutes: result.delta_minutes,
            delta_percent: result.delta_percent,
            commercial: {
              total_places: result.commercial?.total_places,
              avg_rating:   result.commercial?.avg_rating,
              top_places:   result.commercial?.top_places,
              by_category:  result.commercial?.by_category,
            },
          },
        }),
      }).then(r => r.json()).catch(() => ({ caption: result.summary })),
    ]);

    if (heatUrl) setHeatmapImageUrl(heatUrl);
    if (chartUrl) setChartImageUrl(chartUrl);
    setPreviewCaption(captionRes.caption || result.summary || '');
    setIsGeneratingPreview(false);
  };

  const handlePublicar = async () => {
    if (!result) return;
    setIsPublishing(true);
    setPublishStatus('');
    try {
      const caption = previewCaption || result.summary;
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: caption,
          content: caption,
          networks: pubNetwork === 'Todas' ? ['linkedin', 'facebook', 'instagram'] : [pubNetwork.toLowerCase()],
          type: 'zone_analysis',
          useAI: true,
          aiProvider: 'gemini',
          // Heatmap como imagen principal (CDN público — funciona en Instagram)
          imageUrl: heatmapImageUrl || result.map_image_url,
          // Gráfico como imagen secundaria para LinkedIn/Facebook
          chartImageUrl: chartImageUrl || undefined,
          extra_context: extraContext.trim() || undefined,
          metadata: {
            tone: pubTone,
            zona_titulo: result.zona_titulo,
            summary: caption,
            peak_hours: result.peak_hours,
            commercial: result.commercial,
          },
        }),
      });
      if (!res.ok) throw new Error('Error al publicar');
      setPublishStatus('success');
    } catch (e) {
      setPublishStatus('error');
    } finally {
      setIsPublishing(false);
    }
  };

  const loadHistorialItem = (item) => {
    setTitulo(item.zona_titulo || '');
    if (item.bounds) setBounds(item.bounds);
    setResult(item);
    setStep(4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">🗺️ Análisis de Zona Urbana</h2>
          <p className="text-gray-400 text-sm mt-1">Tráfico vial + actividad comercial por zona y período</p>
        </div>
        {step > 1 && (
          <button onClick={() => { setStep(1); setResult(null); }} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Nueva zona
          </button>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex gap-2">
        {[{ n: 1, label: 'Zona' }, { n: 2, label: 'Resultados' }].map(s => (
          <div key={s.n} className={`flex items-center gap-1 text-xs ${step >= s.n ? 'text-purple-400' : 'text-gray-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-500'}`}>{s.n}</span>
            <span className="hidden sm:block">{s.label}</span>
            {s.n < 2 && <span className="text-gray-600 mx-1">→</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN — Config */}
        <div className="space-y-4">

          {/* PASO 1 — Zona */}
          <AnimatePresence>
            {step <= 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
                  Configurar Zona
                </h3>

                {/* Zona guardada */}
                {zonasGuardadas.length > 0 && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Cargar zona guardada</label>
                    <select
                      onChange={e => {
                        const z = zonasGuardadas.find(z => z.id === e.target.value);
                        if (z) { setTitulo(z.titulo); if (z.bounds) setBounds(z.bounds); setTipos(z.tipos || ['todos']); }
                      }}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
                    >
                      <option value="">— Elegir zona guardada —</option>
                      {zonasGuardadas.map(z => <option key={z.id} value={z.id}>{z.titulo}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Título de la zona</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej: Multitrocha Neuquén"
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Ubicación central</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={e => setAddressInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                      placeholder="Ej: Av. Argentina 1234, Neuquén"
                      className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-500"
                    />
                    <button
                      onClick={handleGeocode}
                      disabled={isGeocoding || !addressInput.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm transition-all"
                    >
                      {isGeocoding ? '⏳' : '🔍'}
                    </button>
                  </div>
                  {geocodeError && <p className="text-red-400 text-xs mt-1">{geocodeError}</p>}
                  {bounds && <p className="text-green-400 text-xs mt-1">📍 Centro: {((bounds.north + bounds.south) / 2).toFixed(5)}, {((bounds.east + bounds.west) / 2).toFixed(5)}</p>}
                </div>

                {bounds && (() => {
                  const cq = calcCuadras(bounds);
                  return (
                    <div className="bg-purple-900/30 border border-purple-700 rounded-lg px-3 py-2 text-xs text-purple-300 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>📐 Zona seleccionada · Arrastrá las esquinas para ajustar</span>
                        {cq && (
                          <span className="bg-purple-700/50 text-purple-200 rounded-full px-2 py-0.5 font-semibold text-[10px]">
                            {cq.cuadrasAncho}×{cq.cuadrasAlto} cua · {cq.metrosAncho}×{cq.metrosAlto}m
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 font-mono">
                        N {bounds.north.toFixed(5)} · S {bounds.south.toFixed(5)} · E {bounds.east.toFixed(5)} · O {bounds.west.toFixed(5)}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-gray-400 text-xs mb-2 block">Tipos de locales</label>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => toggleTipo(t.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tipos.includes(t.id) ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Día a analizar</label>
                  <input
                    type="date"
                    value={fecha}
                    max={yesterday}
                    onChange={e => setFecha(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">Solo fechas pasadas — datos reales de tráfico hora por hora (6:00 a 23:00)</p>
                </div>

                {/* Mini mapa */}
                <div ref={mapRef} className="w-full h-48 rounded-xl overflow-hidden border border-gray-600 bg-gray-700" />

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={handleAnalizar}
                  disabled={isAnalyzing || !titulo.trim() || !bounds}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Analizando 6:00–23:00…
                    </span>
                  ) : '🔍 Analizar tráfico por hora'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Historial */}
          {historial.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="text-white font-semibold text-sm mb-3">📋 Últimos análisis</h3>
              <div className="space-y-2">
                {historial.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => loadHistorialItem(item)}
                    className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all"
                  >
                    <p className="text-white text-xs font-medium">{item.zona_titulo}</p>
                    <p className="text-gray-500 text-xs">{item.fecha} · {item.commercial?.total_places} locales · pico {item.peak_hours?.[0]?.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Resultados */}
        <div className="space-y-4">
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* Mapa estático */}
                <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm">{result.zona_titulo}</h3>
                    {(() => { const cq = calcCuadras(bounds); return cq ? (
                      <span className="text-xs text-purple-400 bg-purple-900/30 border border-purple-700/50 px-2 py-1 rounded-full">
                        📐 {cq.cuadrasAncho}×{cq.cuadrasAlto} cuadras · {cq.metrosAncho}×{cq.metrosAlto}m
                      </span>
                    ) : <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">Zona rectangular</span>; })()}
                  </div>
                  <img src={result.map_image_url} alt="Mapa de zona" className="w-full h-52 object-cover" />
                </div>

                {/* Heatmap panel — capturado como imagen principal para redes */}
                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 overflow-x-auto">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Vista heatmap — imagen para publicación</p>
                  <div className="scale-[0.85] origin-top-left" style={{ width: '706px' }}>
                    <HeatmapPanel result={result} bounds={bounds} innerRef={heatmapRef} />
                  </div>
                </div>

                {/* Sección capturada para imagen de gráfico */}
                <div ref={resultsRef}>

                {/* Tráfico por hora */}
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">🚗 Tráfico por hora — {result.fecha}</h3>

                  {/* Resumen pico vs valle */}
                  {result.peak_hours?.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4 mt-3">
                      <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-center">
                        <p className="text-red-400 text-xs mb-1">🔴 Hora pico</p>
                        <p className="text-white text-xl font-bold">{result.peak_hours[0].label}</p>
                        <p className="text-gray-400 text-xs">{result.peak_hours[0].minutes} min de viaje</p>
                      </div>
                      <div className="bg-green-900/30 border border-green-800 rounded-xl p-3 text-center">
                        <p className="text-green-400 text-xs mb-1">🟢 Hora valle</p>
                        <p className="text-white text-xl font-bold">{result.valley_hour?.label}</p>
                        <p className="text-gray-400 text-xs">{result.valley_hour?.minutes} min de viaje</p>
                      </div>
                    </div>
                  )}

                  {result.delta_minutes > 0 && (
                    <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-center text-sm text-red-300 font-medium mb-4">
                      En hora pico tardás {result.delta_minutes} min más que en hora valle (+{result.delta_percent}%)
                    </div>
                  )}

                  {/* Gráfico de barras mejorado con intensidad */}
                  {result.hourly?.length > 0 && (() => {
                    const maxMin = Math.max(...result.hourly.filter(h => h.minutes).map(h => h.minutes), 1);
                    const colors = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#ef4444', UNKNOWN: '#4b5563' };
                    const bgHighlight = { LOW: '', MEDIUM: 'bg-yellow-900/10', HIGH: 'bg-red-900/20', UNKNOWN: '' };
                    const isPeak = (h) => result.peak_hours?.some(p => p.hour === h.hour);
                    return (
                      <div className="space-y-0.5">
                        {result.hourly.map(h => (
                          <div key={h.hour} className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${bgHighlight[h.congestion] || ''}`}>
                            <span className={`text-xs w-12 shrink-0 text-right font-mono ${h.congestion === 'HIGH' ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                              {h.label}
                            </span>
                            <div className="flex-1 bg-gray-700 rounded-full h-5 overflow-hidden">
                              <div
                                className="h-full rounded-full flex items-center pl-2 text-xs font-medium transition-all"
                                style={{
                                  width: h.minutes ? `${Math.max((h.minutes / maxMin) * 100, 8)}%` : '4%',
                                  backgroundColor: colors[h.congestion] || colors.UNKNOWN,
                                  color: h.congestion === 'LOW' ? '#064e3b' : '#fff',
                                }}
                              >
                                {h.minutes ? `${h.minutes}m` : '–'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 w-16 justify-end">
                              {isPeak(h) && <span className="text-red-400 text-[9px] font-bold">PICO</span>}
                              {h.open_count !== null && (
                                <span className="text-blue-300 text-xs" title="Comercios abiertos">🏪{h.open_count}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Top 3 horas pico */}
                  {result.peak_hours?.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-700">
                      <p className="text-gray-400 text-xs mb-2 font-medium">Top horas de mayor congestión</p>
                      <div className="flex gap-2">
                        {result.peak_hours.map((h, i) => (
                          <div key={i} className="flex-1 bg-red-900/20 border border-red-800/40 rounded-lg p-2 text-center">
                            <p className="text-white text-sm font-bold">{h.label}</p>
                            <p className="text-red-400 text-xs">{h.minutes} min</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Zona Comercial — resumen compacto */}
                {result.commercial?.total_places > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold text-sm">🏪 Zona Comercial</h3>
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span><span className="text-white font-bold">{result.commercial.total_places}</span> locales</span>
                        <span><span className="text-yellow-400 font-bold">⭐{result.commercial.avg_rating}</span> promedio</span>
                      </div>
                    </div>

                    {/* Breakdown por categoría */}
                    {result.commercial.by_category && Object.keys(result.commercial.by_category).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(result.commercial.by_category)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, count]) => (
                            <span key={cat} className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">
                              {cat} <span className="text-white font-semibold">{count >= 20 ? '+20' : count}</span>
                            </span>
                          ))}
                      </div>
                    )}

                    {result.commercial.top_places?.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-gray-700">
                        {result.commercial.top_places.map((p, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                              <div className="min-w-0">
                                <p className="text-white text-xs font-medium truncate">{p.name}</p>
                                <p className="text-gray-500 text-xs">{p.type.replace(/_/g, ' ')}</p>
                              </div>
                            </div>
                            <span className="text-yellow-400 text-xs shrink-0 ml-2">⭐{p.rating}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                </div>{/* fin resultsRef */}

                {/* Publicar */}
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <button onClick={() => setShowPublish(!showPublish)} className="w-full flex items-center justify-between text-white font-semibold text-sm">
                    <span>📢 Publicar análisis en redes</span>
                    <span className="text-gray-400">{showPublish ? '▲' : '▼'}</span>
                  </button>

                  <AnimatePresence>
                    {showPublish && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4 overflow-hidden">

                        {/* Red social */}
                        <div>
                          <label className="text-gray-400 text-xs mb-2 block">Red social</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { id: 'Instagram', icon: '📸' },
                              { id: 'Facebook', icon: '👥' },
                              { id: 'LinkedIn', icon: '💼' },
                              { id: 'Todas', icon: '🌐' },
                            ].map(({ id, icon }) => (
                              <button key={id} onClick={() => setPubNetwork(id)}
                                className={`py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${pubNetwork === id ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                <span>{icon}</span>
                                <span>{id}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tono */}
                        <div>
                          <label className="text-gray-400 text-xs mb-2 block">Tono del reporte</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'técnico', icon: '📐', desc: 'Datos precisos' },
                              { id: 'comercial', icon: '💰', desc: 'Oportunidades' },
                              { id: 'social', icon: '🧑‍🤝‍🧑', desc: 'Vida cotidiana' },
                            ].map(({ id, icon, desc }) => (
                              <button key={id} onClick={() => { setPubTone(id); setShowPreview(false); }}
                                className={`py-2 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${pubTone === id ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                <span className="text-base">{icon}</span>
                                <span className="capitalize font-semibold">{id}</span>
                                <span className="opacity-70 text-[10px]">{desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Contexto */}
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">
                            Contexto para Gemini <span className="text-gray-600">(opcional)</span>
                          </label>
                          <textarea
                            value={extraContext}
                            onChange={e => { setExtraContext(e.target.value); setShowPreview(false); }}
                            rows={2}
                            placeholder="Ej: Análisis para cliente inmobiliario. Destacar crecimiento comercial de la zona norte."
                            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 resize-none placeholder-gray-500"
                          />
                        </div>

                        {/* Medios locales */}
                        <div>
                          <label className="text-gray-400 text-xs mb-2 block">
                            📰 Mencionar medios locales <span className="text-gray-600">(opcional)</span>
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {MEDIOS_LOCALES.map(({ handle, label }) => {
                              const active = selectedMedios.includes(handle);
                              return (
                                <button
                                  key={handle}
                                  onClick={() => {
                                    setSelectedMedios(prev =>
                                      active ? prev.filter(h => h !== handle) : [...prev, handle]
                                    );
                                    setShowPreview(false);
                                  }}
                                  className={`px-2 py-1 rounded-full text-[11px] font-medium transition-all ${active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                  {active ? '✓ ' : ''}{handle}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Botón generar preview */}
                        {!showPreview && (
                          <button
                            onClick={handleGeneratePreview}
                            disabled={isGeneratingPreview || isCapturing}
                            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                          >
                            {(isGeneratingPreview || isCapturing)
                              ? <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Generando preview...</>
                              : '👁️ Ver preview antes de publicar'}
                          </button>
                        )}

                        {/* PREVIEW PANEL */}
                        <AnimatePresence>
                          {showPreview && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="space-y-4 border-t border-gray-700 pt-4"
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-white font-semibold text-sm">👁️ Vista Previa</p>
                                <button
                                  onClick={handleGeneratePreview}
                                  disabled={isGeneratingPreview}
                                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                  ↺ Regenerar
                                </button>
                              </div>

                              {/* Imágenes preview */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-gray-500 text-[10px] mb-1 uppercase tracking-wider">Imagen 1 — Heatmap (Instagram)</p>
                                  {heatmapImageUrl
                                    ? <img src={heatmapImageUrl} alt="Heatmap" className="w-full h-28 object-cover rounded-lg border border-purple-700/50" />
                                    : <div className="w-full h-28 bg-gray-700 rounded-lg flex items-center justify-center">
                                        {isGeneratingPreview
                                          ? <span className="text-gray-500 text-xs">📸 Capturando heatmap...</span>
                                          : chartCaptureError
                                            ? <span className="text-red-400 text-[10px] text-center px-2">⚠️ {chartCaptureError}</span>
                                            : <span className="text-gray-500 text-xs">—</span>
                                        }
                                      </div>
                                  }
                                </div>
                                <div>
                                  <p className="text-gray-500 text-[10px] mb-1 uppercase tracking-wider">Imagen 2 — Gráfico (LinkedIn/FB)</p>
                                  {chartImageUrl
                                    ? <img src={chartImageUrl} alt="Gráfico de tráfico" className="w-full h-28 object-cover rounded-lg border border-gray-700" />
                                    : <div className="w-full h-28 bg-gray-700 rounded-lg flex items-center justify-center">
                                        {isGeneratingPreview
                                          ? <span className="text-gray-500 text-xs">📸 Capturando gráfico...</span>
                                          : <span className="text-gray-500 text-xs">—</span>
                                        }
                                      </div>
                                  }
                                </div>
                              </div>

                              {/* Caption editable */}
                              <div>
                                <p className="text-gray-500 text-[10px] mb-1 uppercase tracking-wider">
                                  Caption generado — <span className="text-purple-400 capitalize">{pubTone}</span> · {pubNetwork}
                                </p>
                                {isGeneratingPreview
                                  ? <div className="bg-gray-700 rounded-lg p-3 text-gray-400 text-xs animate-pulse h-24">Generando con Gemini...</div>
                                  : <textarea
                                      value={previewCaption}
                                      onChange={e => setPreviewCaption(e.target.value)}
                                      rows={7}
                                      className="w-full bg-gray-700 border border-purple-600/40 text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                                    />
                                }
                                <p className="text-gray-600 text-[10px] mt-1 text-right">{previewCaption.length} / 2000 caracteres</p>
                              </div>

                              {/* Status + Publicar */}
                              {publishStatus === 'success' && <p className="text-green-400 text-sm text-center">✅ Enviado a Make.com correctamente</p>}
                              {publishStatus === 'error' && <p className="text-red-400 text-sm text-center">❌ Error al publicar. Intentá de nuevo.</p>}

                              <button
                                onClick={handlePublicar}
                                disabled={isPublishing || isGeneratingPreview || !previewCaption}
                                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                              >
                                {isPublishing
                                  ? <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Publicando...</>
                                  : `🚀 Publicar en ${pubNetwork}`}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {!result && step < 4 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800 rounded-xl p-8 border border-gray-700 border-dashed flex flex-col items-center justify-center gap-3 min-h-64">
                <span className="text-5xl">🗺️</span>
                <p className="text-gray-400 text-sm text-center">Configurá la zona y los períodos<br />para ver el análisis aquí</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
