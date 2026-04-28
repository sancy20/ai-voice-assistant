import os
import requests

BRAVE_SEARCH_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY", "")
BRAVE_SEARCH_MAX_RESULTS = int(os.getenv("BRAVE_SEARCH_MAX_RESULTS", "5"))


def build_search_preview(query: str) -> dict:
    query = (query or "").strip()

    if not query:
        return {"query": "", "results": []}

    if not BRAVE_SEARCH_API_KEY:
        print("[WARNING] BRAVE_SEARCH_API_KEY not set", flush=True)
        return {"query": query, "results": []}

    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
    }
    params = {
        "q": query,
        "count": BRAVE_SEARCH_MAX_RESULTS,
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[BRAVE SEARCH ERROR] {e}", flush=True)
        return {"query": query, "results": []}

    web_block = data.get("web") or {}
    raw_results = web_block.get("results") or []

    seen_urls = set()
    results = []
    for item in raw_results[:BRAVE_SEARCH_MAX_RESULTS]:
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        snippet = (item.get("description") or "").strip()
        if len(snippet) > 220:
            snippet = snippet[:217].rstrip() + "..."

        if not title or not url or url in seen_urls:
            continue

        seen_urls.add(url)

        source = ""
        meta_url = item.get("meta_url") or {}
        if isinstance(meta_url, dict):
            source = (meta_url.get("hostname") or "").strip()

        results.append(
            {
                "title": title,
                "url": url,
                "snippet": snippet,
                "source": source or "Web",
            }
        )

    return {
        "query": query,
        "results": results,
    }