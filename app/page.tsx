'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PriceChart, type HistoryPoint } from '@/components/PriceChart';

interface Message { role: 'user' | 'assistant'; content: string; }
interface CoinRow  { name: string; price: string; day_pct: string; weekly: string; monthly: string; }
type Tab = 'chat' | 'trends';
type Range = 24 | 168 | 720; // hours

const SUGGESTIONS = [
  "What's the Bitcoin price right now?",
  'Compare BTC and ETH performance',
  'Which crypto gained the most today?',
  'Show me the top 5 by market cap',
  'How is Ethereum doing this month?',
  "What's the BTC/ETH ratio?",
];

const TOP_COINS = ['Bitcoin','Ether','Solana','Binance','XRP','Cardano','Litecoin','Monero'];

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="text-sm text-[#e6edf3] space-y-1">
      {content.split('\n').map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**'))
            return <strong key={j}>{p.slice(2, -2)}</strong>;
          if (p.startsWith('`') && p.endsWith('`'))
            return <code key={j} className="bg-[#21262d] px-1 rounded text-xs">{p.slice(1, -1)}</code>;
          return p;
        });
        return <p key={i} className={line === '' ? 'mt-1' : ''}>{parts}</p>;
      })}
    </div>
  );
}

export default function Home() {
  // ── Chat state ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput]         = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ── Sidebar state ────────────────────────────────────────────────────────
  const [coins, setCoins]           = useState<CoinRow[]>([]);
  const [fetchedAt, setFetchedAt]   = useState('');
  const [cryptoLoading, setCryptoLoading] = useState(true);

  // ── Trends state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<Tab>('chat');
  const [selectedCoin, setSelectedCoin] = useState('Bitcoin');
  const [range, setRange]               = useState<Range>(24);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Load crypto sidebar ──────────────────────────────────────────────────
  const loadCrypto = useCallback(async (refresh = false) => {
    setCryptoLoading(true);
    try {
      const res  = await fetch(`/api/crypto${refresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      setCoins(data.main?.slice(0, 12) ?? []);
      setFetchedAt(data.fetched_at ?? '');
    } catch { /* sidebar stays empty */ }
    finally { setCryptoLoading(false); }
  }, []);

  // ── Load price history ───────────────────────────────────────────────────
  const loadHistory = useCallback(async (coin: string, h: Range) => {
    setHistoryLoading(true);
    try {
      const res  = await fetch(`/api/prices/history?coin=${encodeURIComponent(coin)}&hours=${h}`);
      const data = await res.json();
      setHistoryPoints(data.points ?? []);
    } catch { setHistoryPoints([]); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('crypto_session_id');
    if (stored) setSessionId(stored);
    loadCrypto();
  }, [loadCrypto]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (activeTab === 'trends') loadHistory(selectedCoin, range);
  }, [activeTab, selectedCoin, range, loadHistory]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || chatLoading) return;
    setInput('');
    setActiveTab('chat');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('crypto_session_id', data.sessionId);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error — please try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [chatLoading, sessionId]);

  const clearChat = () => {
    setMessages([]); setSessionId(null);
    localStorage.removeItem('crypto_session_id');
  };

  const RANGE_LABELS: Record<Range, string> = { 24: '24h', 168: '7d', 720: '30d' };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-[#30363d] bg-[#161b22]">
        <div className="p-4 border-b border-[#30363d]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Live Snapshot</span>
            <button onClick={() => loadCrypto(true)} title="Refresh" className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">↻</button>
          </div>
          {fetchedAt && <p className="text-[10px] text-[#8b949e] truncate">{fetchedAt}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {cryptoLoading
            ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-8 bg-[#21262d] rounded animate-pulse mb-1" />)
            : coins.map((coin) => {
                const neg = coin.day_pct.startsWith('-');
                const isSelected = selectedCoin === coin.name && activeTab === 'trends';
                return (
                  <button
                    key={coin.name}
                    onClick={() => { setSelectedCoin(coin.name); setActiveTab('trends'); }}
                    className={`w-full flex items-center justify-between py-1.5 px-2 rounded transition-colors text-left
                      ${isSelected ? 'bg-[#f7931a]/10 border border-[#f7931a]/30' : 'hover:bg-[#21262d]'}`}
                  >
                    <span className="text-xs font-medium truncate flex-1 mr-2">{coin.name}</span>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-[#8b949e] block">${coin.price}</span>
                      <span className={`text-[10px] font-semibold ${neg ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>{coin.day_pct}</span>
                    </div>
                  </button>
                );
              })}
        </div>

        <div className="p-3 border-t border-[#30363d]">
          <button onClick={clearChat} className="w-full text-xs text-[#8b949e] hover:text-[#f85149] transition-colors py-1">
            🗑 Clear chat
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <header className="shrink-0 border-b border-[#30363d] py-3 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-[#f7931a] to-[#627eea] bg-clip-text text-transparent">
                ₿ Crypto Market Assistant
              </h1>
              <p className="text-[11px] text-[#8b949e]">Live data · Claude AI · Supabase</p>
            </div>
            {/* Tab switcher */}
            <div className="flex gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-1">
              {(['chat', 'trends'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize
                    ${activeTab === tab ? 'bg-[#f7931a] text-white' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                >
                  {tab === 'chat' ? '💬 Chat' : '📈 Trends'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── Trends tab ────────────────────────────────────────────────── */}
        {activeTab === 'trends' && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Controls */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-1">
                {TOP_COINS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCoin(c)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                      ${selectedCoin === c ? 'bg-[#f7931a] text-white' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                  >
                    {c === 'Bitcoin' ? 'BTC' : c === 'Ether' ? 'ETH' : c === 'Solana' ? 'SOL'
                      : c === 'Binance' ? 'BNB' : c === 'Cardano' ? 'ADA' : c === 'Litecoin' ? 'LTC'
                      : c === 'Monero' ? 'XMR' : c}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-1 ml-auto">
                {([24, 168, 720] as Range[]).map((h) => (
                  <button
                    key={h}
                    onClick={() => setRange(h)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                      ${range === h ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                  >
                    {RANGE_LABELS[h]}
                  </button>
                ))}
              </div>
            </div>

            {/* 24h / 7d / 30d from tradingeconomics.com */}
            {(() => {
              const live = coins.find((c) => c.name === selectedCoin);
              if (!live) return null;
              const stats = [
                { label: '24h', value: live.day_pct },
                { label: '7d',  value: live.weekly },
                { label: '30d', value: live.monthly },
              ];
              return (
                <div className="flex gap-3 mb-6">
                  {stats.map(({ label, value }) => {
                    const neg = value?.startsWith('-');
                    const empty = !value || value === '—';
                    return (
                      <div key={label} className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3">
                        <p className="text-[11px] text-[#8b949e] mb-1">{label} change</p>
                        <p className={`text-lg font-bold ${empty ? 'text-[#8b949e]' : neg ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
                          {empty ? '—' : (neg ? '▼ ' : '▲ ') + value}
                        </p>
                        <p className="text-[10px] text-[#8b949e] mt-0.5">tradingeconomics.com</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Chart card */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
              {historyLoading
                ? <div className="h-48 flex items-center justify-center text-[#8b949e] text-sm">Loading…</div>
                : <PriceChart coin={selectedCoin} points={historyPoints} hours={range} />
              }
            </div>

            {/* History table */}
            {historyPoints.length >= 2 && (
              <div className="mt-4 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-[#30363d] text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                  Recent snapshots
                </div>
                <div className="overflow-y-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#30363d]">
                        <th className="text-left px-4 py-2 text-[#8b949e] font-normal">Time</th>
                        <th className="text-right px-4 py-2 text-[#8b949e] font-normal">Price</th>
                        <th className="text-right px-4 py-2 text-[#8b949e] font-normal">Day %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...historyPoints].reverse().slice(0, 20).map((pt, i) => {
                        const neg = pt.day_pct?.startsWith('-');
                        return (
                          <tr key={i} className="border-b border-[#21262d] hover:bg-[#21262d] transition-colors">
                            <td className="px-4 py-1.5 text-[#8b949e]">
                              {new Date(pt.captured_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono">
                              ${Number(pt.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </td>
                            <td className={`px-4 py-1.5 text-right font-medium ${neg ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
                              {pt.day_pct || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Chat tab ──────────────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="max-w-xl mx-auto mt-6">
                  <p className="text-sm text-[#8b949e] text-center mb-4">Try asking:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="p-3 text-xs text-left bg-[#161b22] border border-[#30363d] rounded-lg hover:border-[#f7931a] hover:text-[#f7931a] transition-colors leading-snug"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm
                    ${msg.role === 'user'
                      ? 'bg-[#f7931a] text-white rounded-br-sm'
                      : 'bg-[#161b22] border border-[#30363d] rounded-bl-sm'}`}
                  >
                    {msg.role === 'assistant'
                      ? <AssistantMessage content={msg.content} />
                      : <span>{msg.content}</span>
                    }
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#161b22] border border-[#30363d] rounded-2xl rounded-bl-sm px-4 py-3">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 bg-[#8b949e] rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-[#30363d] p-3">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any crypto price, comparison, or trend…"
                  disabled={chatLoading}
                  className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#f7931a] disabled:opacity-50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !input.trim()}
                  className="px-5 py-2.5 bg-[#f7931a] text-white rounded-xl text-sm font-semibold hover:bg-[#e8821a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
