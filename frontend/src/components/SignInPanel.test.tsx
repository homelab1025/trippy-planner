// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignInPanel } from './SignInPanel';

const mocks = vi.hoisted(() => ({
  requestMagicLink: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  authApi: { requestMagicLink: mocks.requestMagicLink },
}));

describe('SignInPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders nothing when closed', () => {
    render(<SignInPanel open={false} onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/your email/i)).not.toBeInTheDocument();
  });

  it('shows the email form when open', () => {
    render(<SignInPanel open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/your email/i)).toBeInTheDocument();
  });

  it('sends magic link when email submitted', async () => {
    mocks.requestMagicLink.mockResolvedValue({});

    render(<SignInPanel open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/your email/i), {
      target: { value: 'rider@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send link/i }));

    await waitFor(() => {
      expect(mocks.requestMagicLink).toHaveBeenCalledWith({ email: 'rider@example.com' });
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<SignInPanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
