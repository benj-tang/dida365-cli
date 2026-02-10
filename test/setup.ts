/**
 * Test setup and mocks
 */
import { vi, beforeEach, afterEach } from "vitest";

// Mock console for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  vi.restoreAllMocks();
});

// Mock fetch globally
globalThis.fetch = vi.fn();
