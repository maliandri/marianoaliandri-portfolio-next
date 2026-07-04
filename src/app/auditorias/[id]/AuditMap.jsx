'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';

function scoreColor(s) {
  if (s == null) return '#9ca3af';
  if (s < 40) return '#ef4444';
  if (s < 70) return '#f59e0b';
  return '#22c55e';
}

// Distancia aproximada en km entre dos [lat, lon] (Haversine)
function distKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Descarta puntos lejanos al centro real del cluster (coords mal cargadas o sedes de afuera)
function filterInliers(points, radioKm) {
  if (points.length <= 2) return points;
  const center = [median(points.map(p => p.lat)), median(points.map(p => p.lon))];
  const threshold = Math.max((radioKm || 20) * 3, 100); // km alrededor del centro
  const inliers = points.filter(p => distKm(center, [p.lat, p.lon]) <= threshold);
  return inliers.length ? inliers : points;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 13);
      return;
    }
    map.fitBounds(points.map(p => [p.lat, p.lon]), { padding: [40, 40], maxZoom: 14 });
  }, [points, map]);
  return null;
}

export default function AuditMap({ results = [], radioKm = 20 }) {
  const all = results.filter(r => typeof r.lat === 'number' && typeof r.lon === 'number');
  if (!all.length) return null;

  const points = filterInliers(all, radioKm);
  const hidden = all.length - points.length;

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 420 }}>
        <MapContainer center={[points[0].lat, points[0].lon]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitBounds points={points} />
          {points.map((r, i) => {
            const color = scoreColor(r.seoScore);
            return (
              <CircleMarker
                key={r.id || i}
                center={[r.lat, r.lon]}
                radius={8}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{r.nombre}</strong><br />
                    {r.ciudad ? <>{r.ciudad}<br /></> : null}
                    Score SEO: <b style={{ color }}>{r.seoScore ?? '—'}/100</b>
                    {r.siteUrl ? <><br /><a href={r.siteUrl} target="_blank" rel="noopener noreferrer">Ver sitio ↗</a></> : null}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      {hidden > 0 && (
        <p className="text-[11px] text-gray-600 mt-1.5">
          {hidden} negocio{hidden !== 1 ? 's' : ''} fuera de la zona {hidden !== 1 ? 'no se muestran' : 'no se muestra'} en el mapa (ubicación lejana o mal cargada).
        </p>
      )}
    </>
  );
}
