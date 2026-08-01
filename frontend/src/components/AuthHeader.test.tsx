// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthHeader } from './AuthHeader';

describe('AuthHeader', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows a Sign in button when logged out', () => {
    const onSignIn = vi.fn();
    render(<AuthHeader user={null} onSignOut={vi.fn()} onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the user email and Sign out button when logged in', () => {
    render(
      <AuthHeader
        user={{ id: 1, email: 'rider@example.com' }}
        onSignOut={vi.fn()}
        onSignIn={vi.fn()}
      />
    );

    expect(screen.getByText('rider@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('calls onSignOut when sign-out is clicked', () => {
    const onSignOut = vi.fn();
    render(<AuthHeader user={{ id: 1, email: 'a@b.com' }} onSignOut={onSignOut} onSignIn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
