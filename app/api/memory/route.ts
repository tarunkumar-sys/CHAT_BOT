import { NextRequest, NextResponse } from 'next/server';
import { getCustomMemory } from '@/lib/customMemory';

const DEFAULT_USER = 'default-user';

/** GET /api/memory – list all facts for the user */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || DEFAULT_USER;
    const cm = getCustomMemory();
    const facts = await cm.listFacts(userId);
    return NextResponse.json({ facts });
  } catch (error: any) {
    console.error('[Memory API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch facts' }, { status: 500 });
  }
}

/** POST /api/memory – add a new fact */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fact, userId = DEFAULT_USER } = body;

    if (!fact || typeof fact !== 'string' || !fact.trim()) {
      return NextResponse.json({ error: 'fact is required' }, { status: 400 });
    }

    const cm = getCustomMemory();
    const saved = await cm.addFact(userId, fact.trim());
    return NextResponse.json({ fact: saved });
  } catch (error: any) {
    console.error('[Memory API] POST error:', error);
    return NextResponse.json({ error: 'Failed to save fact' }, { status: 500 });
  }
}

/** DELETE /api/memory – delete a fact by id */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { factId, userId = DEFAULT_USER } = body;

    if (!factId) {
      return NextResponse.json({ error: 'factId is required' }, { status: 400 });
    }

    const cm = getCustomMemory();
    await cm.deleteFact(userId, factId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Memory API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete fact' }, { status: 500 });
  }
}
