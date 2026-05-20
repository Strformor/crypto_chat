import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const coin  = req.nextUrl.searchParams.get('coin')  ?? 'Bitcoin';
  const hours = parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('price_history')
    .select('price, day_pct, captured_at')
    .eq('coin', coin)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });

  return NextResponse.json({ coin, hours, points: data ?? [] });
}
