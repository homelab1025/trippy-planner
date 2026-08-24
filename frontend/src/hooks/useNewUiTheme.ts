import { useMemo } from 'react';

/**
 * True when the page was loaded with ?ui=new. Derived once per mount from
 * the URL — there is no persistence (no localStorage), so a reload without
 * the param reverts to the default theme.
 */
export function useNewUiTheme(): boolean {
  return useMemo(
    () => new URLSearchParams(window.location.search).get('ui') === 'new',
    []
  );
}
