/**
 * faceModelData.ts
 *
 * Fetches the Haar cascade XML via our own Next.js proxy (/api/haar)
 * — no CORS issues since the fetch happens server-side.
 * Caches the result in localStorage so subsequent calls are instant
 * and work offline after the first page load.
 */

const CACHE_KEY = 'haar_frontalface_v4x';

export async function getHaarCascadeXML(): Promise<string> {
  // 1. localStorage cache — instant + offline
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && cached.startsWith('<')) return cached;
  } catch { /* private browsing */ }

  // 2. Proxy route — server-side fetch, no CORS
  const resp = await fetch('/api/haar');
  if (!resp.ok) throw new Error(`Cascade proxy failed: HTTP ${resp.status}`);
  const xml = await resp.text();

  // 3. Persist for next time
  try {
    localStorage.setItem(CACHE_KEY, xml);
  } catch { /* quota exceeded */ }

  return xml;
}
