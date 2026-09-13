// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ErrorPanel } from './ErrorPanel';
import { reportError } from '../services/errorBus';

// This file deliberately does NOT mock '../services/errorBus' — it exercises the real
// reportError -> notify -> subscribeErrors(setEntries) -> DOM -> dismissError -> DOM wiring
// end-to-end, which every other test in this repo mocks one half of.
describe('ErrorPanel <-> errorBus integration', () => {
  it('renders a reported error and removes it on dismiss', async () => {
    render(<ErrorPanel />);

    act(() => {
      reportError('Something went wrong');
    });

    const alert = screen.getByText('Something went wrong');
    expect(alert).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss: Something went wrong');
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
