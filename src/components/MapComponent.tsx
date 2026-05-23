import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteData } from '../utils/gpxParser';

function FitBounds({ route }: { route: RouteData }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(route.points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [route, map]);
  return null;
}

interface MapComponentProps {
  route: RouteData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weatherPoints: any[];
  hoveredPoint: { lat: number; lng: number } | null;
}

const MapComponent: React.FC<MapComponentProps> = ({ route, weatherPoints, hoveredPoint }) => {
  // Stable reference prevents react-leaflet from calling setLatLngs on every hover re-render
  const positions = useMemo(
    () => route.points.map(p => [p.lat, p.lng] as [number, number]),
    [route]
  );
  const center = positions[0];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds route={route} />
      <Polyline positions={positions} color="#2d5a27" weight={5} opacity={0.7} />

      {weatherPoints.map((wp, idx) => (
        <CircleMarker
          key={idx}
          center={[wp.point.lat, wp.point.lng]}
          radius={4}
          pathOptions={{ fillColor: '#888', fillOpacity: 0.7, stroke: false }}
        />
      ))}

      {hoveredPoint && (<>
        <CircleMarker
          center={[hoveredPoint.lat, hoveredPoint.lng]}
          radius={24}
          pathOptions={{ fillColor: '#FF6B00', fillOpacity: 0.12, stroke: false }}
        />
        <CircleMarker
          center={[hoveredPoint.lat, hoveredPoint.lng]}
          radius={10}
          pathOptions={{ fillColor: '#FF6B00', fillOpacity: 1, stroke: true, color: 'white', weight: 2.5 }}
        />
      </>)}
    </MapContainer>
  );
};

export default MapComponent;
