/**
 * Application-wide in-memory cache for External KDB listings.
 * Shared across KDB page and KDBSelector to avoid redundant API calls.
 */

export interface ExternalKdbEntry {
  id: string;
  name: string;
  baseUrl: string;
  repoId: string;
  description: string | null;
}

interface CacheEntry {
  kdbs: ExternalKdbEntry[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: CacheEntry | null = null;
let inflightRequest: Promise<ExternalKdbEntry[]> | null = null;

export function getCachedKdbs(): ExternalKdbEntry[] | null {
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    cached = null;
    return null;
  }
  return cached.kdbs;
}

export function setCachedKdbs(kdbs: ExternalKdbEntry[]): void {
  cached = { kdbs, fetchedAt: Date.now() };
}

export function clearKdbCache(): void {
  cached = null;
  inflightRequest = null;
}

/**
 * Fetch external KDBs with deduplication — concurrent callers share one request.
 * Returns cached data instantly when available.
 */
export async function fetchKdbsWithCache(): Promise<ExternalKdbEntry[]> {
  const fromCache = getCachedKdbs();
  if (fromCache) return fromCache;

  if (inflightRequest) return inflightRequest;

  inflightRequest = (async () => {
    try {
      const res = await fetch("/api/backend/kdb/external");
      if (!res.ok) throw new Error(`Failed to fetch external KDBs (${res.status})`);
      const data = (await res.json()) as ExternalKdbEntry[];
      setCachedKdbs(data);
      return data;
    } finally {
      inflightRequest = null;
    }
  })();

  return inflightRequest;
}
