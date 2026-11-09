#!/usr/bin/env python3
"""
ShadowFlow — IndexNow Automated Search Engine Submission
Pings api.indexnow.org (Bing, ChatGPT Search, Copilot, Perplexity, Yandex)
with all canonical website pages, comparison hubs, use cases, and latest blog posts.
"""

import sys
import json
import urllib.request
import urllib.error

INDEXNOW_KEY = "c2188ff6e637482ea4bc837699131a98"
INDEXNOW_HOST = "shadowflow.work"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

DEFAULT_URLS = [
    "https://shadowflow.work/",
    "https://shadowflow.work/compare",
    "https://shadowflow.work/compare/shadowflow-vs-zapier-vs-n8n",
    "https://shadowflow.work/use-cases",
    "https://shadowflow.work/use-cases/autonomous-social-media-agents",
    "https://shadowflow.work/use-cases/ai-sales-and-lead-automation",
    "https://shadowflow.work/features",
    "https://shadowflow.work/integrations",
    "https://shadowflow.work/pricing",
    "https://shadowflow.work/docs",
    "https://shadowflow.work/demo",
    "https://shadowflow.work/blog",
    "https://shadowflow.work/seo-agent",
    "https://shadowflow.work/llms.txt",
    "https://shadowflow.work/sitemap.xml"
]

def ping_indexnow(extra_urls=None) -> bool:
    urls = list(DEFAULT_URLS)
    if extra_urls:
        for u in extra_urls:
            if u not in urls:
                urls.append(u)

    payload = {
        "host": INDEXNOW_HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{INDEXNOW_HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls[:100]  # Cap to 100 per request
    }

    try:
        req = urllib.request.Request(
            INDEXNOW_ENDPOINT,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "ShadowFlow-IndexNow-Bot/1.0"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status in (200, 202):
                print(f"[IndexNow] Successfully submitted {len(payload['urlList'])} URLs (HTTP {res.status}).")
                return True
            else:
                print(f"[IndexNow] Received response HTTP {res.status}.")
                return False
    except urllib.error.HTTPError as e:
        print(f"[IndexNow] HTTP Error {e.code}: {e.read().decode('utf-8', errors='ignore')}")
        return False
    except Exception as e:
        print(f"[IndexNow] Ping exception: {e}")
        return False

if __name__ == "__main__":
    print(f"=== SUBMITTING URLS TO INDEXNOW ({INDEXNOW_HOST}) ===")
    success = ping_indexnow()
    sys.exit(0 if success else 1)
