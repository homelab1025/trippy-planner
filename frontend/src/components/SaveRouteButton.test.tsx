// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveRouteButton } from './SaveRouteButton';

const mocks = vi.hoisted(() => ({
  createRoute: vi.fn(),
  updateRoute: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  routesApi: { createRoute: mocks.createRoute, updateRoute: mocks.updateRoute },
}));

const routeData = {
  gpxContent: '<gpx/>',
  avgSpeedKmh: 20,
  startTime: new Date().toISOString(),
  checkpointsJson: '[{"id":"end","distanceM":1000}]',
};

describe('SaveRouteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders the name pre-filled in an editable input', () => {
    render(
      <SaveRouteButton
        isAuthenticated={true}
        name="My Ride"
        onNameChange={vi.fn()}
        routeData={routeData}
        savedRouteId={null}
        onSaved={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/route name/i)).toHaveValue('My Ride');
  });

  it('calls onNameChange when the name input is edited', () => {
    const onNameChange = vi.fn();
    render(
      <SaveRouteButton
        isAuthenticated={true}
        name="My Ride"
        onNameChange={onNameChange}
        routeData={routeData}
        savedRouteId={null}
        onSaved={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/route name/i), { target: { value: 'Coastal Loop' } });

    expect(onNameChange).toHaveBeenCalledWith('Coastal Loop');
  });

  it('creates a new route when no saved route id is tracked', async () => {
    mocks.createRoute.mockResolvedValue({ data: { id: 'abc' } });
    const onSaved = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={true}
        name="My Ride"
        onNameChange={vi.fn()}
        routeData={routeData}
        savedRouteId={null}
        onSaved={onSaved}
        onRequireAuth={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save route/i }));

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith({ name: 'My Ride', ...routeData });
      expect(mocks.updateRoute).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith('abc');
    });
  });

  it('calls onRequireAuth instead of saving when not authenticated', () => {
    const onRequireAuth = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={false}
        name="My Ride"
        onNameChange={vi.fn()}
        routeData={routeData}
        savedRouteId={null}
        onSaved={vi.fn()}
        onRequireAuth={onRequireAuth}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save route/i }));

    expect(onRequireAuth).toHaveBeenCalled();
    expect(mocks.createRoute).not.toHaveBeenCalled();
  });

  it('updates the existing route instead of creating a duplicate when a saved route id is tracked', async () => {
    mocks.updateRoute.mockResolvedValue({ data: { id: 'existing-id' } });
    const onSaved = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={true}
        name="My Ride"
        onNameChange={vi.fn()}
        routeData={routeData}
        savedRouteId="existing-id"
        onSaved={onSaved}
        onRequireAuth={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mocks.updateRoute).toHaveBeenCalledWith('existing-id', {
        name: 'My Ride',
        avgSpeedKmh: routeData.avgSpeedKmh,
        startTime: routeData.startTime,
        checkpointsJson: routeData.checkpointsJson,
      });
      expect(mocks.createRoute).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith('existing-id');
    });
  });

  it('offers "Save as new" once a route is already tracked, which creates a duplicate instead of updating', async () => {
    mocks.createRoute.mockResolvedValue({ data: { id: 'new-fork-id' } });
    const onSaved = vi.fn();

    render(
      <SaveRouteButton
        isAuthenticated={true}
        name="My Ride"
        onNameChange={vi.fn()}
        routeData={routeData}
        savedRouteId="existing-id"
        onSaved={onSaved}
        onRequireAuth={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save as new/i }));

    await waitFor(() => {
      expect(mocks.createRoute).toHaveBeenCalledWith({ name: 'My Ride', ...routeData });
      expect(mocks.updateRoute).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith('new-fork-id');
    });
  });

  it('does not offer "Save as new" when no route has been saved yet', () => {
    render(
      <SaveRouteButton
        isAuthenticated={true}
        name="My Ride"
        onNameChange={vi.fn()}
        routeData={routeData}
        savedRouteId={null}
        onSaved={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /save as new/i })).not.toBeInTheDocument();
  });
});
