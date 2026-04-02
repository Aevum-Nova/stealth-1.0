import { lazy, type ComponentType } from "react";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/** Session flag: we already triggered one full reload for a stale chunk (post-deploy). */
const CHUNK_RELOAD_KEY = "v_chunk_reload";

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

/**
 * Wraps React.lazy() with retry logic for chunk load failures.
 * Handles transient network errors. After a deploy, hashed chunk URLs change while
 * users may still run an old main bundle — retries alone cannot fix that; we do
 * one full page reload so the browser fetches fresh index + asset manifest.
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
        const mod = await importFn();
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return mod;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }
    }

    if (isChunkLoadError(lastError) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
      return await new Promise(() => {
        /* never resolves; page is unloading */
      });
    }

    throw lastError;
  });
}
