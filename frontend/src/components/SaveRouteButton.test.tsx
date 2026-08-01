// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveRouteButton } from './SaveRouteButton';

const mocks = vi.hoisted(() => ({
  createRoute: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  routesApi: { createRoute: mocks.createRoute },
}));

const routeData = {
  name: 'My Ride',
  gpxContent: '<gpx/>',
  avgSpeedKmh: 20,
  startTime: new Date().toISOString(),
};

describe('SaveRouteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('calls createRoute immediately when authenticated', async () => {
    mocks.createRoute.mockResolvedValue({ data: { id: 'abc', ...routeData } });
    const onSaved = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={true}
        routeData={routeData}
        onSaved={onSaved}
        onRequireAuth={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save route/i }));

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith(routeData);
      expect(onSaved).toHaveBeenCalledWith('abc');
    });
  });

  it('calls onRequireAuth instead of createRoute when not authenticated', () => {
    const onRequireAuth = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={false}
        routeData={routeData}
        onSaved={vi.fn()}
        onRequireAuth={onRequireAuth}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save route/i }));

    expect(onRequireAuth).toHaveBeenCalled();
    expect(mocks.createRoute).not.toHaveBeenCalled();
  });
});
