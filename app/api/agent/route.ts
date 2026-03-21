import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';

export async function POST(request: NextRequest) {
  try {
    const { message, botName, botDescription } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    const response = await runAgent(
      message,
      "default-user",
      botName || "ScribeNova",
      botDescription || "Your intelligent AI assistant"
    );

    return NextResponse.json({ response });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Agent API is running'
  });
}
