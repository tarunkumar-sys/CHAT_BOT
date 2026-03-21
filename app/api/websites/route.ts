import { NextRequest, NextResponse } from 'next/server';
import { getQdrantClient } from '@/lib/vectorstore';

const COLLECTION = 'website_chunks';

/** GET /api/websites — list all indexed websites */
export async function GET() {
  try {
    const client = getQdrantClient();
    const result = await client.scroll(COLLECTION, {
      limit: 500,
      with_payload: true,
    });

    const siteMap = new Map<string, { domain: string; url: string; chunks: number }>();
    for (const point of result.points) {
      const payload = point.payload as any;
      const domain: string = payload?.metadata?.domain ?? '';
      const source: string = payload?.metadata?.source ?? '';
      if (!domain) continue;
      if (!siteMap.has(domain)) {
        siteMap.set(domain, { domain, url: source, chunks: 0 });
      }
      siteMap.get(domain)!.chunks++;
    }

    const sites = Array.from(siteMap.values());
    return NextResponse.json({ sites });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE /api/websites — remove all chunks for a domain */
export async function DELETE(request: NextRequest) {
  try {
    const { domain } = await request.json();
    if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 });

    const client = getQdrantClient();
    await client.delete(COLLECTION, {
      filter: {
        must: [{ key: 'metadata.domain', match: { value: domain } }],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
