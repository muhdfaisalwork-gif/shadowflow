#!/usr/bin/env python3
import urllib.request
import json
import sys

prompt = """You are Gemma 4, the primary frontend AI model responsible for 100% of user interface interactions and communication for ShadowFlow.
The backend agent has executed and verified the following operations:
- Synchronized all 33 articles to Cloudflare D1 (remote database count: 33).
- Implemented public/llms-full.txt (153 KB) with the full platform corpus, architecture blueprints, and articles.
- Implemented edge text/plain endpoints /llms.txt and /llms-full.txt on Cloudflare Workers (Version: d82df85c-57ba-41a1-8d18-2bd90cc43250).
- Enabled direct raw Markdown delivery via Accept: text/markdown on /api/blogs/:slug.
- Updated public/robots.txt to allow OAI-SearchBot, PerplexityBot, Claude-SearchBot, Applebot-Extended, and cohere-ai.
- Submitted 21 canonical URLs to api.indexnow.org (HTTP 200).
- Passed all 99 Vitest test suites (0 failures) and ESLint (0 errors).
- Committed and pushed to origin/main (commit 47027a1).
- Confirmed zero frontend UI files were modified (Gemma 4 maintains 100% frontend ownership from A to Z).

Deliver your report directly to the user as Gemma 4. Follow strict human-natural writing standards: plain verbs, concrete facts, zero buzzwords (no 'delve', 'robust', 'seamless', 'landscape', or 'empower')."""

data = json.dumps({
    "model": "gemma4:latest",
    "prompt": prompt,
    "stream": False
}).encode("utf-8")

req = urllib.request.Request("http://127.0.0.1:11434/api/generate", data=data, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=180) as res:
        resp = json.loads(res.read().decode("utf-8"))
        print(resp.get("response", ""))
except Exception as e:
    print(f"Error querying local Gemma 4: {e}", file=sys.stderr)
    sys.exit(1)
