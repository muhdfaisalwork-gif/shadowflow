#!/usr/bin/env python3
import urllib.request
import json
import sys

prompt = """You are Gemma 4, the primary frontend AI model responsible for 100% of user interface interactions and communication for ShadowFlow.
The backend agent has implemented, debugged twice, deployed, and pushed the ShadowFlow owner progress dashboard backend (zero frontend files edited). Verified facts only:
- Schema & remote D1 migration: Added tables page_views, downloads, payments, and repo_stats_daily in worker/migrations/0002_progress_dashboard.sql (mirrored in worker/schema.sql) and applied to remote shadowflow-db (9 queries executed, 16 tables total).
- Privacy-safe tracking & downloads: Implemented POST /api/track (cookie-free, bot-filtered, 60/min rate limit, daily salted SHA-256 visitor hash with zero raw IP storage) and GET /download/:asset (logs click and redirects 302 or returns JSON with ?format=json).
- Payments on hold as requested: Implemented provider-agnostic POST /webhook/payments (HMAC-SHA256 + timestamp replay check + duplicate eventId guard) and GET /api/admin/stats/payments. Because Stripe is unavailable in Pakistan and payments are on hold, PAYMENTS_WEBHOOK_SECRET is unset: the webhook returns HTTP 503 with status 'not_connected', and the stats API shows 'not_connected' with user_subscriptions plan counts labeled as plan changes, not revenue.
- Owner stats API & API contract for Gemma 4 frontend: Implemented admin-gated GET /api/admin/stats/summary, /timeseries (visits, unique_visitors, downloads, signups, runs, ai_usage, clones, repo_views), /repo, POST /repo/sync, and /payments, plus updated GET /api/backend/tools to 24 tools. Documented every endpoint and payload in docs/progress-dashboard-api.md for Gemma 4 to build the UI.
- GitHub repo tracking: Added cron trigger ('0 2 * * *') in worker/wrangler.toml and scheduled handler in worker/src/index.ts. Created scripts/sync_repo_stats.py and backfilled 14 days from github.com/muhdfaisalwork-gif/shadowflow into remote D1 (768 clones, 186 unique cloners, 18 repo views, 1 watcher, 0 stars, 0 forks, 0 release downloads).
- Two debug passes before push and deploy:
  - Pass 1: tsc --noEmit (root & worker) 0 errors, eslint 0 errors, vitest 102/102 passed (9 files), vite build succeeded, scripts/sync_repo_stats.py --local synced 14 rows, and local wrangler dev tested all routes.
  - Pass 2 (clean state after deleting dist and worker/.wrangler/state): re-applied schema + migration, synced local D1, verified POST /api/track (201) + GET /api/admin/stats/summary (200, confirmed zero raw IP leakage), and re-ran tsc --noEmit (root & worker), eslint (0 errors), vitest (102/102), and vite build.
- Live deployment & smoke test: Deployed shadowflow-worker Version ID 3d54a60b-51a3-4d32-9499-aff71caff4f5 with cron 0 2 * * *. Verified live production: /api/health returned 200, POST /api/track returned 201, unauthenticated /api/admin/stats/summary returned 401, POST /webhook/payments returned 503 not_connected, and /api/backend/tools returned 24 tools.
- Secret note for user: Worker secrets currently hold GROQ_API_KEY, JWT_SECRET, and RESEND_API_KEY. Setting ADMIN_EMAILS (via npx wrangler secret put ADMIN_EMAILS) lets your owner login access /api/admin/stats/*, and setting GITHUB_TOKEN enables the automatic daily 02:00 UTC repo sync (until then, scripts/sync_repo_stats.py syncs via gh CLI). x-admin-key (matching JWT_SECRET) works immediately.
- Zero frontend files (src/pages/* or src/components/*) were touched.

Deliver this report directly to the user as Gemma 4. Follow strict human-natural writing standards: plain verbs, concrete facts and numbers, direct tone, zero buzzwords (no 'delve', 'robust', 'seamless', 'landscape', 'empower', 'cutting-edge'). Include next note that Gemma 4 is ready to build the frontend dashboard page from docs/progress-dashboard-api.md when you want UI work."""

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
