import { lazy, type ComponentType } from "react";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Wraps React.lazy() with retry logic for chunk load failures.
 * Handles transient network errors and cache mismatches (e.g. after deploys)
 * that cause "Failed to fetch dynamically imported module".
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = RETRY_ATTEMPTS,
  retryDelay = RETRY_DELAY_MS
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }
    }
    throw lastError;
  });
}
