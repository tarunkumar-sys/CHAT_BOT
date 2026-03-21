import { chromium } from 'playwright';
import { URL } from 'url';

interface CrawlOptions {
  maxPages?: number;
}

export async function crawlWebsite(startUrl: string, options: CrawlOptions = {}): Promise<string[]> {
  const { maxPages = 15 } = options;
  const visited = new Set<string>();
  const contentHashes = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: string[] = [];

  const domain = new URL(startUrl).hostname;
  console.log(`[Crawler] Starting crawl of ${startUrl} (max ${maxPages} pages)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Block non-essential resources
  await context.route('**/*', (route) => {
    const rt = route.request().resourceType();
    const url = route.request().url();

    if (['image', 'media', 'font', 'other'].includes(rt)) {
      return route.abort();
    }
    if (
      url.includes('analytics') ||
      url.includes('tracking') ||
      url.includes('doubleclick') ||
      url.includes('facebook.com') ||
      url.includes('twitter.com') ||
      url.includes('google-analytics') ||
      /\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot)(\?|$)/i.test(url)
    ) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }

    if (parsed.hostname !== domain) continue;

    const cleanUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '') || `${parsed.protocol}//${parsed.hostname}`;
    if (visited.has(cleanUrl)) continue;
    visited.add(cleanUrl);

    try {
      console.log(`[Crawler] Fetching: ${cleanUrl}`);

      // Navigate — use 'load' with a generous timeout; fall back to domcontentloaded
      try {
        await page.goto(cleanUrl, { waitUntil: 'load', timeout: 20000 });
      } catch {
        try {
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch {
          console.warn(`[Crawler] Navigation timeout for ${cleanUrl}, trying networkidle...`);
          try {
            await page.goto(cleanUrl, { waitUntil: 'networkidle', timeout: 15000 });
          } catch {
            console.error(`[Crawler] All navigation strategies failed for ${cleanUrl}`);
            continue;
          }
        }
      }

      // Give JS frameworks a moment to hydrate
      await page.waitForTimeout(1500);

      // Scroll to trigger lazy-loaded content
      try {
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let y = 0;
            const step = 600;
            const id = setInterval(() => {
              window.scrollBy(0, step);
              y += step;
              if (y >= document.body.scrollHeight) {
                clearInterval(id);
                resolve();
              }
            }, 80);
            // Safety: stop after 3s regardless
            setTimeout(() => { clearInterval(id); resolve(); }, 3000);
          });
        });
      } catch { /* scroll errors are non-fatal */ }

      // Extract text — try multiple strategies
      let text = '';

      // Strategy 1: innerText (most readable)
      try {
        text = await page.evaluate(() => document.body?.innerText || '');
      } catch { /* ignore */ }

      // Strategy 2: textContent fallback
      if (!text || text.trim().length < 50) {
        try {
          text = await page.evaluate(() => document.body?.textContent || '');
        } catch { /* ignore */ }
      }

      // Strategy 3: title + meta + visible text via selection
      if (!text || text.trim().length < 50) {
        try {
          text = await page.evaluate(() => {
            const title = document.title || '';
            const metas = Array.from(document.querySelectorAll('meta[name="description"], meta[property="og:description"]'))
              .map(m => (m as HTMLMetaElement).content)
              .join(' ');
            const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,li,span,a'))
              .map(el => (el as HTMLElement).innerText || (el as HTMLElement).textContent || '')
              .filter(t => t.trim().length > 0)
              .join('\n');
            return [title, metas, headings].filter(Boolean).join('\n\n');
          });
        } catch { /* ignore */ }
      }

      if (!text || text.trim().length < 20) {
        console.warn(`[Crawler] No meaningful text extracted from ${cleanUrl}`);
        continue;
      }

      // Deduplicate by MD5 hash
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(text.slice(0, 2000)).digest('hex');
      if (contentHashes.has(hash)) {
        console.log(`[Crawler] Skipping duplicate: ${cleanUrl}`);
        continue;
      }
      contentHashes.add(hash);

      // Limit text length per page to avoid huge chunks
      const trimmedText = text.length > 8000 ? text.slice(0, 8000) + '...' : text;
      pages.push(`URL: ${cleanUrl}\n\n${trimmedText}`);
      console.log(`[Crawler] Progress: ${pages.length}/${maxPages} — ${cleanUrl}`);

      // Extract internal links
      try {
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href)
        );

        for (const href of links) {
          try {
            const lp = new URL(href);
            if (lp.hostname === domain) {
              const next = `${lp.protocol}//${lp.hostname}${lp.pathname}`.replace(/\/$/, '');
              if (!visited.has(next) && !queue.includes(next)) {
                queue.push(next);
              }
            }
          } catch { /* invalid URL, skip */ }
        }
      } catch { /* link extraction errors are non-fatal */ }

    } catch (err: any) {
      console.error(`[Crawler] Error on ${cleanUrl}:`, err.message);
    }
  }

  await browser.close();
  console.log(`[Crawler] Done. Crawled ${pages.length} pages.`);
  return pages;
}
