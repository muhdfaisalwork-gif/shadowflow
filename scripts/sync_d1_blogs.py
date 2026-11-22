#!/usr/bin/env python3
"""
ShadowFlow D1 Blog Synchronization Script
Syncs all articles from public/blogs.json to the Cloudflare D1 database (local or remote)
via wrangler d1 execute using temporary SQL batch files.
"""

import json
import os
import sys
import subprocess
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BLOGS_JSON_PATH = BASE_DIR / "public" / "blogs.json"
WORKER_DIR = BASE_DIR / "worker"

def sql_escape(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def generate_upsert_sql(post: dict) -> str:
    p_id = sql_escape(post.get("id") or post.get("slug"))
    slug = sql_escape(post.get("slug"))
    title = sql_escape(post.get("title"))
    excerpt = sql_escape(post.get("excerpt", ""))
    content = sql_escape(post.get("content", ""))
    category = sql_escape(post.get("category", "AI Automation"))
    pub_at = sql_escape(post.get("publishedAt", "2026-11-22"))
    up_at = sql_escape(post.get("updatedAt", "2026-11-22"))
    try:
        read_mins = int(post.get("readingTimeMinutes", 6))
    except (ValueError, TypeError):
        read_mins = 6
    author = sql_escape(post.get("author", "Faisal Muhammad"))
    author_role = sql_escape(post.get("authorRole", "Chief AI Architect"))
    keyword = sql_escape(post.get("targetKeyword", "ai workflow automation"))
    tags = sql_escape(json.dumps(post.get("tags", [])))
    schema = sql_escape(json.dumps(post.get("schemaJsonLd", {})))

    return f"""INSERT OR REPLACE INTO blogs (id, slug, title, excerpt, content, category, published_at, updated_at, reading_time_minutes, author, author_role, target_keyword, tags, schema_json_ld)
VALUES ({p_id}, {slug}, {title}, {excerpt}, {content}, {category}, {pub_at}, {up_at}, {read_mins}, {author}, {author_role}, {keyword}, {tags}, {schema});"""

def sync_blogs_to_d1(remote: bool = True) -> bool:
    if not BLOGS_JSON_PATH.exists():
        print(f"[Sync] Error: {BLOGS_JSON_PATH} not found.")
        return False

    with open(BLOGS_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    posts = data.get("posts", [])
    if not posts:
        print("[Sync] No posts found to sync.")
        return False

    print(f"[Sync] Preparing SQL batch for {len(posts)} posts...")
    statements = [generate_upsert_sql(p) for p in posts]
    batch_sql = "\n\n".join(statements)

    temp_sql_file = WORKER_DIR / "temp_sync_blogs.sql"
    try:
        with open(temp_sql_file, "w", encoding="utf-8") as f:
            f.write(batch_sql)

        cmd = ["npx", "wrangler", "d1", "execute", "shadowflow-db"]
        if remote:
            cmd.append("--remote")
        cmd.append(f"--file={temp_sql_file.name}")

        print(f"[Sync] Running wrangler: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            cwd=str(WORKER_DIR),
            capture_output=True,
            text=True,
            shell=True
        )

        if result.returncode == 0:
            print(f"[Sync] Successfully synchronized {len(posts)} articles to D1 (remote={remote})!")
            return True
        else:
            print(f"[Sync] Wrangler D1 execute failed with exit code {result.returncode}:")
            print(result.stderr or result.stdout)
            return False
    finally:
        if temp_sql_file.exists():
            try:
                temp_sql_file.unlink()
            except Exception:
                pass

if __name__ == "__main__":
    is_remote = "--local" not in sys.argv
    success = sync_blogs_to_d1(remote=is_remote)
    sys.exit(0 if success else 1)
