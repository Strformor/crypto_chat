import { NextRequest, NextResponse } from 'next/server';
import { fetchCryptoData } from '@/lib/scraper';
import { saveSnapshotIfStale } from '@/lib/snapshot';

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  try {
    const data = await fetchCryptoData(force);

    // Fire-and-forget snapshot — never blocks the response
    saveSnapshotIfStale(data.main).catch(console.error);

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
