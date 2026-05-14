import { NextRequest, NextResponse } from 'next/server';
import { fetchCryptoData } from '@/lib/scraper';

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  try {
    const data = await fetchCryptoData(force);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
