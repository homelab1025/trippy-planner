// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorPanel } from './ErrorPanel';

const mocks = vi.hoisted(() => ({
  subscribeErrors: vi.fn(),
  dismissError: vi.fn(),
}));

vi.mock('../services/errorBus', () => ({
  subscribeErrors: mocks.subscribeErrors,
  dismissError: mocks.dismissError,
}));

describe('ErrorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders nothing with no entries', () => {
    mocks.subscribeErrors.mockImplementation(listener => {
      listener([]);
      return () => {};
    });

    const { container } = render(<ErrorPanel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one alert per entry', () => {
    mocks.subscribeErrors.mockImplementation(listener => {
      listener([
        { id: 1, message: 'First problem' },
        { id: 2, message: 'Second problem' },
      ]);
      return () => {};
    });

    render(<ErrorPanel />);

    expect(screen.getByText('First problem')).toBeInTheDocument();
    expect(screen.getByText('Second problem')).toBeInTheDocument();
  });

  it('clicking a dismiss button removes only that entry', () => {
    mocks.subscribeErrors.mockImplementation(listener => {
      listener([
        { id: 1, message: 'First problem' },
        { id: 2, message: 'Second problem' },
      ]);
      return () => {};
    });

    render(<ErrorPanel />);
    fireEvent.click(screen.getByLabelText('Dismiss: First problem'));

    expect(mocks.dismissError).toHaveBeenCalledWith(1);
    expect(mocks.dismissError).not.toHaveBeenCalledWith(2);
  });
});
