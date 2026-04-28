import os
from urllib.parse import quote_plus

import requests

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
YOUTUBE_MAX_RESULTS = int(os.getenv("YOUTUBE_MAX_RESULTS", "5"))


def build_youtube_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def build_youtube_embed_url(video_id: str) -> str:
    return f"https://www.youtube.com/embed/{video_id}?enablejsapi=1"


def search_youtube(query: str, limit: int | None = None) -> list[dict]:
    query = (query or "").strip()
    print(f"[YouTube Search] query={query}", flush=True)
    if not YOUTUBE_API_KEY:
        print("[WARNING] YOUTUBE_API_KEY not set", flush=True)
        return []

    max_results = limit or YOUTUBE_MAX_RESULTS

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max_results,
        "key": YOUTUBE_API_KEY,
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[YOUTUBE SEARCH ERROR] {e}", flush=True)
        return []

    results = []
    for item in data.get("items", []):
        video_id = (((item or {}).get("id") or {}).get("videoId") or "").strip()
        snippet = (item.get("snippet") or {}) if isinstance(item, dict) else {}

        if not video_id:
            continue

        thumbs = snippet.get("thumbnails") or {}
        thumb = (
            (thumbs.get("high") or {}).get("url")
            or (thumbs.get("medium") or {}).get("url")
            or (thumbs.get("default") or {}).get("url")
            or ""
        )

        results.append(
            {
                "title": snippet.get("title", "Untitled video"),
                "video_id": video_id,
                "watch_url": build_youtube_watch_url(video_id),
                "embed_url": build_youtube_embed_url(video_id),
                "thumbnail": thumb,
                "source": "YouTube",
                "snippet": snippet.get("description", ""),
                "channel_title": snippet.get("channelTitle", ""),
            }
        )

    return results


def build_youtube_search_payload(query: str) -> dict:
    query = (query or "").strip()
    results = search_youtube(query)

    return {
        "provider": "youtube",
        "query": query,
        "results": results,
    }