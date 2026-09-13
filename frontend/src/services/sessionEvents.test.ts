import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sessionEvents', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('notifySessionExpired calls all registered listeners', async () => {
    const { notifySessionExpired, onSessionExpired } = await import('./sessionEvents');
    const a = vi.fn();
    const b = vi.fn();
    onSessionExpired(a);
    onSessionExpired(b);

    notifySessionExpired();

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('a listener can unsubscribe and stops receiving notifications', async () => {
    const { notifySessionExpired, onSessionExpired } = await import('./sessionEvents');
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    unsubscribe();

    notifySessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });
});
