// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNewUiTheme } from './useNewUiTheme';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('useNewUiTheme', () => {
  it('returns false when there is no ui query param', () => {
    window.history.pushState({}, '', '/');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(false);
  });

  it('returns false when ui has an unrelated value', () => {
    window.history.pushState({}, '', '/?ui=old');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(false);
  });

  it('returns true when ui=new', () => {
    window.history.pushState({}, '', '/?ui=new');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(true);
  });

  it('returns true when ui=new is combined with other params', () => {
    window.history.pushState({}, '', '/?token=abc&ui=new');
    const { result } = renderHook(() => useNewUiTheme());
    expect(result.current).toBe(true);
  });
});
