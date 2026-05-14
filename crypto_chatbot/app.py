import os
import sys
import anthropic
import streamlit as st
from pathlib import Path
from dotenv import dotenv_values

# Ensure scraper.py is importable when run from the repo root (Streamlit Cloud)
sys.path.insert(0, str(Path(__file__).parent))
from scraper import fetch_crypto_data, format_for_llm

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Crypto Chat",
    page_icon="₿",
    layout="centered",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    .stApp { background: #0d1117; color: #e6edf3; }
    .main-header {
        background: linear-gradient(135deg, #f7931a 0%, #627eea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.2rem;
        font-weight: 800;
        text-align: center;
        padding: 0.5rem 0;
    }
    .data-badge {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 0.4rem 0.8rem;
        font-size: 0.75rem;
        color: #8b949e;
    }
    [data-testid="stChatMessage"] {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 10px;
        margin-bottom: 0.5rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Header ────────────────────────────────────────────────────────────────────
st.markdown('<div class="main-header">₿ Crypto Market Assistant</div>', unsafe_allow_html=True)
st.caption("Powered by live data from tradingeconomics.com · Claude AI")

# ── API key check ─────────────────────────────────────────────────────────────
# Priority: Streamlit Cloud secrets → OS env var → local .env file
_env = dotenv_values(Path(__file__).parent / ".env")
api_key = (
    st.secrets.get("ANTHROPIC_API_KEY", "")  # Streamlit Cloud dashboard
    or os.getenv("ANTHROPIC_API_KEY", "")    # shell / Docker env var
    or _env.get("ANTHROPIC_API_KEY", "")     # local .env (never committed)
)
if not api_key:
    st.error(
        "ANTHROPIC_API_KEY is not set. "
        "On Streamlit Cloud add it in App Settings → Secrets. "
        "Locally, add it to crypto_chatbot/.env."
    )
    st.stop()

client = anthropic.Anthropic(api_key=api_key)

# ── Session state ─────────────────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []

# ── Sidebar: live data snapshot ───────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 📊 Live Snapshot")
    refresh = st.button("🔄 Refresh Data")
    try:
        data = fetch_crypto_data(force=refresh)
        st.markdown(f'<div class="data-badge">Last fetched: {data["fetched_at"]}</div>', unsafe_allow_html=True)
        st.markdown("**Top Coins**")
        for row in data["main"][:8]:
            pct = row["day_pct"]
            color = "#3fb950" if pct.startswith("-") is False and pct != "0.00%" else "#f85149"
            # green for positive, red for negative
            if pct.startswith("-"):
                color = "#f85149"
            else:
                color = "#3fb950"
            st.markdown(
                f"**{row['name']}** &nbsp; `${row['price']}` &nbsp; "
                f'<span style="color:{color}">{pct}</span>',
                unsafe_allow_html=True,
            )
    except Exception as e:
        st.error(f"Failed to load data: {e}")
        data = None

    st.divider()
    if st.button("🗑️ Clear chat"):
        st.session_state.messages = []
        st.rerun()

# ── Suggested questions ───────────────────────────────────────────────────────
if not st.session_state.messages:
    st.markdown("**Try asking:**")
    cols = st.columns(2)
    suggestions = [
        "What's the Bitcoin price right now?",
        "Compare BTC and ETH performance",
        "Which crypto gained the most today?",
        "Show me the top 5 by market cap",
        "How is Ethereum doing this month?",
        "What's the BTC/ETH ratio?",
    ]
    for i, s in enumerate(suggestions):
        if cols[i % 2].button(s, key=f"sug_{i}"):
            st.session_state.messages.append({"role": "user", "content": s})
            st.rerun()

# ── Chat history ──────────────────────────────────────────────────────────────
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ── Chat input ────────────────────────────────────────────────────────────────
user_input = st.chat_input("Ask about any crypto price, comparison, or trend…")

if user_input:
    st.session_state.messages.append({"role": "user", "content": user_input})
    with st.chat_message("user"):
        st.markdown(user_input)

    # Fresh data for every query (cached for 60s)
    try:
        data = fetch_crypto_data()
        market_context = format_for_llm(data)
    except Exception as e:
        market_context = f"[Data fetch failed: {e}]"

    system_prompt = f"""You are a sharp, helpful crypto market assistant.
You have access to the latest live market data shown below — use it as your
primary source for prices, changes, and comparisons.

Always be concise and accurate. Format numbers clearly (use $ for USD prices,
% for percentages). When comparing coins, use a brief table or bullet list.
If the user asks about a coin not in the data, say so honestly.

{market_context}
"""

    history = [
        {"role": m["role"], "content": m["content"]}
        for m in st.session_state.messages
    ]

    with st.chat_message("assistant"):
        with st.spinner(""):
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system_prompt,
                messages=history,
            )
            reply = response.content[0].text
            st.markdown(reply)

    st.session_state.messages.append({"role": "assistant", "content": reply})
