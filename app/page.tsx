'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CoinRow {
  name: string;
  price: string;
  day_pct: string;
}

const SUGGESTIONS = [
  "What's the Bitcoin price right now?",
  'Compare BTC and ETH performance',
  'Which crypto gained the most today?',
  'Show me the top 5 by market cap',
  'How is Ethereum doing this month?',
  "What's the BTC/ETH ratio?",
];

function AssistantMessage({ content }: { content: string }) {
  // Simple renderer: preserve line breaks, bold (**text**), inline code (`code`)
  const lines = content.split('\n');
  return (
    <div className="prose text-[#e6edf3] text-sm">
      {lines.map((line, i) => {
        const parts = line
          .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
          .map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**'))
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            if (part.startsWith('`') && part.endsWith('`'))
              return <code key={j} className="bg-[#21262d] px-1 rounded text-xs">{part.slice(1, -1)}</code>;
            return part;
          });
        return <p key={i} className={line === '' ? 'mt-2' : ''}>{parts}</p>;
      })}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState('');
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadCrypto = useCallback(async (refresh = false) => {
    setCryptoLoading(true);
    try {
      const res = await fetch(`/api/crypto${refresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      setCoins(data.main?.slice(0, 12) ?? []);
      setFetchedAt(data.fetched_at ?? '');
    } catch {
      // silently fail — sidebar just stays empty
    } finally {
      setCryptoLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('crypto_session_id');
    if (stored) setSessionId(stored);
    loadCrypto();
  }, [loadCrypto]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, sessionId }),
        });
        const data = await res.json();

        if (data.sessionId && !sessionId) {
          setSessionId(data.sessionId);
          localStorage.setItem('crypto_session_id', data.sessionId);
        }

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.' },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Network error — please try again.' },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, sessionId]
  );

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('crypto_session_id');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-[#30363d] bg-[#161b22]">
        <div className="p-4 border-b border-[#30363d]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
              Live Snapshot
            </span>
            <button
              onClick={() => loadCrypto(true)}
              title="Refresh"
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors text-sm"
            >
              ↻
            </button>
          </div>
          {fetchedAt && (
            <p className="text-[10px] text-[#8b949e] truncate">{fetchedAt}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {cryptoLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-7 bg-[#21262d] rounded animate-pulse" />
              ))
            : coins.map((coin) => {
                const neg = coin.day_pct.startsWith('-');
                return (
                  <div
                    key={coin.name}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-[#21262d] transition-colors"
                  >
                    <span className="text-xs font-medium truncate flex-1 mr-2">{coin.name}</span>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-[#8b949e] block">${coin.price}</span>
                      <span
                        className={`text-[10px] font-semibold ${neg ? 'text-[#f85149]' : 'text-[#3fb950]'}`}
                      >
                        {coin.day_pct}
                      </span>
                    </div>
                  </div>
                );
              })}
        </div>

        <div className="p-3 border-t border-[#30363d]">
          <button
            onClick={clearChat}
            className="w-full text-xs text-[#8b949e] hover:text-[#f85149] transition-colors py-1"
          >
            🗑 Clear chat
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="shrink-0 border-b border-[#30363d] py-3 px-6 text-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#f7931a] to-[#627eea] bg-clip-text text-transparent">
            ₿ Crypto Market Assistant
          </h1>
          <p className="text-[11px] text-[#8b949e] mt-0.5">
            Live data from tradingeconomics.com · Claude AI · Supabase
          </p>
        </header>

        {/* Messages */}
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
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#f7931a] text-white rounded-br-sm'
                    : 'bg-[#161b22] border border-[#30363d] rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <AssistantMessage content={msg.content} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#161b22] border border-[#30363d] rounded-2xl rounded-bl-sm px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-[#8b949e] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[#30363d] p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any crypto price, comparison, or trend…"
              disabled={loading}
              className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#f7931a] disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 bg-[#f7931a] text-white rounded-xl text-sm font-semibold hover:bg-[#e8821a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
