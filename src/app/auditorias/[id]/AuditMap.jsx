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

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 14);
      return;
    }
    map.fitBounds(points.map(p => [p.lat, p.lon]), { padding: [30, 30] });
  }, [points, map]);
  return null;
}

export default function AuditMap({ results = [] }) {
  const points = results.filter(r => typeof r.lat === 'number' && typeof r.lon === 'number');
  if (!points.length) return null;

  return (
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
  );
}
