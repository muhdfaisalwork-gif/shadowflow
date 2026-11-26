# ShadowFlow Progress Dashboard Backend API

API contract for the owner-only ShadowFlow progress dashboard. Gemma 4 uses these endpoints to build and drive the dashboard frontend under `src/pages/` and `src/components/`.

## Authentication & Privacy Rules

- All `/api/admin/stats/*` endpoints require either:
  - `Authorization: Bearer <jwt>` where the verified JWT `email` matches an entry in `ADMIN_EMAILS` (case-insensitive), or
  - `x-admin-key: <JWT_SECRET>` for headless/internal scripts.
- Unauthenticated requests receive `401`. Authenticated non-admin users receive `403`.
- Public tracking stores no cookies and no raw IP addresses. Unique visitor counts use a daily salted SHA-256 hash (`visitor_hash`) computed on the Worker. No admin endpoint returns raw IPs or other users' emails.

---

## 1. Public Tracking & Downloads

### `POST /api/track`

Records a page visit without cookies.

Request body (JSON, max 4 KB):
```json
{
  "path": "/pricing",
  "referrer": "https://google.com/search?q=shadowflow"
}
```

Responses:
- `201`: `{ "tracked": true, "day": "2026-11-26", "path": "/pricing" }`
- `200`: `{ "tracked": false, "reason": "bot" }` when a crawler/bot `User-Agent` is filtered.
- `400`: Invalid JSON or `path` not starting with `/`.
- `413`: Body exceeds 4 KB.
- `429`: Per-visitor rate limit exceeded (60 hits/minute).

### `GET /download/:asset`

Logs an asset download to `downloads` and redirects (`302`) to GitHub's latest release asset URL.

- Query param: `?format=json` returns `200 { "asset": "...", "downloadUrl": "..." }` instead of `302`.
- `:asset` must match `/^[a-zA-Z0-9._-]{1,120}$/` (`400` otherwise).

---

## 2. Payments Webhook (On Hold)

### `POST /webhook/payments`

Provider-agnostic webhook endpoint for future merchant integration (Stripe/PayFast/Paddle/Lemon Squeezy).

- While payments are on hold (`PAYMENTS_WEBHOOK_SECRET` unset): returns `503`:
  ```json
  {
    "error": "Payments provider not configured",
    "status": "not_connected",
    "note": "Payments are on hold until a merchant provider is connected."
  }
  ```
- When `PAYMENTS_WEBHOOK_SECRET` is set: requires `X-Payments-Signature` (HMAC-SHA256 hex of `${timestamp}.${rawBody}`) and `X-Payments-Timestamp` (unix seconds within ±300s). Deduplicates by `external_event_id`.

---

## 3. Owner Progress Dashboard Endpoints

All `GET` stats endpoints accept `?range=7d|30d|90d` (default `30d`).

### `GET /api/admin/stats/summary?range=30d`

Returns overall metrics across visits, downloads, users, product usage, payments, and GitHub repo traffic.

```json
{
  "range": "30d",
  "days": 30,
  "sinceDay": "2026-10-28",
  "visits": {
    "totalViews": 0,
    "uniqueVisitors": 0,
    "blogViews": 0,
    "llmsViews": 0,
    "topPaths": [{ "path": "/", "views": 0 }],
    "topReferrers": [{ "domain": "google.com", "views": 0 }],
    "topCountries": [{ "country": "PK", "views": 0 }]
  },
  "downloads": {
    "directDownloads": 0,
    "releaseDownloads": 0,
    "totalDownloads": 0,
    "byAsset": [{ "asset": "shadowflow.zip", "count": 0 }],
    "note": "No GitHub releases or direct downloads recorded yet."
  },
  "product": {
    "usersTotal": 0,
    "newSignupsInRange": 0,
    "workflowsTotal": 0,
    "workflowsCreatedInRange": 0,
    "runsTotal": 0,
    "runsByStatus": [{ "status": "completed", "count": 0 }],
    "aiRequestsInRange": 0,
    "blogsPublished": 0
  },
  "payments": {
    "status": "not_connected",
    "provider": "none",
    "totalRevenueCents": 0,
    "succeededCount": 0,
    "planBreakdown": [{ "plan": "free", "users": 0 }],
    "note": "Payments are on hold until a merchant provider is connected. Plan breakdown reflects user_subscriptions plan changes, not revenue."
  },
  "repo": {
    "repo": "muhdfaisalwork-gif/shadowflow",
    "status": "synced",
    "stars": 0,
    "forks": 0,
    "watchers": 1,
    "openIssues": 0,
    "clonesInRange": 768,
    "uniqueClonersInRange": 186,
    "viewsInRange": 0,
    "uniqueViewersInRange": 0,
    "releaseDownloads": 0,
    "syncedAt": "2026-11-26T04:50:00Z"
  }
}
```

UI display rule for Gemma 4: when `payments.status === "not_connected"`, show `"Not connected"` instead of `$0 revenue`, and display `payments.note` alongside `planBreakdown`.

### `GET /api/admin/stats/timeseries?metric=<name>&range=30d`

Daily series for Recharts.

- Valid `metric` values: `visits`, `unique_visitors`, `downloads`, `signups`, `runs`, `ai_usage`, `clones`, `repo_views`.
- Unknown metric returns `400`.
- Response:
```json
{
  "metric": "visits",
  "range": "30d",
  "days": 30,
  "points": [
    { "day": "2026-11-25", "value": 12 },
    { "day": "2026-11-26", "value": 19 }
  ]
}
```

### `GET /api/admin/stats/repo?range=30d`

Returns `repo`, `status` (`"synced"` or `"not_synced"`), `latest` daily snapshot (with parsed `topReferrers`), and daily `history` rows in the requested range.

### `POST /api/admin/stats/repo/sync`

Manually triggers a GitHub API sync into `repo_stats_daily`. Returns `503` if `GITHUB_TOKEN` is not set on the Worker, or `200 { "synced": true, "snapshot": ... }`.

### `GET /api/admin/stats/payments?range=30d`

Returns `{ status, provider, note, summary: { totalRevenueCents, succeededCount }, planBreakdown, recentPayments }`. Does not return customer emails.
