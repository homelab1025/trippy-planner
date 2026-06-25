import '@testing-library/jest-dom/vitest';
import { JSDOM } from 'jsdom';

// Polyfill localStorage for jsdom in Node.js test environment
// (jsdom 29+ no longer provides localStorage by default)
const dom = new JSDOM('', { url: 'http://localhost/' });
globalThis.localStorage = dom.window.localStorage;
