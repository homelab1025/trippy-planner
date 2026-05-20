import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteData } from '../utils/gpxParser';
const pinIcon = (color: string) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.2 12.5 28.5 12.5 28.5S25 21.7 25 12.5C25 5.6 19.4 0 12.5 0z"
      fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="12.5" cy="12.5" r="4.5" fill="white" opacity="0.8"/>
  </svg>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const DefaultIcon = pinIcon('#2A81CB');
const RedIcon = pinIcon('#e63946');

L.Marker.prototype.options.icon = DefaultIcon;

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
  weatherPoints: any[];
  hoveredIndex: number | null;
}

const MapComponent: React.FC<MapComponentProps> = ({ route, weatherPoints, hoveredIndex }) => {
  const positions = route.points.map(p => [p.lat, p.lng] as [number, number]);
  const center = positions[0];
  const markerRefs = useRef<(L.Marker | null)[]>([]);

  useEffect(() => {
    markerRefs.current.forEach((marker, idx) => {
      if (marker) marker.setIcon(idx === hoveredIndex ? RedIcon : DefaultIcon);
    });
  }, [hoveredIndex]);

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
        <Marker key={idx} position={[wp.point.lat, wp.point.lng]} ref={(m) => { markerRefs.current[idx] = m; }}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{Math.round(wp.temp)}°C</strong><br />
              {wp.condition}<br />
              <small>Wind: {wp.windSpeed} km/h</small>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;
