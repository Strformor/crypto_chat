'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Brush,
} from 'recharts';

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
  if (hours <= 168) return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, hours }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as HistoryPoint & { price: number };
  const price = Number(point.price);
  const pct   = point.day_pct;
  const neg   = pct?.startsWith('-');
  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-[#8b949e] mb-1">{formatTime(point.captured_at, hours)}</p>
      <p className="font-bold text-[#e6edf3] text-sm">{formatPrice(price)}</p>
      {pct && (
        <p className={`mt-0.5 font-medium ${neg ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
          Day: {pct}
        </p>
      )}
    </div>
  );
}

export function PriceChart({ coin, points, hours }: PriceChartProps) {
  if (points.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-2 text-center px-6">
        <span className="text-3xl">📡</span>
        <p className="text-sm text-[#8b949e]">
          Capturing prices every ~5 min — check back soon to see trends.
        </p>
        <p className="text-xs text-[#8b949e] opacity-60">
          {points.length === 1 ? '1 data point recorded so far.' : 'No data yet for this range.'}
        </p>
      </div>
    );
  }

  const prices = points.map((p) => Number(p.price));
  const first  = prices[0];
  const last   = prices[prices.length - 1];
  const pct    = ((last - first) / first) * 100;
  const isUp   = pct >= 0;
  const color  = isUp ? '#3fb950' : '#f85149';

  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const pad  = (maxP - minP) * 0.1 || last * 0.001;

  const chartData = points.map((p) => ({
    ...p,
    price: Number(p.price),
    time: formatTime(p.captured_at, hours),
  }));

  const showBrush = points.length > 40;

  return (
    <div className="w-full">
      {/* Summary row */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <span className="text-2xl font-bold">{formatPrice(last)}</span>
          <span className="text-xs text-[#8b949e] ml-2">{coin}</span>
        </div>
        <span className={`text-sm font-semibold ${isUp ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
          <span className="text-[#8b949e] font-normal ml-1">({hours}h)</span>
        </span>
      </div>

      {/* Interactive chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${coin}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#21262d" strokeDasharray="4 4" vertical={false} />

          <XAxis
            dataKey="time"
            tick={{ fill: '#8b949e', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />

          <YAxis
            domain={[minP - pad, maxP + pad]}
            tick={{ fill: '#8b949e', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatPrice}
            width={72}
          />

          <Tooltip
            content={<CustomTooltip hours={hours} />}
            cursor={{ stroke: '#8b949e', strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${coin})`}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: '#0d1117', strokeWidth: 2 }}
            animationDuration={600}
          />

          {/* Average reference line */}
          <ReferenceLine
            y={(minP + maxP) / 2}
            stroke="#30363d"
            strokeDasharray="3 6"
            label={{ value: 'avg', fill: '#8b949e', fontSize: 9, position: 'insideTopRight' }}
          />

          {/* Zoom brush for long ranges */}
          {showBrush && (
            <Brush
              dataKey="time"
              height={20}
              stroke="#30363d"
              fill="#161b22"
              travellerWidth={6}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Snapshot count */}
      <p className="text-[10px] text-[#8b949e] mt-2 text-right">
        {points.length} snapshots · captured every ~5 min
      </p>
    </div>
  );
}
