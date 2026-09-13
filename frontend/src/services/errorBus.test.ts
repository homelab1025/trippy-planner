import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('errorBus', () => {
  beforeEach(() => {
    // Module holds state at module scope — force a fresh instance per test.
    vi.resetModules();
  });

  it('reportError adds an entry and notifies subscribers', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    const seen: { id: number; message: string }[][] = [];
    subscribeErrors(entries => seen.push(entries));

    reportError('Something failed');

    expect(seen).toHaveLength(2); // initial empty snapshot, then the update
    expect(seen[1]).toEqual([{ id: 1, message: 'Something failed' }]);
  });

  it('dismissError removes only the matching entry', async () => {
    const { reportError, dismissError, subscribeErrors } = await import('./errorBus');
    reportError('First');
    reportError('Second');
    let latest: { id: number; message: string }[] = [];
    subscribeErrors(entries => { latest = entries; });

    dismissError(1);

    expect(latest.map(e => e.message)).toEqual(['Second']);
  });

  it('a listener subscribing after an entry exists receives it immediately', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    reportError('Already here');

    let received: { message: string }[] = [];
    subscribeErrors(entries => { received = entries; });

    expect(received.map(e => e.message)).toEqual(['Already here']);
  });

  it('multiple reportError calls stack rather than replace', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    let latest: { message: string }[] = [];
    subscribeErrors(entries => { latest = entries; });

    reportError('One');
    reportError('Two');

    expect(latest.map(e => e.message)).toEqual(['One', 'Two']);
  });

  it('subscribeErrors returns an unsubscribe function that stops further updates', async () => {
    const { reportError, subscribeErrors } = await import('./errorBus');
    const seen: number[] = [];
    const unsubscribe = subscribeErrors(entries => seen.push(entries.length));
    unsubscribe();

    reportError('After unsubscribe');

    expect(seen).toEqual([0]); // only the initial snapshot, no update after unsubscribing
  });
});
