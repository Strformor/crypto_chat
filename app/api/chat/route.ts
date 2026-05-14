import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { fetchCryptoData, formatForLLM } from '@/lib/scraper';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }

    // ── Session ────────────────────────────────────────────────────────────
    let sid: string = sessionId;
    if (!sid) {
      const { data: session, error } = await supabase
        .from('sessions')
        .insert({})
        .select('id')
        .single();
      if (error) throw error;
      sid = session.id;
    }

    // ── Save user message ──────────────────────────────────────────────────
    await supabase.from('messages').insert({ session_id: sid, role: 'user', content: message });

    // ── Fetch full history ─────────────────────────────────────────────────
    const { data: history, error: hErr } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sid)
      .order('created_at', { ascending: true });
    if (hErr) throw hErr;

    // ── Live market data ───────────────────────────────────────────────────
    let marketContext = '';
    try {
      const cryptoData = await fetchCryptoData();
      marketContext = formatForLLM(cryptoData);
    } catch {
      marketContext = '[Live market data temporarily unavailable]';
    }

    // ── Claude ─────────────────────────────────────────────────────────────
    const system = `You are a sharp, helpful crypto market assistant.
Use the live market data below as your primary source for prices, changes, and comparisons.
Be concise and accurate. Format numbers clearly ($ for prices, % for percentages).
When comparing coins use a brief table or bullet list.
If a coin is not in the data, say so honestly.

${marketContext}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: (history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const reply = (response.content[0] as { text: string }).text;

    // ── Save assistant reply ───────────────────────────────────────────────
    await supabase.from('messages').insert({ session_id: sid, role: 'assistant', content: reply });

    return NextResponse.json({ reply, sessionId: sid });
  } catch (err) {
    console.error('/api/chat error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
