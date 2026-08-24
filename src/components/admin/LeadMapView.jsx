'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';

export function scoreColor(seoScore, hasWebsite) {
  if (hasWebsite === false) return '#a855f7'; // sin sitio — la mejor oportunidad
  if (seoScore == null) return '#9ca3af';      // pendiente de auditar
  if (seoScore < 40) return '#ef4444';
  if (seoScore < 70) return '#f59e0b';
  return '#22c55e';
}

// Recentra/ajusta el mapa cuando cambia la ubicación del usuario o llegan resultados nuevos.
function RecenterOnLocation({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom() < 14 ? 15 : map.getZoom());
  }, [center, map]);
  return null;
}

export default function LeadMapView({ userLocation, businesses = [], onSelect, height = '100%' }) {
  if (!userLocation) return null;
  const center = [userLocation.lat, userLocation.lon];

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer center={center} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          crossOrigin="anonymous"
        />
        <RecenterOnLocation center={center} />

        {/* Mi ubicación */}
        <CircleMarker center={center} radius={9} pathOptions={{ color: '#93c5fd', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}>
          <Popup>📍 Tu ubicación</Popup>
        </CircleMarker>

        {businesses.map(b => {
          if (typeof b.lat !== 'number' || typeof b.lon !== 'number') return null;
          const color = scoreColor(b.seoScore, b.hasWebsite);
          return (
            <CircleMarker
              key={b.id}
              center={[b.lat, b.lon]}
              radius={7}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
              eventHandlers={{ click: () => onSelect?.(b) }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{b.nombre}</strong><br />
                  <span style={{ color: '#6b7280' }}>{b.tipo}</span>
                  {b.rating ? <span style={{ color: '#d97706' }}> · ★ {b.rating}</span> : null}
                  <br />
                  {b.hasWebsite === null && <span style={{ color: '#9ca3af' }}>Auditando…</span>}
                  {b.hasWebsite === false && <span style={{ color: '#a855f7', fontWeight: 600 }}>Sin sitio web</span>}
                  {b.hasWebsite === true && (
                    <>
                      SEO: <b style={{ color }}>{b.seoScore ?? '…'}{b.seoScore != null ? '/100' : ''}</b>
                      {b.siteUrl && <><br /><a href={b.siteUrl} target="_blank" rel="noopener noreferrer">Ver sitio ↗</a></>}
                    </>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
