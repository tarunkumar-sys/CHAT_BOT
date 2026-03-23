import { NextResponse } from 'next/server';

const CASCADE_URL =
  'https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades/haarcascade_frontalface_default.xml';

export async function GET() {
  const resp = await fetch(CASCADE_URL, { next: { revalidate: 86400 } });
  if (!resp.ok) {
    return NextResponse.json({ error: 'Failed to fetch cascade' }, { status: 502 });
  }
  const xml = await resp.text();
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
