// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapComponent } from './MapComponent';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: ({ center }: { center: [number, number] }) => (
    <div data-testid="circle-marker" data-lat={center[0]} data-lng={center[1]} />
  ),
  useMap: () => ({ fitBounds: vi.fn() }),
}));

vi.mock('leaflet', () => ({
  default: { latLngBounds: vi.fn(() => ({})) },
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockRoute = {
  name: 'Test',
  totalDistance: 1000,
  totalElevationGain: 10,
  originalPointCount: 3,
  points: [
    { lat: 48.0,   lng: 2.0,   ele: 100, distance: 0    },
    { lat: 48.005, lng: 2.005, ele: 105, distance: 500  },
    { lat: 48.01,  lng: 2.01,  ele: 110, distance: 1000 },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MapComponent', () => {
  it('renders map container with route', () => {
    render(<MapComponent route={mockRoute} hoveredPoint={null} />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders no circle markers when hoveredPoint is null', () => {
    render(<MapComponent route={mockRoute} hoveredPoint={null} />);
    expect(screen.queryAllByTestId('circle-marker')).toHaveLength(0);
  });

  it('renders two circle markers when hoveredPoint is set', () => {
    render(<MapComponent route={mockRoute} hoveredPoint={{ lat: 48.005, lng: 2.005 }} />);
    expect(screen.queryAllByTestId('circle-marker')).toHaveLength(2);
  });
});
