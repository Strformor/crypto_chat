'use client';

export interface HistoryPoint {
  price: number;
  day_pct?: string;
  captured_at: string;
}

interface PriceChartProps {
  coin: string;
  points: HistoryPoint[];
  hours: number;
}

function formatPrice(p: number) {
  if (p >= 1000) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1)    return '$' + p.toFixed(2);
  return '$' + p.toFixed(6);
}

function formatTime(iso: string, hours: number) {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function PriceChart({ coin, points, hours }: PriceChartProps) {
  if (points.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
        <span className="text-3xl">📡</span>
        <p className="text-sm text-[#8b949e]">
          Capturing prices every 5 minutes — come back soon to see trends.
        </p>
        <p className="text-xs text-[#8b949e] opacity-60">
          {points.length === 1 ? '1 data point recorded so far.' : 'No data yet for this range.'}
        </p>
      </div>
    );
  }

  const W = 600, H = 180, PX = 12, PY = 10;
  const IW = W - PX * 2, IH = H - PY * 2;

  const prices = points.map((p) => Number(p.price));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const rangeP = maxP - minP || 1;

  const toX = (i: number) => PX + (i / (points.length - 1)) * IW;
  const toY = (p: number) => PY + (1 - (p - minP) / rangeP) * IH;

  const linePts = points.map((p, i) => `${toX(i).toFixed(1)},${toY(Number(p.price)).toFixed(1)}`);
  const linePath = linePts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt}`).join(' ');
  const fillPath =
    linePath +
    ` L ${toX(points.length - 1).toFixed(1)},${(PY + IH).toFixed(1)}` +
    ` L ${toX(0).toFixed(1)},${(PY + IH).toFixed(1)} Z`;

  const first = Number(points[0].price);
  const last  = Number(points[points.length - 1].price);
  const pct   = ((last - first) / first) * 100;
  const isUp  = pct >= 0;
  const color = isUp ? '#3fb950' : '#f85149';

  // Thin x-axis tick labels (5 evenly spaced)
  const tickCount = Math.min(5, points.length);
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * (points.length - 1))
  );

  // Y-axis price labels (3 levels)
  const yLabels = [maxP, (maxP + minP) / 2, minP];

  return (
    <div className="w-full">
      {/* Summary row */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="text-2xl font-bold">{formatPrice(last)}</span>
          <span className="text-xs text-[#8b949e] ml-2">{coin}</span>
        </div>
        <span className={`text-sm font-semibold ${isUp ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
          <span className="text-[#8b949e] font-normal ml-1">({hours}h)</span>
        </span>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-2 text-[10px] text-[#8b949e] pointer-events-none" style={{ width: '54px' }}>
          {yLabels.map((p, i) => (
            <span key={i} className="text-right block pr-1">{formatPrice(p)}</span>
          ))}
        </div>

        {/* SVG */}
        <div className="ml-14">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '180px' }}>
            <defs>
              <linearGradient id={`grad-${coin}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 0.5, 1].map((pct) => (
              <line
                key={pct}
                x1={PX} y1={PY + pct * IH}
                x2={W - PX} y2={PY + pct * IH}
                stroke="#30363d" strokeWidth="1" strokeDasharray="4 4"
              />
            ))}

            {/* Gradient fill */}
            <path d={fillPath} fill={`url(#grad-${coin})`} />

            {/* Price line */}
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* End dot */}
            <circle
              cx={toX(points.length - 1)}
              cy={toY(last)}
              r="4"
              fill={color}
              stroke="#0d1117"
              strokeWidth="2"
            />
          </svg>

          {/* X-axis labels */}
          <div className="flex justify-between text-[10px] text-[#8b949e] mt-1 px-3">
            {ticks.map((idx) => (
              <span key={idx}>{formatTime(points[idx].captured_at, hours)}</span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[#8b949e] mt-2 text-right">
        {points.length} snapshots · captured every ~5 min
      </p>
    </div>
  );
}
