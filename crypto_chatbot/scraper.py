import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time

_cache = {"data": None, "ts": None}
CACHE_TTL = 60  # seconds


def _fetch_table(table, has_market_cap: bool) -> list[dict]:
    rows = table.find_all("tr")
    if not rows:
        return []

    headers = [th.get_text(strip=True) for th in rows[0].find_all(["th", "td"])]
    results = []
    for row in rows[1:]:
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if not cells:
            continue
        entry = {}
        for i, h in enumerate(headers):
            entry[h] = cells[i] if i < len(cells) else ""
        # Normalise key names
        entry["name"] = entry.pop("Crypto", entry.pop("BTC", entry.pop("ETH", cells[0])))
        entry["price"] = entry.pop("Price", "")
        entry["day_change"] = entry.pop("Day", "")
        entry["day_pct"] = entry.pop("%", "")
        entry["weekly"] = entry.pop("Weekly", "")
        entry["monthly"] = entry.pop("Monthly", "")
        entry["ytd"] = entry.pop("YTD", "")
        entry["yoy"] = entry.pop("YoY", "")
        entry["market_cap"] = entry.pop("MarketCap", "")
        entry["date"] = entry.pop("Date", "")
        results.append(entry)
    return results


def fetch_crypto_data(force: bool = False) -> dict:
    global _cache
    now = datetime.now()
    if not force and _cache["data"] and _cache["ts"]:
        if now - _cache["ts"] < timedelta(seconds=CACHE_TTL):
            return _cache["data"]

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    resp = requests.get(
        "https://tradingeconomics.com/crypto", headers=headers, timeout=15
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    tables = soup.find_all("table")
    data = {
        "fetched_at": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "main": [],
        "btc_pairs": [],
        "eth_pairs": [],
    }

    if len(tables) >= 1:
        data["main"] = _fetch_table(tables[0], has_market_cap=True)
    if len(tables) >= 2:
        data["btc_pairs"] = _fetch_table(tables[1], has_market_cap=False)
    if len(tables) >= 3:
        data["eth_pairs"] = _fetch_table(tables[2], has_market_cap=False)

    _cache = {"data": data, "ts": now}
    return data


def format_for_llm(data: dict) -> str:
    """Render scraped data as a compact text block for the LLM context."""
    lines = [f"Live crypto data from tradingeconomics.com (as of {data['fetched_at']}):", ""]

    lines.append("=== Top Cryptocurrencies ===")
    for row in data["main"]:
        mc = f"  MarketCap: {row['market_cap']}" if row.get("market_cap") else ""
        lines.append(
            f"{row['name']}: ${row['price']}  Day: {row['day_pct']}  "
            f"Weekly: {row['weekly']}  Monthly: {row['monthly']}  "
            f"YTD: {row['ytd']}  YoY: {row['yoy']}{mc}  ({row['date']})"
        )

    lines.append("")
    lines.append("=== BTC Pairs ===")
    for row in data["btc_pairs"]:
        lines.append(
            f"{row['name']}: {row['price']}  Day: {row['day_pct']}  "
            f"Weekly: {row['weekly']}  Monthly: {row['monthly']}  ({row['date']})"
        )

    lines.append("")
    lines.append("=== ETH Pairs ===")
    for row in data["eth_pairs"]:
        lines.append(
            f"{row['name']}: {row['price']}  Day: {row['day_pct']}  "
            f"Weekly: {row['weekly']}  Monthly: {row['monthly']}  ({row['date']})"
        )

    return "\n".join(lines)
