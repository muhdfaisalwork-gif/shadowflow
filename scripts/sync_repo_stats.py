#!/usr/bin/env python3
"""
Backfill and sync ShadowFlow GitHub repository traffic and metadata into Cloudflare D1.
Uses local `gh api` (already authenticated) to pull the 14-day clones/views window,
popular referrers, stars/forks/watchers, and release asset download totals, then executes
an upsert batch against `shadowflow-db` via `npx wrangler d1 execute`.
"""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WORKER_DIR = BASE_DIR / "worker"
DEFAULT_REPO = "muhdfaisalwork-gif/shadowflow"


def gh_api(endpoint: str):
    cmd = ["gh", "api", endpoint]
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if res.returncode != 0:
        raise RuntimeError(f"gh api {endpoint} failed: {res.stderr.strip() or res.stdout.strip()}")
    return json.loads(res.stdout)


def sql_escape(val) -> str:
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def build_sql_statements(repo: str) -> tuple[list[str], dict]:
    meta = gh_api(f"repos/{repo}")
    clones_data = gh_api(f"repos/{repo}/traffic/clones")
    views_data = gh_api(f"repos/{repo}/traffic/views")
    referrers_data = gh_api(f"repos/{repo}/traffic/popular/referrers")
    releases_data = gh_api(f"repos/{repo}/releases")

    stars = int(meta.get("stargazers_count", 0))
    forks = int(meta.get("forks_count", 0))
    watchers = int(meta.get("subscribers_count", meta.get("watchers_count", 0)))
    open_issues = int(meta.get("open_issues_count", 0))

    release_downloads = 0
    if isinstance(releases_data, list):
        for rel in releases_data:
            for asset in rel.get("assets", []) or []:
                release_downloads += int(asset.get("download_count", 0))

    referrers_json = json.dumps(referrers_data if isinstance(referrers_data, list) else [])

    daily: dict[str, dict] = {}
    for entry in clones_data.get("clones", []) or []:
        day = str(entry.get("timestamp", ""))[:10]
        if not day:
            continue
        daily.setdefault(day, {"clones_count": 0, "clones_uniques": 0, "views_count": 0, "views_uniques": 0})
        daily[day]["clones_count"] = int(entry.get("count", 0))
        daily[day]["clones_uniques"] = int(entry.get("uniques", 0))

    for entry in views_data.get("views", []) or []:
        day = str(entry.get("timestamp", ""))[:10]
        if not day:
            continue
        daily.setdefault(day, {"clones_count": 0, "clones_uniques": 0, "views_count": 0, "views_uniques": 0})
        daily[day]["views_count"] = int(entry.get("count", 0))
        daily[day]["views_uniques"] = int(entry.get("uniques", 0))

    now_iso = datetime.now(timezone.utc).isoformat()
    today_day = now_iso[:10]
    if not daily:
        daily[today_day] = {"clones_count": 0, "clones_uniques": 0, "views_count": 0, "views_uniques": 0}

    statements = []
    for day in sorted(daily.keys()):
        metrics = daily[day]
        stmt = (
            "INSERT OR REPLACE INTO repo_stats_daily "
            "(day, repo, stars, forks, watchers, open_issues, clones_count, clones_uniques, "
            "views_count, views_uniques, release_downloads, top_referrers, synced_at) VALUES ("
            f"{sql_escape(day)}, {sql_escape(repo)}, {stars}, {forks}, {watchers}, {open_issues}, "
            f"{metrics['clones_count']}, {metrics['clones_uniques']}, "
            f"{metrics['views_count']}, {metrics['views_uniques']}, "
            f"{release_downloads}, {sql_escape(referrers_json)}, {sql_escape(now_iso)});"
        )
        statements.append(stmt)

    summary = {
        "repo": repo,
        "daysSynced": len(statements),
        "stars": stars,
        "forks": forks,
        "watchers": watchers,
        "clones14dTotal": int(clones_data.get("count", 0)),
        "clones14dUniques": int(clones_data.get("uniques", 0)),
        "views14dTotal": int(views_data.get("count", 0)),
        "views14dUniques": int(views_data.get("uniques", 0)),
        "releaseDownloads": release_downloads,
    }
    return statements, summary


def sync_repo_stats(repo: str = DEFAULT_REPO, remote: bool = True) -> bool:
    statements, summary = build_sql_statements(repo)
    print(f"[RepoSync] Fetched GitHub metrics for {repo}: {json.dumps(summary)}")

    temp_sql = WORKER_DIR / "temp_sync_repo_stats.sql"
    try:
        temp_sql.write_text("\n".join(statements) + "\n", encoding="utf-8")
        cmd = ["npx", "wrangler", "d1", "execute", "shadowflow-db"]
        if remote:
            cmd.append("--remote")
        else:
            cmd.append("--local")
        cmd.append(f"--file={temp_sql.name}")

        res = subprocess.run(cmd, cwd=str(WORKER_DIR), capture_output=True, text=True, shell=True)
        if res.returncode != 0:
            print(f"[RepoSync] D1 sync failed: {res.stderr or res.stdout}", file=sys.stderr)
            return False
        print(f"[RepoSync] Synced {len(statements)} daily rows to D1 (remote={remote}).")
        return True
    finally:
        if temp_sql.exists():
            try:
                temp_sql.unlink()
            except OSError:
                pass


if __name__ == "__main__":
    is_remote = "--local" not in sys.argv
    ok = sync_repo_stats(remote=is_remote)
    sys.exit(0 if ok else 1)
