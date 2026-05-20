import { supabaseAdmin as supabase } from './supabase-server';
import type { CoinRow } from './scraper';

// Module-level guard — warm serverless instances skip repeated DB hits
let lastAttemptMs = 0;
const MIN_INTERVAL_MS = 4 * 60 * 1000; // 4-min warm-instance gate

export async function saveSnapshotIfStale(coins: CoinRow[]): Promise<void> {
  const now = Date.now();

  // Fast path: same warm instance saved recently
  if (now - lastAttemptMs < MIN_INTERVAL_MS) return;
  lastAttemptMs = now;

  // Cross-instance check: look at the actual last DB entry
  const { data: latest } = await supabase
    .from('price_history')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastTs = latest ? new Date(latest.captured_at).getTime() : 0;
  if (now - lastTs < 5 * 60 * 1000) return; // already fresh

  const rows = coins
    .map((coin) => ({
      coin: coin.name,
      price: parseFloat(coin.price.replace(/,/g, '')),
      day_pct: coin.day_pct,
      weekly: coin.weekly,
      monthly: coin.monthly,
      market_cap: coin.market_cap,
    }))
    .filter((r) => !isNaN(r.price) && r.price > 0);

  if (rows.length > 0) {
    await supabase.from('price_history').insert(rows);
  }
}
