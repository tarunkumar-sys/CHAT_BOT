import { NextRequest, NextResponse } from 'next/server';
import { crawlWebsite } from '@/lib/crawler';
import { chunkText } from '@/lib/chunker';
import { createVectorstore, websiteExists } from '@/lib/vectorstore';

/** POST /api/website – crawl and index a website */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Ensure proper protocol
    let fullUrl = url.trim();
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = `https://${fullUrl}`;
    }

    // Validate URL
    try {
      new URL(fullUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Check if already indexed
    const exists = await websiteExists(fullUrl);
    if (exists) {
      return NextResponse.json({
        success: true,
        message: 'Website already indexed',
        pages: 0,
        cached: true,
      });
    }

    console.log(`[Website API] Crawling: ${fullUrl}`);

    // Crawl
    const pages = await crawlWebsite(fullUrl, { maxPages: 15 });
    if (pages.length === 0) {
      return NextResponse.json({ error: 'No pages found. Check if the URL is accessible.' }, { status: 422 });
    }

    // Chunk and index
    const chunks = await chunkText(pages);
    await createVectorstore(chunks, fullUrl);

    console.log(`[Website API] Indexed ${pages.length} pages, ${chunks.length} chunks`);

    return NextResponse.json({
      success: true,
      pages: pages.length,
      chunks: chunks.length,
      url: fullUrl,
    });
  } catch (error: any) {
    console.error('[Website API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to crawl website' },
      { status: 500 }
    );
  }
}

/** GET /api/website – health check */
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Website indexing API is running' });
}
