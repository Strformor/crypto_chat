import { parse } from 'node-html-parser';

export interface CoinRow {
  name: string;
  price: string;
  day_change: string;
  day_pct: string;
  weekly: string;
  monthly: string;
  ytd: string;
  yoy: string;
  market_cap: string;
  date: string;
}

export interface CryptoData {
  fetched_at: string;
  main: CoinRow[];
  btc_pairs: CoinRow[];
  eth_pairs: CoinRow[];
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function parseTable(html: ReturnType<typeof parse>): CoinRow[] {
  const rows = html.querySelectorAll('tr');
  if (rows.length < 2) return [];

  const headers = rows[0]
    .querySelectorAll('td, th')
    .map((c) => c.text.trim());

  return rows.slice(1).map((row) => {
    const cells = row.querySelectorAll('td').map((c) => c.text.trim());
    const get = (key: string) => cells[headers.indexOf(key)] ?? '';
    return {
      name: get('Crypto') || get('BTC') || get('ETH') || cells[0] || '',
      price: get('Price'),
      day_change: get('Day'),
      day_pct: get('%'),
      weekly: get('Weekly'),
      monthly: get('Monthly'),
      ytd: get('YTD'),
      yoy: get('YoY'),
      market_cap: get('MarketCap'),
      date: get('Date'),
    };
  });
}

// Module-level cache (warm instances reuse it; cold starts refetch)
let _cache: { data: CryptoData; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function fetchCryptoData(force = false): Promise<CryptoData> {
  const now = Date.now();
  if (!force && _cache && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }

  const res = await fetch('https://tradingeconomics.com/crypto', {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const root = parse(await res.text());
  const tables = root.querySelectorAll('table');

  const data: CryptoData = {
    fetched_at: new Date().toUTCString(),
    main: tables[0] ? parseTable(tables[0]) : [],
    btc_pairs: tables[1] ? parseTable(tables[1]) : [],
    eth_pairs: tables[2] ? parseTable(tables[2]) : [],
  };

  _cache = { data, ts: now };
  return data;
}

export function formatForLLM(data: CryptoData): string {
  const lines: string[] = [
    `Live crypto data from tradingeconomics.com (${data.fetched_at}):`,
    '',
    '=== Top Cryptocurrencies ===',
    ...data.main.map(
      (r) =>
        `${r.name}: $${r.price}  Day: ${r.day_pct}  Weekly: ${r.weekly}  ` +
        `Monthly: ${r.monthly}  YTD: ${r.ytd}  YoY: ${r.yoy}` +
        (r.market_cap ? `  MarketCap: ${r.market_cap}` : '') +
        `  (${r.date})`
    ),
    '',
    '=== BTC Pairs ===',
    ...data.btc_pairs.map(
      (r) =>
        `${r.name}: ${r.price}  Day: ${r.day_pct}  Weekly: ${r.weekly}  Monthly: ${r.monthly}  (${r.date})`
    ),
    '',
    '=== ETH Pairs ===',
    ...data.eth_pairs.map(
      (r) =>
        `${r.name}: ${r.price}  Day: ${r.day_pct}  Weekly: ${r.weekly}  Monthly: ${r.monthly}  (${r.date})`
    ),
  ];
  return lines.join('\n');
}
