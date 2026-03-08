import { chromium } from 'playwright';
import { URL } from 'url';

interface CrawlOptions {
  maxPages?: number;
}

export async function crawlWebsite(startUrl: string, options: CrawlOptions = {}): Promise<string[]> {
  const { maxPages = 15 } = options; // Increased from 5 to 15
  const visited = new Set<string>();
  const contentHashes = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: string[] = [];

  const domain = new URL(startUrl).hostname;

  console.log(`[Crawler] Starting crawl of ${startUrl} (max ${maxPages} pages)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  // Aggressive resource blocking for maximum performance
  await context.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();
    
    // Block all non-essential resources
    if (['image', 'media', 'font', 'stylesheet', 'script', 'other'].includes(resourceType)) {
      route.abort();
    }
    // Block tracking, analytics, ads, social media
    else if (
      url.includes('analytics') || 
      url.includes('tracking') || 
      url.includes('ads') ||
      url.includes('facebook') ||
      url.includes('twitter') ||
      url.includes('google-analytics') ||
      url.includes('doubleclick') ||
      url.includes('.css') ||
      url.includes('.jpg') ||
      url.includes('.png') ||
      url.includes('.gif') ||
      url.includes('.svg') ||
      url.includes('.woff') ||
      url.includes('.ttf')
    ) {
      route.abort();
    }
    else {
      route.continue();
    }
  });

  const page = await context.newPage();

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;
    const parsed = new URL(url);
    if (parsed.hostname !== domain) continue;

    const cleanUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
    if (visited.has(cleanUrl)) continue;
    visited.add(cleanUrl);

    try {
      console.log(`Crawling: ${cleanUrl}`);
      await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);

      // Quick scroll to load dynamic content
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let y = 0;
          const step = 800;
          const interval = setInterval(() => {
            window.scrollBy(0, step);
            y += step;
            if (y >= document.body.scrollHeight) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      });

      // Wait for DOM stability
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return text.length > 0;
        },
        { timeout: 3000 }
      );

      // Extract text via Ctrl+A copy simulation
      const text = await page.evaluate(() => {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(document.body);
        sel?.addRange(range);
        return sel?.toString() || '';
      });

      // Deduplicate by content hash
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(text).digest('hex');
      if (contentHashes.has(hash)) {
        console.log(`Skipping duplicate content: ${cleanUrl}`);
        continue;
      }
      contentHashes.add(hash);

      // Add page to results
      pages.push(`URL: ${cleanUrl}\n\n${text}`);
      console.log(`[Crawler] Progress: ${pages.length}/${maxPages} pages crawled`);

      // Extract links for further crawling
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href)
      );

      for (const href of links) {
        try {
          const parsedLink = new URL(href);
          if (parsedLink.hostname === domain) {
            const nextUrl = `${parsedLink.protocol}//${parsedLink.hostname}${parsedLink.pathname}`.replace(/\/$/, '');
            if (!visited.has(nextUrl) && !queue.includes(nextUrl)) {
              queue.push(nextUrl);
            }
          }
        } catch (e) {
          // ignore invalid URLs
        }
      }
    } catch (err) {
      console.error(`Failed ${cleanUrl}:`, err);
    }
  }

  await browser.close();
  return pages;
}