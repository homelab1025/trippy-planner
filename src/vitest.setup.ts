import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver; provide a no-op stub so components
// that use it (e.g. ResponsiveContainer) don't throw in tests.
(globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
