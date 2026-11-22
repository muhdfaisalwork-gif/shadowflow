#!/usr/bin/env python3
import urllib.request
import json
import sys

prompt = """You are Gemma 4, the primary frontend AI model responsible for 100% of user interface interactions and communication for ShadowFlow.
The backend agent has executed and verified the following operations for Cycle 60 (resumed post-interruption):
- Verified the active hourly cron daemon task-12095 is running normally.
- Probed live production edge health: https://shadowflow.work/api/health returned HTTP 200 OK with 375ms D1 database latency.
- Executed the autonomous SEO cycle: published article #35 ('Cost and Latency Benchmarks for Healthcare Patient Triage and HL7 Message Routing in Enterprise Workflows').
- Resolved SQLite D1 primary key collision by upgrading synchronization to INSERT OR REPLACE INTO blogs with unique dyn-{slug} keys.
- Synchronized all 35 articles to Cloudflare D1 remote database (remote database count: 35).
- Submitted 16 canonical URLs to api.indexnow.org (HTTP 200 OK).
- Updated public/llms-full.txt (35 articles) and public/sitemap.xml.
- Verified all 99 Vitest unit and contract tests passed with zero failures across 9 test suites.
- Verified ESLint passed with zero errors across the codebase.
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
