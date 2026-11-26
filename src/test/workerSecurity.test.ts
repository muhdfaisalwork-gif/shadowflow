// @vitest-environment node
import { describe, it, expect } from "vitest";
import worker, { type D1Database, type D1PreparedStatement, type Env } from "../../worker/src/index";

interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  display_name: string;
  email_verified: number;
  created_at?: string;
}

interface StoredPageView {
  id: string;
  path: string;
  referrer_domain: string;
  country: string;
  visitor_hash: string;
  day: string;
  created_at: string;
}

interface StoredDownload {
  id: string;
  asset: string;
  source: string;
  country: string;
  referrer_domain: string;
  day: string;
  created_at: string;
}

interface StoredPayment {
  id: string;
  provider: string;
  external_event_id: string;
  user_id: string | null;
  plan: string;
  amount_cents: number;
  currency: string;
  status: string;
  metadata: string;
  created_at: string;
}

interface StoredRepoStatsDaily {
  day: string;
  repo: string;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  clones_count: number;
  clones_uniques: number;
  views_count: number;
  views_uniques: number;
  release_downloads: number;
  top_referrers: string;
  synced_at: string;
}

interface StoredTfa {
  enabled: number;
  secret: string;
  backup_codes: string;
  preferred_method: string;
  email_otp?: string;
  email_otp_expires_at?: string;
}

interface StoredWorkflow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  nodes: string;
  edges: string;
  settings: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface StoredWorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_log: string | null;
  logs: string;
}

interface StoredWorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  nodes: string;
  edges: string;
  settings: string;
  created_by: string;
  change_summary: string;
  created_at: string;
}

interface StoredAuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string;
  created_at: string;
}

function createMockDb(options?: { failHealthCheck?: boolean }): {
  db: D1Database;
  users: Map<string, StoredUser>;
  tfaByUserId: Map<string, StoredTfa>;
  workflows: Map<string, StoredWorkflow>;
  workflowRuns: StoredWorkflowRun[];
  workflowVersions: StoredWorkflowVersion[];
  auditLogs: StoredAuditLog[];
  pageViews: StoredPageView[];
  downloads: StoredDownload[];
  payments: StoredPayment[];
  repoStatsDaily: Map<string, StoredRepoStatsDaily>;
  userSubscriptions: Map<string, string>;
  graphMemoryNodes: Array<{ id: string; user_id: string; node_type: string; label: string; data: string }>;
  aiUsageWriteCount: () => number;
  batchCallCount: () => number;
  selectOneCount: () => number;
} {
  const users = new Map<string, StoredUser>();
  const tfaByUserId = new Map<string, StoredTfa>();
  const workflows = new Map<string, StoredWorkflow>();
  const workflowRuns: StoredWorkflowRun[] = [];
  const workflowVersions: StoredWorkflowVersion[] = [];
  const auditLogs: StoredAuditLog[] = [];
  const blogs = new Map<string, Record<string, unknown>>();
  const pageViews: StoredPageView[] = [];
  const downloads: StoredDownload[] = [];
  const payments: StoredPayment[] = [];
  const repoStatsDaily = new Map<string, StoredRepoStatsDaily>();
  const userSubscriptions = new Map<string, string>();
  const graphMemoryNodes: Array<{ id: string; user_id: string; node_type: string; label: string; data: string }> = [];
  const aiUsageCounts = new Map<string, number>();
  let healthQueries = 0;
  let aiUsageWrites = 0;
  let batchCalls = 0;

  const prepare = (query: string): D1PreparedStatement => {
    let args: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        args = values;
        return stmt;
      },
      first: async <T = unknown>() => {
        if (query === "SELECT 1") {
          healthQueries += 1;
          if (options?.failHealthCheck) {
            throw new Error("Simulated D1 outage");
          }
          return { 1: 1 } as T;
        }
        if (query.startsWith("SELECT id FROM users WHERE email =")) {
          const email = String(args[0]);
          const found = Array.from(users.values()).find((u) => u.email === email);
          return (found ? { id: found.id } : null) as T | null;
        }
        if (query.startsWith("SELECT id, email, password_hash, password_salt, display_name FROM users WHERE email =")) {
          const email = String(args[0]);
          const found = Array.from(users.values()).find((u) => u.email === email);
          return (found ?? null) as T | null;
        }
        if (query.startsWith("SELECT email_verified FROM users WHERE id =")) {
          const id = String(args[0]);
          const found = users.get(id);
          return (found ? { email_verified: found.email_verified } : null) as T | null;
        }
        if (query.includes("FROM user_tfa WHERE user_id =")) {
          const userId = String(args[0]);
          return (tfaByUserId.get(userId) ?? null) as T | null;
        }
        if (query.startsWith("SELECT id FROM workflows WHERE id = ? AND user_id = ?")) {
          const [wfId, userId] = args as string[];
          const wf = workflows.get(wfId);
          return (wf && wf.user_id === userId ? { id: wf.id } : null) as T | null;
        }
        if (
          query.startsWith("SELECT id, name, nodes, edges, is_active FROM workflows WHERE id = ? AND user_id = ?") ||
          query.startsWith("SELECT id, user_id, name, description, is_active FROM workflows WHERE id = ? AND user_id = ?") ||
          query.startsWith("SELECT * FROM workflows WHERE id = ? AND user_id = ?")
        ) {
          const [wfId, userId] = args as string[];
          const wf = workflows.get(wfId);
          return (wf && wf.user_id === userId ? wf : null) as T | null;
        }
        if (
          query.startsWith("SELECT id, workflow_id, version, nodes, edges, settings FROM workflow_versions WHERE id = ? AND workflow_id = ?")
        ) {
          const [verId, wfId] = args as string[];
          const found = workflowVersions.find((v) => v.id === verId && v.workflow_id === wfId);
          return (found ?? null) as T | null;
        }
        if (
          query.startsWith("SELECT id, user_id, name, description, nodes, edges, settings, is_active FROM workflows WHERE id = ?") ||
          query.startsWith("SELECT id, user_id, name FROM workflows WHERE id = ?") ||
          query.startsWith("SELECT id, user_id FROM workflows WHERE id = ?") ||
          query.startsWith("SELECT id, name, nodes, edges, settings, is_active FROM workflows WHERE id = ?")
        ) {
          const wf = workflows.get(String(args[0]));
          return (wf ?? null) as T | null;
        }
        if (query.startsWith("SELECT MAX(version) as max_v FROM workflow_versions WHERE workflow_id = ?")) {
          const wfId = String(args[0]);
          const maxV = workflowVersions
            .filter((v) => v.workflow_id === wfId)
            .reduce((acc, v) => Math.max(acc, v.version), 0);
          return { max_v: maxV } as T;
        }
        if (
          query.startsWith(
            "SELECT id, workflow_id, status, started_at, finished_at, error_log, logs FROM workflow_runs WHERE id = ? AND workflow_id = ?"
          ) ||
          query.startsWith(
            "SELECT id, workflow_id, status FROM workflow_runs WHERE id = ? AND workflow_id = ?"
          )
        ) {
          const [runId, wfId] = args as string[];
          const found = workflowRuns.find((r) => r.id === runId && r.workflow_id === wfId);
          return (found ?? null) as T | null;
        }
        if (query.startsWith("SELECT count FROM ai_usage WHERE user_id = ? AND request_date = ?")) {
          const key = `${String(args[0])}:${String(args[1])}`;
          const count = aiUsageCounts.get(key);
          return (count !== undefined ? { count } : null) as T | null;
        }
        if (query.includes("FROM blogs WHERE slug = ?")) {
          const slug = String(args[0]);
          const found = blogs.get(slug);
          return (found ?? null) as T | null;
        }
        if (query.startsWith("SELECT id FROM payments WHERE external_event_id = ?")) {
          const eventId = String(args[0]);
          const found = payments.find((p) => p.external_event_id === eventId);
          return (found ? { id: found.id } : null) as T | null;
        }
        if (query.includes("FROM page_views WHERE day >= ?") && query.includes("COUNT(DISTINCT visitor_hash)")) {
          const sinceDay = String(args[0]);
          const filtered = pageViews.filter((pv) => pv.day >= sinceDay);
          const uniqueVisitors = new Set(filtered.map((pv) => pv.visitor_hash)).size;
          const blogViews = filtered.filter((pv) => pv.path.startsWith("/blog")).length;
          const llmsViews = filtered.filter((pv) => pv.path.startsWith("/llms")).length;
          return {
            totalViews: filtered.length,
            uniqueVisitors,
            blogViews,
            llmsViews,
          } as T;
        }
        if (query === "SELECT COUNT(*) as total FROM users") {
          return { total: users.size } as T;
        }
        if (query === "SELECT COUNT(*) as count FROM users WHERE created_at >= ?") {
          const sinceDay = String(args[0]);
          const count = Array.from(users.values()).filter((u) => (u.created_at || "") >= sinceDay).length;
          return { count } as T;
        }
        if (query === "SELECT COUNT(*) as total FROM workflows") {
          return { total: workflows.size } as T;
        }
        if (query === "SELECT COUNT(*) as count FROM workflows WHERE created_at >= ?") {
          const sinceDay = String(args[0]);
          const count = Array.from(workflows.values()).filter((w) => w.created_at >= sinceDay).length;
          return { count } as T;
        }
        if (query.startsWith("SELECT COALESCE(SUM(count), 0) as total FROM ai_usage WHERE request_date >= ?")) {
          const sinceDay = String(args[0]);
          let total = 0;
          for (const [k, v] of aiUsageCounts.entries()) {
            const reqDate = k.split(":")[1] || "";
            if (reqDate >= sinceDay) total += v;
          }
          return { total } as T;
        }
        if (query === "SELECT COUNT(*) as total FROM blogs") {
          return { total: blogs.size } as T;
        }
        if (query.includes("FROM payments WHERE created_at >= ?") && query.includes("totalRevenueCents")) {
          const sinceDay = String(args[0]);
          const succeeded = payments.filter((p) => p.created_at >= sinceDay && p.status === "succeeded");
          const totalRevenueCents = succeeded.reduce((acc, p) => acc + p.amount_cents, 0);
          return { totalRevenueCents, succeededCount: succeeded.length } as T;
        }
        if (query.includes("FROM repo_stats_daily ORDER BY day DESC LIMIT 1")) {
          const sorted = Array.from(repoStatsDaily.values()).sort((a, b) => b.day.localeCompare(a.day));
          return (sorted[0] ?? null) as T | null;
        }
        if (query.includes("FROM repo_stats_daily WHERE day >= ?") && query.includes("clonesInRange")) {
          const sinceDay = String(args[0]);
          const rows = Array.from(repoStatsDaily.values()).filter((r) => r.day >= sinceDay);
          return {
            clonesInRange: rows.reduce((a, r) => a + r.clones_count, 0),
            uniqueClonersInRange: rows.reduce((a, r) => a + r.clones_uniques, 0),
            viewsInRange: rows.reduce((a, r) => a + r.views_count, 0),
            uniqueViewersInRange: rows.reduce((a, r) => a + r.views_uniques, 0),
          } as T;
        }
        return null;
      },
      run: async () => {
        if (query.startsWith("INSERT INTO users")) {
          const [id, email, password_hash, password_salt, display_name] = args as string[];
          users.set(id, {
            id,
            email,
            password_hash,
            password_salt,
            display_name,
            email_verified: 0,
            created_at: new Date().toISOString(),
          });
        } else if (query.startsWith("INSERT INTO workflows")) {
          const [id, user_id, name, description, nodes, edges, settings, is_active, created_at, updated_at] = args as [
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            number,
            string,
            string,
          ];
          workflows.set(id, {
            id,
            user_id,
            name,
            description,
            nodes,
            edges,
            settings,
            is_active,
            created_at,
            updated_at,
          });
        } else if (query.startsWith("UPDATE workflows SET nodes =")) {
          const [nodes, edges, settings, updated_at, id] = args as [string, string, string, string, string];
          const existing = workflows.get(id);
          if (existing) {
            workflows.set(id, { ...existing, nodes, edges, settings, updated_at });
          }
        } else if (query.startsWith("UPDATE workflows SET")) {
          const [name, description, nodes, edges, settings, is_active, updated_at, id] = args as [
            string,
            string,
            string,
            string,
            string,
            number,
            string,
            string,
          ];
          const existing = workflows.get(id);
          if (existing) {
            workflows.set(id, {
              ...existing,
              name,
              description,
              nodes,
              edges,
              settings,
              is_active,
              updated_at,
            });
          }
        } else if (query.startsWith("INSERT INTO workflow_versions")) {
          const [id, workflow_id, version, nodes, edges, settings, created_by, change_summary, created_at] = args as [
            string,
            string,
            number,
            string,
            string,
            string,
            string,
            string,
            string,
          ];
          workflowVersions.push({
            id,
            workflow_id,
            version,
            nodes,
            edges,
            settings,
            created_by,
            change_summary,
            created_at,
          });
        } else if (query.startsWith("DELETE FROM workflow_versions WHERE workflow_id = ?")) {
          const wfId = String(args[0]);
          for (let i = workflowVersions.length - 1; i >= 0; i--) {
            if (workflowVersions[i].workflow_id === wfId) {
              workflowVersions.splice(i, 1);
            }
          }
        } else if (query.startsWith("DELETE FROM workflow_runs WHERE workflow_id = ?")) {
          const wfId = String(args[0]);
          for (let i = workflowRuns.length - 1; i >= 0; i--) {
            if (workflowRuns[i].workflow_id === wfId) {
              workflowRuns.splice(i, 1);
            }
          }
        } else if (query.startsWith("DELETE FROM workflows WHERE id = ?")) {
          workflows.delete(String(args[0]));
        } else if (query.startsWith("INSERT INTO workflow_runs")) {
          const [id, workflow_id, status, started_at, finished_at, error_log, logs] = args as [
            string,
            string,
            string,
            string,
            string | null,
            string | null,
            string,
          ];
          workflowRuns.push({ id, workflow_id, status, started_at, finished_at, error_log, logs });
        } else if (query.startsWith("INSERT INTO ai_usage")) {
          const [, userId, requestDate] = args as string[];
          const key = `${userId}:${requestDate}`;
          aiUsageCounts.set(key, (aiUsageCounts.get(key) ?? 0) + 1);
          aiUsageWrites += 1;
        } else if (query.startsWith("INSERT INTO user_graph_memory")) {
          const [id, user_id, node_type, label, data] = args as string[];
          const idx = graphMemoryNodes.findIndex((n) => n.id === id);
          const item = { id, user_id, node_type, label, data };
          if (idx >= 0) {
            if (graphMemoryNodes[idx].user_id === user_id) {
              graphMemoryNodes[idx] = item;
            }
          } else {
            graphMemoryNodes.push(item);
          }
        } else if (query.startsWith("INSERT INTO audit_logs")) {
          const [id, user_id, action, resource_type, resource_id, details, created_at] = args as string[];
          auditLogs.push({ id, user_id, action, resource_type, resource_id, details, created_at });
        } else if (query.startsWith("UPDATE workflow_runs SET status = ?, finished_at = ? WHERE id = ? AND workflow_id = ?")) {
          const [status, finished_at, id, workflow_id] = args as [string, string, string, string];
          const found = workflowRuns.find((r) => r.id === id && r.workflow_id === workflow_id);
          if (found) {
            found.status = status;
            found.finished_at = finished_at;
          }
        } else if (query.startsWith("DELETE FROM audit_logs WHERE user_id = ? AND created_at < ?")) {
          const [user_id, before] = args as [string, string];
          for (let i = auditLogs.length - 1; i >= 0; i--) {
            if (auditLogs[i].user_id === user_id && auditLogs[i].created_at < before) {
              auditLogs.splice(i, 1);
            }
          }
        } else if (query.startsWith("INSERT INTO blogs")) {
          const [id, slug, title, excerpt, content, category, published_at, updated_at, reading_time_minutes, author, author_role, target_keyword, tags, schema_json_ld] = args as unknown[];
          blogs.set(String(slug), {
            id,
            slug,
            title,
            excerpt,
            content,
            category,
            published_at,
            publishedAt: published_at,
            updated_at,
            updatedAt: updated_at,
            reading_time_minutes,
            readingTimeMinutes: reading_time_minutes,
            author,
            author_role,
            authorRole: author_role,
            target_keyword,
            targetKeyword: target_keyword,
            tags,
            schema_json_ld,
            schemaJsonLd: schema_json_ld,
          });
        } else if (query.startsWith("INSERT INTO page_views")) {
          const [id, path, referrer_domain, country, visitor_hash, day, created_at] = args as string[];
          pageViews.push({ id, path, referrer_domain, country, visitor_hash, day, created_at });
        } else if (query.startsWith("INSERT INTO downloads")) {
          const [id, asset, source, country, referrer_domain, day, created_at] = args as string[];
          downloads.push({ id, asset, source, country, referrer_domain, day, created_at });
        } else if (query.startsWith("INSERT INTO payments")) {
          const [id, provider, external_event_id, user_id, plan, amount_cents, currency, status, metadata, created_at] = args as [
            string,
            string,
            string,
            string | null,
            string,
            number,
            string,
            string,
            string,
            string,
          ];
          payments.push({ id, provider, external_event_id, user_id, plan, amount_cents, currency, status, metadata, created_at });
        } else if (query.startsWith("INSERT OR REPLACE INTO repo_stats_daily")) {
          const [day, repo, stars, forks, watchers, open_issues, clones_count, clones_uniques, views_count, views_uniques, release_downloads, top_referrers, synced_at] = args as [
            string,
            string,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            string,
            string,
          ];
          repoStatsDaily.set(day, {
            day,
            repo,
            stars,
            forks,
            watchers,
            open_issues,
            clones_count,
            clones_uniques,
            views_count,
            views_uniques,
            release_downloads,
            top_referrers,
            synced_at,
          });
        } else if (query.startsWith("INSERT INTO user_subscriptions")) {
          const [userId, plan] = args as string[];
          userSubscriptions.set(userId, plan);
        }
        return { success: true };
      },
      all: async <T = unknown>() => {
        if (query.includes("FROM workflows WHERE user_id = ?")) {
          const userId = String(args[0]);
          const results = Array.from(workflows.values()).filter((w) => w.user_id === userId);
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM workflow_runs WHERE workflow_id = ?")) {
          const [wfId, limit] = [String(args[0]), Number(args[1] ?? 25)];
          const results = workflowRuns
            .filter((r) => r.workflow_id === wfId)
            .sort((a, b) => b.started_at.localeCompare(a.started_at))
            .slice(0, limit);
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM audit_logs")) {
          const userId = String(args[0]);
          let filtered = auditLogs.filter((a) => a.user_id === userId);
          if (query.includes("resource_type = ?") && query.includes("resource_id = ?")) {
            const rType = String(args[1]);
            const rId = String(args[2]);
            filtered = filtered.filter((a) => a.resource_type === rType && a.resource_id === rId);
          } else {
            if (query.includes("resource_type = ?")) {
              const rType = String(args[1]);
              filtered = filtered.filter((a) => a.resource_type === rType);
            }
            if (query.includes("action = ?")) {
              const actionMatch = args.find((a, i) => i > 0 && typeof a === "string" && a.startsWith("workflow."));
              if (actionMatch) {
                filtered = filtered.filter((a) => a.action === String(actionMatch));
              }
            }
          }
          const rawLimit = Number(args[args.length - 1]);
          const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
          const results = filtered
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, limit);
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM blogs")) {
          const results = Array.from(blogs.values()).sort((a, b) =>
            String(b.published_at || "").localeCompare(String(a.published_at || ""))
          );
          return { success: true, results: results as T[] };
        }
        if (query.startsWith("SELECT path, COUNT(*) as views FROM page_views WHERE day >= ? GROUP BY path")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const pv of pageViews) {
            if (pv.day >= sinceDay) counts.set(pv.path, (counts.get(pv.path) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .map(([path, views]) => ({ path, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM page_views WHERE day >= ? AND referrer_domain != ''")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const pv of pageViews) {
            if (pv.day >= sinceDay && pv.referrer_domain) {
              counts.set(pv.referrer_domain, (counts.get(pv.referrer_domain) || 0) + 1);
            }
          }
          const results = Array.from(counts.entries())
            .map(([domain, views]) => ({ domain, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);
          return { success: true, results: results as T[] };
        }
        if (query.startsWith("SELECT country, COUNT(*) as views FROM page_views WHERE day >= ? GROUP BY country")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const pv of pageViews) {
            if (pv.day >= sinceDay) counts.set(pv.country, (counts.get(pv.country) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .map(([country, views]) => ({ country, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);
          return { success: true, results: results as T[] };
        }
        if (query.startsWith("SELECT asset, COUNT(*) as count FROM downloads WHERE day >= ? GROUP BY asset")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const dl of downloads) {
            if (dl.day >= sinceDay) counts.set(dl.asset, (counts.get(dl.asset) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .map(([asset, count]) => ({ asset, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
          return { success: true, results: results as T[] };
        }
        if (query === "SELECT status, COUNT(*) as count FROM workflow_runs GROUP BY status") {
          const counts = new Map<string, number>();
          for (const r of workflowRuns) {
            counts.set(r.status, (counts.get(r.status) || 0) + 1);
          }
          return {
            success: true,
            results: Array.from(counts.entries()).map(([status, count]) => ({ status, count })) as T[],
          };
        }
        if (query === "SELECT plan, COUNT(*) as users FROM user_subscriptions GROUP BY plan") {
          const counts = new Map<string, number>();
          for (const plan of userSubscriptions.values()) {
            counts.set(plan, (counts.get(plan) || 0) + 1);
          }
          return {
            success: true,
            results: Array.from(counts.entries()).map(([plan, usersCount]) => ({ plan, users: usersCount })) as T[],
          };
        }
        if (query.includes("FROM payments WHERE created_at >= ? ORDER BY created_at DESC")) {
          const sinceDay = String(args[0]);
          const results = payments
            .filter((p) => p.created_at >= sinceDay)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 25);
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM repo_stats_daily WHERE day >= ? ORDER BY day ASC")) {
          const sinceDay = String(args[0]);
          const rows = Array.from(repoStatsDaily.values())
            .filter((r) => r.day >= sinceDay)
            .sort((a, b) => a.day.localeCompare(b.day));
          if (query.includes("clones_count as value")) {
            return { success: true, results: rows.map((r) => ({ day: r.day, value: r.clones_count })) as T[] };
          }
          if (query.includes("views_count as value")) {
            return { success: true, results: rows.map((r) => ({ day: r.day, value: r.views_count })) as T[] };
          }
          return { success: true, results: rows as T[] };
        }
        if (query.startsWith("SELECT day, COUNT(*) as value FROM page_views WHERE day >= ?")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const pv of pageViews) {
            if (pv.day >= sinceDay) counts.set(pv.day, (counts.get(pv.day) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, value]) => ({ day, value }));
          return { success: true, results: results as T[] };
        }
        if (query.startsWith("SELECT day, COUNT(DISTINCT visitor_hash) as value FROM page_views WHERE day >= ?")) {
          const sinceDay = String(args[0]);
          const byDay = new Map<string, Set<string>>();
          for (const pv of pageViews) {
            if (pv.day >= sinceDay) {
              const s = byDay.get(pv.day) || new Set<string>();
              s.add(pv.visitor_hash);
              byDay.set(pv.day, s);
            }
          }
          const results = Array.from(byDay.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, s]) => ({ day, value: s.size }));
          return { success: true, results: results as T[] };
        }
        if (query.startsWith("SELECT day, COUNT(*) as value FROM downloads WHERE day >= ?")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const dl of downloads) {
            if (dl.day >= sinceDay) counts.set(dl.day, (counts.get(dl.day) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, value]) => ({ day, value }));
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM users WHERE substr(created_at, 1, 10) >= ?")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const u of users.values()) {
            const d = (u.created_at || "").slice(0, 10);
            if (d >= sinceDay) counts.set(d, (counts.get(d) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, value]) => ({ day, value }));
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM workflow_runs WHERE substr(started_at, 1, 10) >= ?")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const r of workflowRuns) {
            const d = r.started_at.slice(0, 10);
            if (d >= sinceDay) counts.set(d, (counts.get(d) || 0) + 1);
          }
          const results = Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, value]) => ({ day, value }));
          return { success: true, results: results as T[] };
        }
        if (query.includes("FROM ai_usage WHERE request_date >= ? GROUP BY request_date")) {
          const sinceDay = String(args[0]);
          const counts = new Map<string, number>();
          for (const [k, v] of aiUsageCounts.entries()) {
            const d = k.split(":")[1] || "";
            if (d >= sinceDay) counts.set(d, (counts.get(d) || 0) + v);
          }
          const results = Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, value]) => ({ day, value }));
          return { success: true, results: results as T[] };
        }
        return { success: true, results: [] };
      },
    };
    return stmt;
  };

  const db: D1Database = {
    prepare,
    dump: async () => new ArrayBuffer(0),
    batch: async (statements) => {
      batchCalls += 1;
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    },
    exec: async () => ({ success: true }),
  };

  return {
    db,
    users,
    tfaByUserId,
    workflows,
    workflowRuns,
    workflowVersions,
    auditLogs,
    pageViews,
    downloads,
    payments,
    repoStatsDaily,
    userSubscriptions,
    graphMemoryNodes,
    aiUsageWriteCount: () => aiUsageWrites,
    batchCallCount: () => batchCalls,
    selectOneCount: () => healthQueries,
  };
}

async function signWebhookHmac(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function createEnv(db: D1Database): Env {
  return {
    ENVIRONMENT: "test",
    APP_NAME: "Shadow Flow Worker Test",
    JWT_SECRET: "test-jwt-secret-key-at-least-32-chars-long",
    DB: db,
  };
}

describe("Worker Backend Security & Contract Suite", () => {
  it("runs SELECT 1 on GET /api/health and returns 200 with X-Robots-Tag and Vary: Origin", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/health", {
        headers: { Origin: "https://shadowflow.work" },
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(200);
    expect(mock.selectOneCount()).toBe(1);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Vary")).toBe("Origin");

    const body = (await res.json()) as { databaseStatus: string; status: string };
    expect(body.status).toBe("ok");
    expect(body.databaseStatus).toBe("connected");
  });

  it("returns HTTP 503 and degraded status on GET /api/health when D1 fails", async () => {
    const mock = createMockDb({ failHealthCheck: true });
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/health"),
      createEnv(mock.db)
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; databaseStatus: string };
    expect(body.status).toBe("degraded");
    expect(body.databaseStatus).toBe("degraded");
  });

  it("returns 204 with matching Access-Control-Allow-Origin and Vary: Origin on Pages preview preflight", async () => {
    const mock = createMockDb();
    const previewOrigin = "https://abc123.shadowflow-kdy.pages.dev";
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "OPTIONS",
        headers: { Origin: previewOrigin },
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("rejects malformed emails with HTTP 400 on POST /api/auth/signup", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          password: "strong-password-123",
          displayName: "Test User",
        }),
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(400);
    expect(mock.users.size).toBe(0);
  });

  it("supports non-Latin-1 Unicode displayName in JWT creation and verification", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);
    const unicodeName = "Faisal \u{1F680} \u0645\u0631\u062d\u0628\u0627";

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unicode-user@example.com",
          password: "strong-password-123",
          displayName: unicodeName,
        }),
      }),
      env
    );

    expect(signupRes.status).toBe(201);
    const signupBody = (await signupRes.json()) as {
      token: string;
      user: { display_name: string };
    };
    expect(signupBody.token).toBeTruthy();
    expect(signupBody.user.display_name).toBe(unicodeName);

    const meRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/me", {
        headers: { Authorization: `Bearer ${signupBody.token}` },
      }),
      env
    );

    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { user: { display_name: string } };
    expect(meBody.user.display_name).toBe(unicodeName);
  });

  it("enforces short 300s expiry on 2FA challenge tokens and blocks them on /api/auth/me", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tfa-user@example.com",
          password: "strong-password-123",
          displayName: "TFA User",
        }),
      }),
      env
    );
    const signupBody = (await signupRes.json()) as { user: { id: string } };

    mock.tfaByUserId.set(signupBody.user.id, {
      enabled: 1,
      secret: "JBSWY3DPEHPK3PXP",
      backup_codes: "[]",
      preferred_method: "totp",
    });

    const beforeSec = Math.floor(Date.now() / 1000);
    const loginRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tfa-user@example.com",
          password: "strong-password-123",
        }),
      }),
      env
    );

    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { require2FA: boolean; tempToken: string };
    expect(loginBody.require2FA).toBe(true);
    expect(loginBody.tempToken).toBeTruthy();

    const payloadJson = Buffer.from(loginBody.tempToken.split(".")[1], "base64url").toString("utf8");
    const claims = JSON.parse(payloadJson) as { exp: number; type: string };
    expect(claims.type).toBe("2fa_challenge");
    expect(claims.exp - beforeSec).toBeLessThanOrEqual(310);
    expect(claims.exp - beforeSec).toBeGreaterThanOrEqual(290);

    const meRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/me", {
        headers: { Authorization: `Bearer ${loginBody.tempToken}` },
      }),
      env
    );
    expect(meRes.status).toBe(401);
  });

  it("rejects foreign IndexNow URLs and batches larger than 50 URLs with HTTP 400", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const foreignRes = await worker.fetch(
      new Request("https://shadowflow.work/api/seo/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["https://evil.example/spam"] }),
      }),
      env
    );
    expect(foreignRes.status).toBe(400);

    const oversized = Array.from({ length: 51 }, (_, idx) => `https://shadowflow.work/blog/post-${idx}`);
    const oversizeRes = await worker.fetch(
      new Request("https://shadowflow.work/api/seo/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: oversized }),
      }),
      env
    );
    expect(oversizeRes.status).toBe(400);
  });

  it("returns HTTP 404 JSON on unknown /api/* routes instead of falling through to SPA HTML", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/unknown-route"),
      createEnv(mock.db)
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = (await res.json()) as { error: string; path: string };
    expect(body.error).toBe("API Endpoint Not Found");
    expect(body.path).toBe("/api/unknown-route");
  });

  it("returns HTTP 200 application/json with empty body and Vary: Origin on HEAD /api/execute", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "HEAD",
        headers: { Origin: "https://shadowflow.work" },
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(await res.text()).toBe("");
  });

  it("returns HTTP 405 with Allow header on DELETE /api/execute", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "DELETE",
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toContain("POST");
  });

  it("enforces 256KB webhook body limit even when Content-Length header is omitted", async () => {
    const mock = createMockDb();
    const largePayload = "a".repeat(256 * 1024 + 10);
    const req = new Request("https://shadowflow.work/webhook/wf_1", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: largePayload,
    });
    expect(req.headers.get("content-length")).toBeNull();

    const res = await worker.fetch(req, createEnv(mock.db));
    expect(res.status).toBe(413);
  });

  it("rejects malformed JSON on POST /webhook/:id with HTTP 400", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid JSON webhook payload");
  });

  it("enforces auth/ownership on GET /api/workflows/:id/runs and returns parsed logs for owner", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const ownerSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const owner = (await ownerSignup.json()) as { user: { id: string }; token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const other = (await otherSignup.json()) as { token: string };

    mock.workflows.set("wf_1", {
      id: "wf_1",
      user_id: owner.user.id,
      name: "Webhook Pipeline",
      description: "",
      nodes: "[]",
      edges: "[]",
      settings: "{}",
      is_active: 1,
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:00:00.000Z",
    });

    await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: "alice" }),
      }),
      env
    );

    const unauthRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_1/runs"),
      env
    );
    expect(unauthRes.status).toBe(401);

    const otherRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_1/runs", {
        headers: { Authorization: `Bearer ${other.token}` },
      }),
      env
    );
    expect(otherRes.status).toBe(404);

    const ownerRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_1/runs", {
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(ownerRes.status).toBe(200);
    const runsBody = (await ownerRes.json()) as { count: number; runs: Array<{ logs: unknown[] }> };
    expect(runsBody.count).toBe(1);
    expect(runsBody.runs[0].logs).toEqual([{ lead: "alice" }]);
  });

  it("gracefully recovers from malformed workflow JSON columns in GET /api/workflows", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "corrupt-wf@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const { user, token } = (await signupRes.json()) as { user: { id: string }; token: string };

    mock.workflows.set("wf_corrupt", {
      id: "wf_corrupt",
      user_id: user.id,
      name: "Corrupt Row",
      description: "",
      nodes: "{not-json",
      edges: "[broken",
      settings: "oops",
      is_active: 1,
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:00:00.000Z",
    });

    const listRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(listRes.status).toBe(200);
    const body = (await listRes.json()) as {
      workflows: Array<{ id: string; nodes: unknown[]; edges: unknown[]; settings: Record<string, unknown> }>;
    };
    expect(body.workflows).toHaveLength(1);
    expect(body.workflows[0].nodes).toEqual([]);
    expect(body.workflows[0].edges).toEqual([]);
    expect(body.workflows[0].settings).toEqual({});
  });

  it("executes a branching DAG via POST /api/execute with topological order and branch skipping", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { amount: 250, customer: "Acme" },
          nodes: [
            { id: "n1", type: "webhook", label: "Inbound Webhook" },
            {
              id: "n2",
              type: "transform",
              label: "Enrich Summary",
              config: { fields: { summary: "Order from {{customer}}" } },
            },
            {
              id: "n3",
              type: "if-else",
              label: "Amount > 100?",
              config: { field: "amount", operator: "gt", value: 100 },
            },
            { id: "n4_true", type: "slack", label: "VIP Slack Alert" },
            { id: "n5_false", type: "email", label: "Standard Email" },
          ],
          edges: [
            { source: "n1", target: "n2" },
            { source: "n2", target: "n3" },
            { source: "n3", target: "n4_true", sourceHandle: "output_0" },
            { source: "n3", target: "n5_false", sourceHandle: "output_1" },
          ],
        }),
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      success: boolean;
      executionOrder: string[];
      stepsExecuted: number;
      stepTraces: Array<{ nodeId: string; status: string; output: unknown }>;
    };
    expect(data.success).toBe(true);
    expect(data.executionOrder.slice(0, 3)).toEqual(["n1", "n2", "n3"]);
    expect(data.stepsExecuted).toBe(4);

    const transformTrace = data.stepTraces.find((t) => t.nodeId === "n2");
    expect((transformTrace?.output as { summary?: string })?.summary).toBe("Order from Acme");
    expect(data.stepTraces.find((t) => t.nodeId === "n4_true")?.status).toBe("completed");
    expect(data.stepTraces.find((t) => t.nodeId === "n5_false")?.status).toBe("skipped");
  });

  it("detects cyclic DAGs on POST /api/execute and returns HTTP 400 with cycleNodes", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "n1", type: "transform", label: "Step 1" },
            { id: "n2", type: "transform", label: "Step 2" },
          ],
          edges: [
            { source: "n1", target: "n2" },
            { source: "n2", target: "n1" },
          ],
        }),
      }),
      createEnv(mock.db)
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { success: boolean; error: string; cycleNodes: string[] };
    expect(data.success).toBe(false);
    expect(data.error).toContain("cycle");
    expect(data.cycleNodes).toEqual(["n1", "n2"]);
  });

  it("enforces auth and ownership on POST /api/workflows/:id/execute and persists runs", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const ownerSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "exec-owner@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const owner = (await ownerSignup.json()) as { user: { id: string }; token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "exec-other@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const other = (await otherSignup.json()) as { token: string };

    mock.workflows.set("wf_exec", {
      id: "wf_exec",
      user_id: owner.user.id,
      name: "Persisted Order Pipeline",
      description: "",
      nodes: JSON.stringify([
        { id: "start", data: { flowType: "webhook", label: "Start" } },
        { id: "end", data: { flowType: "transform", label: "Finish", config: { fields: { done: true } } } },
      ]),
      edges: JSON.stringify([{ source: "start", target: "end" }]),
      settings: "{}",
      is_active: 1,
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:00:00.000Z",
    });

    const unauthRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_exec/execute", { method: "POST" }),
      env
    );
    expect(unauthRes.status).toBe(401);

    const forbiddenRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_exec/execute", {
        method: "POST",
        headers: { Authorization: `Bearer ${other.token}` },
      }),
      env
    );
    expect(forbiddenRes.status).toBe(404);

    const execRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_exec/execute", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${owner.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: { orderId: 42 } }),
      }),
      env
    );
    expect(execRes.status).toBe(200);
    const execBody = (await execRes.json()) as {
      success: boolean;
      stepsExecuted: number;
      output: { orderId: number; done: boolean };
    };
    expect(execBody.success).toBe(true);
    expect(execBody.stepsExecuted).toBe(2);
    expect(execBody.output).toEqual({ orderId: 42, done: true });

    const runsRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_exec/runs", {
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(runsRes.status).toBe(200);
    const runsBody = (await runsRes.json()) as { count: number; runs: Array<{ status: string; logs: unknown[] }> };
    expect(runsBody.count).toBe(1);
    expect(runsBody.runs[0].status).toBe("success");
    expect(runsBody.runs[0].logs).toHaveLength(2);
  });

  it("exposes GET and HEAD /api/backend/tools manifest for Gemma 4 front-end orchestration", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const getRes = await worker.fetch(
      new Request("https://shadowflow.work/api/backend/tools"),
      env
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Content-Type")).toContain("application/json");
    const manifest = (await getRes.json()) as {
      architecture: { frontend: string; backend: string };
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.architecture.frontend).toContain("gemma4");
    expect(manifest.architecture.backend).toContain("shadowflow-worker");
    expect(manifest.tools.map((t) => t.function.name)).toContain("execute_dag");

    const headRes = await worker.fetch(
      new Request("https://shadowflow.work/api/backend/tools", { method: "HEAD" }),
      env
    );
    expect(headRes.status).toBe(200);
    expect(headRes.headers.get("Content-Type")).toContain("application/json");
    expect(await headRes.text()).toBe("");
    expect(manifest.tools.map((t) => t.function.name)).toEqual(
      expect.arrayContaining(["update_workflow", "delete_workflow", "trigger_webhook"])
    );
  });

  it("emits Strict-Transport-Security and API Content-Security-Policy on JSON responses", async () => {
    const mock = createMockDb();
    const res = await worker.fetch(new Request("https://shadowflow.work/api/health"), createEnv(mock.db));
    expect(res.status).toBe(200);
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains; preload");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("rejects malformed, wrong-typed, oversized, and multi-segment requests on workflow CRUD", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "crud-hardened@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const badJsonPost = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{bad json",
      }),
      env
    );
    expect(badJsonPost.status).toBe(400);

    const badNodesPost = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bad Nodes", nodes: "not-an-array" }),
      }),
      env
    );
    expect(badNodesPost.status).toBe(400);

    const largeBody = JSON.stringify({ name: "Huge", description: "x".repeat(520 * 1024) });
    const hugePost = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: largeBody,
      }),
      env
    );
    expect(hugePost.status).toBe(413);

    const extraSegPut = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_1/extra", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No" }),
      }),
      env
    );
    expect(extraSegPut.status).toBe(404);

    const extraSegDel = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_1/extra", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(extraSegDel.status).toBe(404);

    const extraCredDel = await worker.fetch(
      new Request("https://shadowflow.work/api/credentials/crd_1/extra", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(extraCredDel.status).toBe(404);
  });

  it("preserves fields on partial PUT /api/workflows/:id and cascades child rows on DELETE", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "crud-owner@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const createRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Lead Sync",
          description: "Initial flow",
          nodes: [{ id: "n1", type: "webhook", label: "Start" }],
          edges: [],
          settings: { webhookSecret: "sec_123" },
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { workflow: { id: string } };
    const wfId = created.workflow.id;

    const putRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${wfId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      }),
      env
    );
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as { success: boolean; version: number };
    expect(putBody.version).toBe(2);

    const stored = mock.workflows.get(wfId)!;
    expect(stored.name).toBe("Lead Sync");
    expect(stored.is_active).toBe(0);
    expect(JSON.parse(stored.nodes)).toHaveLength(1);
    expect(JSON.parse(stored.settings)).toEqual({ webhookSecret: "sec_123" });
    expect(mock.workflowVersions.filter((v) => v.workflow_id === wfId)).toHaveLength(2);

    mock.workflowRuns.push({
      id: "exec_child",
      workflow_id: wfId,
      status: "success",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      error_log: null,
      logs: "[]",
    });

    const delRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${wfId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(delRes.status).toBe(200);
    expect(mock.workflows.has(wfId)).toBe(false);
    expect(mock.workflowVersions.filter((v) => v.workflow_id === wfId)).toHaveLength(0);
    expect(mock.workflowRuns.filter((r) => r.workflow_id === wfId)).toHaveLength(0);
  });

  it("executes active DAG workflows on POST /webhook/:id and rejects inactive ones with 409", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    mock.workflows.set("wf_hook_dag", {
      id: "wf_hook_dag",
      user_id: "u_1",
      name: "Webhook Transform",
      description: "",
      nodes: JSON.stringify([
        { id: "in", data: { flowType: "webhook", label: "Webhook In" } },
        { id: "tr", data: { flowType: "transform", label: "Tag", config: { fields: { source: "webhook" } } } },
      ]),
      edges: JSON.stringify([{ source: "in", target: "tr" }]),
      settings: "{}",
      is_active: 1,
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:00:00.000Z",
    });

    const activeRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_hook_dag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "signup" }),
      }),
      env
    );
    expect(activeRes.status).toBe(202);
    const activeBody = (await activeRes.json()) as {
      executedDag: boolean;
      stepsExecuted: number;
      output: { event: string; source: string };
    };
    expect(activeBody.executedDag).toBe(true);
    expect(activeBody.stepsExecuted).toBe(2);
    expect(activeBody.output).toEqual({ event: "signup", source: "webhook" });
    expect(mock.workflowRuns).toHaveLength(1);
    expect(JSON.parse(mock.workflowRuns[0].logs)).toHaveLength(2);

    mock.workflows.get("wf_hook_dag")!.is_active = 0;
    const inactiveRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_hook_dag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "signup" }),
      }),
      env
    );
    expect(inactiveRes.status).toBe(409);

    const extraPathRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_hook_dag/extra", { method: "POST" }),
      env
    );
    expect(extraPathRes.status).toBe(404);
  });

  it("verifies X-ShadowFlow-Signature HMAC-SHA256 and X-ShadowFlow-Timestamp replay window on POST /webhook/:id", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);
    const secret = "whsec_super_secret_hmac_key_32_chars";

    mock.workflows.set("wf_signed", {
      id: "wf_signed",
      user_id: "u_1",
      name: "Signed Webhook",
      description: "",
      nodes: JSON.stringify([
        { id: "in", data: { flowType: "webhook", label: "In" } },
        { id: "out", data: { flowType: "transform", label: "Out", config: { fields: { verified: true } } } },
      ]),
      edges: JSON.stringify([{ source: "in", target: "out" }]),
      settings: JSON.stringify({ webhookSecret: secret, requireTimestamp: true, maxSkewSeconds: 300 }),
      is_active: 1,
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:00:00.000Z",
    });

    const rawPayload = JSON.stringify({ order: "ord_99" });
    const nowTs = Math.floor(Date.now() / 1000).toString();
    const validSig = await signWebhookHmac(secret, `${nowTs}.${rawPayload}`);

    const missingSigRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_signed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawPayload,
      }),
      env
    );
    expect(missingSigRes.status).toBe(401);

    const badSigRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_signed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ShadowFlow-Timestamp": nowTs,
          "X-ShadowFlow-Signature": "sha256=" + "0".repeat(64),
        },
        body: rawPayload,
      }),
      env
    );
    expect(badSigRes.status).toBe(401);

    const oldTs = (Math.floor(Date.now() / 1000) - 900).toString();
    const staleSig = await signWebhookHmac(secret, `${oldTs}.${rawPayload}`);
    const expiredRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_signed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ShadowFlow-Timestamp": oldTs,
          "X-ShadowFlow-Signature": `sha256=${staleSig}`,
        },
        body: rawPayload,
      }),
      env
    );
    expect(expiredRes.status).toBe(401);

    const okRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_signed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ShadowFlow-Timestamp": nowTs,
          "X-ShadowFlow-Signature": `sha256=${validSig}`,
        },
        body: rawPayload,
      }),
      env
    );
    expect(okRes.status).toBe(202);
    const okBody = (await okRes.json()) as { executedDag: boolean; output: { order: string; verified: boolean } };
    expect(okBody.executedDag).toBe(true);
    expect(okBody.output).toEqual({ order: "ord_99", verified: true });
  });

  it("rejects malformed, wrong-typed, and oversized payloads cleanly across auth endpoints", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const badSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      }),
      env
    );
    expect(badSignup.status).toBe(400);

    const typedSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ["arr"], password: 123 }),
      }),
      env
    );
    expect(typedSignup.status).toBe(400);

    const bigLogin = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@example.com", password: "x".repeat(20 * 1024) }),
      }),
      env
    );
    expect(bigLogin.status).toBe(413);

    const badLogin = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
      env
    );
    expect(badLogin.status).toBe(400);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tfa-bound@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const badTfa = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/tfa/verify-and-enable", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{broken",
      }),
      env
    );
    expect(badTfa.status).toBe(400);
  });

  it("supports single-run lookup GET /api/workflows/:id/runs/:runId with ownership and strict paths", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const ownerSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "run-owner@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const owner = (await ownerSignup.json()) as { user: { id: string }; token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "run-other@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const other = (await otherSignup.json()) as { token: string };

    mock.workflows.set("wf_single_run", {
      id: "wf_single_run",
      user_id: owner.user.id,
      name: "Run Detail Test",
      description: "",
      nodes: "[]",
      edges: "[]",
      settings: "{}",
      is_active: 1,
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:00:00.000Z",
    });

    mock.workflowRuns.push({
      id: "run_101",
      workflow_id: "wf_single_run",
      status: "success",
      started_at: "2026-11-19T01:00:00.000Z",
      finished_at: "2026-11-19T01:00:01.000Z",
      error_log: null,
      logs: JSON.stringify([{ nodeId: "n1", status: "completed" }]),
    });

    const okRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_single_run/runs/run_101", {
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(okRes.status).toBe(200);
    const okBody = (await okRes.json()) as { run: { id: string; logs: unknown[] } };
    expect(okBody.run.id).toBe("run_101");
    expect(okBody.run.logs).toEqual([{ nodeId: "n1", status: "completed" }]);

    const missingRun = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_single_run/runs/run_missing", {
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(missingRun.status).toBe(404);

    const otherRun = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_single_run/runs/run_101", {
        headers: { Authorization: `Bearer ${other.token}` },
      }),
      env
    );
    expect(otherRun.status).toBe(404);

    const extraVer = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_single_run/versions/extra", {
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(extraVer.status).toBe(404);

    const extraRun = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/wf_single_run/runs/run_101/extra", {
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(extraRun.status).toBe(404);

    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    const manifest = (await manifestRes.json()) as { tools: Array<{ function: { name: string } }> };
    expect(manifest.tools.map((t) => t.function.name)).toContain("get_workflow_run");
  });

  it("rejects bad AI payloads on /api/copilot/chat and /api/generate-flow without burning daily quota", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const badChatJson = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      }),
      env
    );
    expect(badChatJson.status).toBe(400);

    const emptyChat = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
      env
    );
    expect(emptyChat.status).toBe(400);

    const badMsgItem = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: 42 }] }),
      }),
      env
    );
    expect(badMsgItem.status).toBe(400);

    const bigChat = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "x".repeat(135 * 1024) }),
      }),
      env
    );
    expect(bigChat.status).toBe(413);

    const badGenFlow = await worker.fetch(
      new Request("https://shadowflow.work/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "   " }),
      }),
      env
    );
    expect(badGenFlow.status).toBe(400);

    const bigGenFlow = await worker.fetch(
      new Request("https://shadowflow.work/api/generate-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "x".repeat(70 * 1024) }),
      }),
      env
    );
    expect(bigGenFlow.status).toBe(413);

    expect(mock.aiUsageWriteCount()).toBe(0);
  });

  it("batches upserts in POST /api/copilot/memory and rejects batches over 200 nodes", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "mem-owner@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const badJsonMem = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/memory", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{bad",
      }),
      env
    );
    expect(badJsonMem.status).toBe(400);

    const tooMany = Array.from({ length: 201 }, (_, i) => ({ id: `m_${i}`, label: `Node ${i}` }));
    const overLimit = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/memory", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: tooMany }),
      }),
      env
    );
    expect(overLimit.status).toBe(400);

    const batchesBefore = mock.batchCallCount();
    const okMem = await worker.fetch(
      new Request("https://shadowflow.work/api/copilot/memory", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "n_1", type: "service", label: "Stripe", properties: { region: "us" } },
            { id: "n_2", type: "entity", label: "Customer" },
          ],
        }),
      }),
      env
    );
    expect(okMem.status).toBe(200);
    const okMemBody = (await okMem.json()) as { success: boolean; count: number };
    expect(okMemBody.count).toBe(2);
    expect(mock.batchCallCount() - batchesBefore).toBe(1);
    expect(mock.graphMemoryNodes).toHaveLength(2);
  });

  it("rejects malformed JSON and invalid recipient fields on POST /api/email/send", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "email-sender@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const { user, token } = (await signupRes.json()) as { user: { id: string }; token: string };
    mock.users.get(user.id)!.email_verified = 1;

    const badJson = await worker.fetch(
      new Request("https://shadowflow.work/api/email/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{bad",
      }),
      env
    );
    expect(badJson.status).toBe(400);

    const badRecipients = await worker.fetch(
      new Request("https://shadowflow.work/api/email/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: ["ok@example.com", 42], subject: "Hi", text: "Hello" }),
      }),
      env
    );
    expect(badRecipients.status).toBe(400);

    const emptySubject = await worker.fetch(
      new Request("https://shadowflow.work/api/email/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: "ok@example.com", subject: "   ", text: "Hello" }),
      }),
      env
    );
    expect(emptySubject.status).toBe(400);
  });

  it("blocks prototype-chain dot paths and unsafe keys in DAG transform mapping", async () => {
    const mock = createMockDb();
    const rawBody = JSON.stringify({
      nodes: [
        {
          id: "tr",
          type: "transform",
          config: {
            fields: {
              protoLeak: "{{__proto__.toString}}",
              ctorLeak: "{{constructor.name}}",
              ownName: "{{user.name}}",
            },
          },
        },
      ],
      edges: [],
      input: { user: { name: "Ada" } },
    }).replace(
      '"ownName"',
      '"__proto__":{"polluted":"yes"},"constructor":"bad","ownName"'
    );

    const res = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody,
      }),
      createEnv(mock.db)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      output: Record<string, unknown>;
    };
    expect(body.output.protoLeak).toBe("");
    expect(body.output.ctorLeak).toBe("");
    expect(body.output.ownName).toBe("Ada");
    expect(Object.prototype.hasOwnProperty.call(body.output, "constructor")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("evaluates extended condition operators and switch/router multi-branch DAG edges", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const makeSwitchPayload = (tier: string, email: string) => ({
      nodes: [
        { id: "in", type: "webhook" },
        {
          id: "chk",
          type: "condition",
          config: { field: "email", operator: "ends_with", value: "@enterprise.io" },
        },
        {
          id: "sw",
          type: "switch",
          config: {
            field: "data.tier",
            cases: [
              { value: "vip,platinum", operator: "in", handle: "vip_route" },
              { value: "pro", operator: "eq" },
            ],
          },
        },
        { id: "vip", type: "transform", config: { fields: { routed: "vip" } } },
        { id: "pro", type: "transform", config: { fields: { routed: "pro" } } },
        { id: "def", type: "transform", config: { fields: { routed: "default" } } },
      ],
      edges: [
        { source: "in", target: "chk" },
        { source: "chk", target: "sw", sourceHandle: "true" },
        { source: "sw", target: "vip", sourceHandle: "vip_route" },
        { source: "sw", target: "pro", sourceHandle: "case_1" },
        { source: "sw", target: "def", sourceHandle: "default" },
      ],
      input: { tier, email },
    });

    const vipRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSwitchPayload("platinum", "alice@enterprise.io")),
      }),
      env
    );
    expect(vipRes.status).toBe(200);
    const vipBody = (await vipRes.json()) as {
      stepTraces: Array<{ nodeId: string; status: string }>;
      output: { routed: string };
    };
    expect(vipBody.output.routed).toBe("vip");
    expect(vipBody.stepTraces.find((s) => s.nodeId === "pro")?.status).toBe("skipped");
    expect(vipBody.stepTraces.find((s) => s.nodeId === "def")?.status).toBe("skipped");

    const defRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSwitchPayload("free", "bob@enterprise.io")),
      }),
      env
    );
    expect(defRes.status).toBe(200);
    const defBody = (await defRes.json()) as {
      stepTraces: Array<{ nodeId: string; status: string }>;
      output: { routed: string };
    };
    expect(defBody.output.routed).toBe("default");
    expect(defBody.stepTraces.find((s) => s.nodeId === "vip")?.status).toBe("skipped");

    const opsRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "c1", type: "condition", config: { field: "email", operator: "starts_with", value: "vip_" } },
            { id: "c2", type: "condition", config: { field: "notes", operator: "not_contains", value: "spam" } },
            { id: "c3", type: "condition", config: { field: "deletedAt", operator: "not_exists" } },
          ],
          edges: [],
          input: { email: "vip_lead@acme.io", notes: "verified", deletedAt: null },
        }),
      }),
      env
    );
    expect(opsRes.status).toBe(200);
    const opsBody = (await opsRes.json()) as { stepTraces: Array<{ nodeId: string; output: { matched: boolean } }> };
    expect(opsBody.stepTraces.map((s) => s.output.matched)).toEqual([true, true, true]);
  });

  it("supports json-parse and pick DAG nodes and rejects non-object JSON on POST /api/execute", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const nullRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "null",
      }),
      env
    );
    expect(nullRes.status).toBe(400);

    const arrRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }),
      env
    );
    expect(arrRes.status).toBe(400);

    const dagRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "parse", type: "json-parse", config: { field: "raw", outputField: "meta" } },
            { id: "pick", type: "pick", config: { keys: ["id", "meta.plan", "secret"] } },
          ],
          edges: [{ source: "parse", target: "pick" }],
          input: { id: "u_7", raw: '{"plan":"scale","region":"eu"}', ignored: "drop" },
        }),
      }),
      env
    );
    expect(dagRes.status).toBe(200);
    const dagBody = (await dagRes.json()) as { output: Record<string, unknown> };
    expect(dagBody.output).toEqual({ id: "u_7", plan: "scale" });
  });

  it("restores saved workflow snapshots via POST /api/workflows/:id/versions/:versionId/restore", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const ownerSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "restore-owner@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const owner = (await ownerSignup.json()) as { token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "restore-other@example.com", password: "strong-password-123" }),
      }),
      env
    );
    const other = (await otherSignup.json()) as { token: string };

    const createRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${owner.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Versioned Flow",
          nodes: [{ id: "v1_node", type: "webhook" }],
          edges: [],
          settings: { env: "v1" },
        }),
      }),
      env
    );
    const created = (await createRes.json()) as { workflow: { id: string } };
    const wfId = created.workflow.id;
    const v1Id = mock.workflowVersions.find((v) => v.workflow_id === wfId && v.version === 1)!.id;

    await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${wfId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${owner.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: [{ id: "v2_node", type: "transform" }], settings: { env: "v2" } }),
      }),
      env
    );

    const unauthRestore = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${wfId}/versions/${v1Id}/restore`, { method: "POST" }),
      env
    );
    expect(unauthRestore.status).toBe(401);

    const otherRestore = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${wfId}/versions/${v1Id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${other.token}` },
      }),
      env
    );
    expect(otherRestore.status).toBe(404);

    const batchesBefore = mock.batchCallCount();
    const okRestore = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${wfId}/versions/${v1Id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${owner.token}` },
      }),
      env
    );
    expect(okRestore.status).toBe(200);
    const restoreBody = (await okRestore.json()) as {
      success: boolean;
      restoredFromVersion: number;
      newVersion: number;
    };
    expect(restoreBody.restoredFromVersion).toBe(1);
    expect(restoreBody.newVersion).toBe(3);
    expect(mock.batchCallCount() - batchesBefore).toBe(1);
    expect(JSON.parse(mock.workflows.get(wfId)!.nodes)).toEqual([{ id: "v1_node", type: "webhook" }]);
    expect(JSON.parse(mock.workflows.get(wfId)!.settings)).toEqual({ env: "v1" });

    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    const manifest = (await manifestRes.json()) as { tools: Array<{ function: { name: string } }> };
    expect(manifest.tools.map((t) => t.function.name)).toContain("restore_workflow_version");
  });

  it("allows webhook HMAC headers in CORS preflight and sets HSTS on IndexNow key route", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const preflightRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/wf_1", {
        method: "OPTIONS",
        headers: { Origin: "https://shadowflow.work" },
      }),
      env
    );
    expect(preflightRes.status).toBe(204);
    const allowHeaders = preflightRes.headers.get("Access-Control-Allow-Headers") || "";
    expect(allowHeaders).toContain("X-ShadowFlow-Signature");
    expect(allowHeaders).toContain("X-ShadowFlow-Timestamp");

    const keyRes = await worker.fetch(
      new Request("https://shadowflow.work/c2188ff6e637482ea4bc837699131a98.txt"),
      env
    );
    expect(keyRes.status).toBe(200);
    expect(keyRes.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains; preload");
  });

  it("exports, imports, and guards workflows against SSRF in HTTP DAG nodes", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "porter@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other-porter@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token: otherToken } = (await otherSignup.json()) as { token: string };

    // 1. Create a workflow to export
    const createRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Exportable Pipeline",
          description: "Pipeline ready for portable backup",
          nodes: [{ id: "n1", type: "trigger", label: "Start" }],
          edges: [],
          settings: { mode: "active" },
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const { workflow } = (await createRes.json()) as { workflow: { id: string } };

    // 2. Export tests
    const unauthExport = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/export`),
      env
    );
    expect(unauthExport.status).toBe(401);

    const otherExport = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/export`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      }),
      env
    );
    expect(otherExport.status).toBe(404);

    const okExport = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(okExport.status).toBe(200);
    expect(okExport.headers.get("Content-Disposition")).toContain(`workflow-${workflow.id}.json`);
    const exportData = (await okExport.json()) as {
      format: string;
      schemaVersion: number;
      workflow: { name: string; nodes: unknown[]; settings: Record<string, unknown> };
    };
    expect(exportData.format).toBe("shadowflow-workflow");
    expect(exportData.schemaVersion).toBe(1);
    expect(exportData.workflow.name).toBe("Exportable Pipeline");
    expect(exportData.workflow.settings).toEqual({ mode: "active" });

    // 3. Import tests
    const unauthImport = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      }),
      env
    );
    expect(unauthImport.status).toBe(401);

    const badImport = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Broken", nodes: "not-an-array", edges: [] }),
      }),
      env
    );
    expect(badImport.status).toBe(400);

    const okImport = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      }),
      env
    );
    expect(okImport.status).toBe(201);
    const importedBody = (await okImport.json()) as { success: boolean; workflow: { id: string; name: string } };
    expect(importedBody.success).toBe(true);
    expect(importedBody.workflow.id).not.toBe(workflow.id);
    expect(importedBody.workflow.name).toBe("Exportable Pipeline");

    // 4. SSRF protection in HTTP DAG nodes
    const ssrfTargets = [
      "http://127.0.0.1:8080/admin",
      "http://localhost:3000/keys",
      "http://169.254.169.254/latest/meta-data",
      "http://metadata.google.internal/computeMetadata/v1",
      "http://10.0.0.1:9000",
      "http://192.168.1.1/router",
      "http://172.16.0.5:8080",
      "ftp://malicious.org/file",
    ];

    for (const targetUrl of ssrfTargets) {
      const ssrfDag = await worker.fetch(
        new Request("https://shadowflow.work/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: [
              {
                id: "http_node",
                type: "http-request",
                config: { url: targetUrl, method: "GET" },
              },
            ],
            edges: [],
            input: {},
          }),
        }),
        env
      );
      expect(ssrfDag.status).toBe(200);
      const ssrfBody = (await ssrfDag.json()) as { output: { ok: boolean; blocked?: boolean; error?: string } };
      expect(ssrfBody.output.ok).toBe(false);
      expect(ssrfBody.output.blocked).toBe(true);
      expect(ssrfBody.output.error).toContain("SSRF_BLOCKED");
    }

    // 5. Manifest inspection
    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    const manifest = (await manifestRes.json()) as {
      endpoints: Record<string, unknown>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.endpoints).toHaveProperty("export_workflow");
    expect(manifest.endpoints).toHaveProperty("import_workflow");
    expect(manifest.tools.map((t) => t.function.name)).toContain("export_workflow");
    expect(manifest.tools.map((t) => t.function.name)).toContain("import_workflow");
  });

  it("duplicates workflows and executes crypto, hash, and encoding DAG nodes with timeout guard", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "duplicator@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other-duplicator@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token: otherToken } = (await otherSignup.json()) as { token: string };

    // 1. Create source workflow
    const createRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Original Pipeline",
          description: "Base automation flow",
          nodes: [{ id: "n1", type: "trigger" }, { id: "n2", type: "transform" }],
          edges: [{ source: "n1", target: "n2" }],
          settings: { env: "prod" },
          is_active: true,
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const { workflow: originalWf } = (await createRes.json()) as { workflow: { id: string } };

    // 2. Duplicate tests: auth & permissions
    const unauthDup = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${originalWf.id}/duplicate`, {
        method: "POST",
      }),
      env
    );
    expect(unauthDup.status).toBe(401);

    const otherDup = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${originalWf.id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${otherToken}` },
      }),
      env
    );
    expect(otherDup.status).toBe(404);

    // 3. Successful duplicate with default copy name
    const okDupDefault = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${originalWf.id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(okDupDefault.status).toBe(201);
    const dupBodyDefault = (await okDupDefault.json()) as {
      success: boolean;
      workflow: { id: string; name: string; is_active: boolean };
    };
    expect(dupBodyDefault.success).toBe(true);
    expect(dupBodyDefault.workflow.id).not.toBe(originalWf.id);
    expect(dupBodyDefault.workflow.name).toBe("Original Pipeline (Copy)");
    expect(dupBodyDefault.workflow.is_active).toBe(false);

    // 4. Successful duplicate with custom name
    const okDupCustom = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${originalWf.id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Staging Pipeline Clone" }),
      }),
      env
    );
    expect(okDupCustom.status).toBe(201);
    const dupBodyCustom = (await okDupCustom.json()) as {
      success: boolean;
      workflow: { id: string; name: string };
    };
    expect(dupBodyCustom.workflow.name).toBe("Staging Pipeline Clone");

    // 5. Crypto, hash, hmac, base64, and uuid DAG node execution
    const cryptoDag = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            {
              id: "hash_step",
              type: "hash",
              config: { field: "rawText", operation: "sha256", encoding: "hex", outputField: "hashedHex" },
            },
            {
              id: "b64_step",
              type: "base64",
              config: { field: "rawText", operation: "base64_encode", outputField: "encodedB64" },
            },
            {
              id: "uuid_step",
              type: "uuid",
              config: { outputField: "genId" },
            },
            {
              id: "hmac_step",
              type: "hmac",
              config: { field: "rawText", secret: "test-secret", encoding: "hex", outputField: "sigHex" },
            },
          ],
          edges: [
            { source: "hash_step", target: "b64_step" },
            { source: "b64_step", target: "uuid_step" },
            { source: "uuid_step", target: "hmac_step" },
          ],
          input: { rawText: "shadowflow-test-payload" },
        }),
      }),
      env
    );
    expect(cryptoDag.status).toBe(200);
    const cryptoBody = (await cryptoDag.json()) as {
      success: boolean;
      output: {
        rawText: string;
        hashedHex: string;
        encodedB64: string;
        genId: string;
        sigHex: string;
      };
    };
    expect(cryptoBody.success).toBe(true);
    expect(typeof cryptoBody.output.hashedHex).toBe("string");
    expect(cryptoBody.output.hashedHex.length).toBe(64); // SHA-256 hex is 64 chars
    expect(cryptoBody.output.encodedB64).toBe(btoa("shadowflow-test-payload"));
    expect(cryptoBody.output.genId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(typeof cryptoBody.output.sigHex).toBe("string");
    expect(cryptoBody.output.sigHex.length).toBe(64); // HMAC-SHA256 hex is 64 chars

    // 6. Base64 decode node
    const b64DecodeDag = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            {
              id: "dec_step",
              type: "decode",
              config: { field: "b64", operation: "base64_decode", outputField: "decoded" },
            },
          ],
          edges: [],
          input: { b64: btoa("hello-world") },
        }),
      }),
      env
    );
    expect(b64DecodeDag.status).toBe(200);
    const b64Body = (await b64DecodeDag.json()) as { output: { decoded: string } };
    expect(b64Body.output.decoded).toBe("hello-world");

    // 7. Manifest check for duplicate_workflow
    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    const manifest = (await manifestRes.json()) as {
      endpoints: Record<string, unknown>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.endpoints).toHaveProperty("duplicate_workflow");
    expect(manifest.tools.map((t) => t.function.name)).toContain("duplicate_workflow");
  });

  it("validates workflow graph topologies, cyclic edges, orphan nodes, and SSRF configurations", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "validator@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    // 1. Valid linear topology
    const validRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "root_trigger", type: "trigger" },
            { id: "transform_step", type: "transform" },
            { id: "term_step", type: "condition", config: { field: "status", operator: "eq", value: "ok" } },
          ],
          edges: [
            { source: "root_trigger", target: "transform_step" },
            { source: "transform_step", target: "term_step" },
          ],
        }),
      }),
      env
    );
    expect(validRes.status).toBe(200);
    const validBody = (await validRes.json()) as {
      valid: boolean;
      hasCycles: boolean;
      errors: string[];
      stats: { nodeCount: number; edgeCount: number; rootNodeIds: string[]; terminalNodeIds: string[] };
    };
    expect(validBody.valid).toBe(true);
    expect(validBody.hasCycles).toBe(false);
    expect(validBody.errors).toEqual([]);
    expect(validBody.stats.nodeCount).toBe(3);
    expect(validBody.stats.rootNodeIds).toEqual(["root_trigger"]);
    expect(validBody.stats.terminalNodeIds).toEqual(["term_step"]);

    // 2. Cyclic graph detection
    const cycleRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "loop_a", type: "transform" },
            { id: "loop_b", type: "transform" },
          ],
          edges: [
            { source: "loop_a", target: "loop_b" },
            { source: "loop_b", target: "loop_a" },
          ],
        }),
      }),
      env
    );
    expect(cycleRes.status).toBe(200);
    const cycleBody = (await cycleRes.json()) as { valid: boolean; hasCycles: boolean; cycleNodes: string[] };
    expect(cycleBody.valid).toBe(false);
    expect(cycleBody.hasCycles).toBe(true);
    expect(cycleBody.cycleNodes).toContain("loop_a");
    expect(cycleBody.cycleNodes).toContain("loop_b");

    // 3. Dangling edges and orphan nodes
    const danglingRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "node_1", type: "trigger" },
            { id: "orphan_node", type: "manual" },
          ],
          edges: [{ source: "node_1", target: "non_existent_node" }],
        }),
      }),
      env
    );
    expect(danglingRes.status).toBe(200);
    const danglingBody = (await danglingRes.json()) as {
      valid: boolean;
      errors: string[];
      warnings: string[];
      orphanNodes: string[];
      danglingEdges: Array<{ target: string }>;
    };
    expect(danglingBody.valid).toBe(false);
    expect(danglingBody.orphanNodes).toContain("orphan_node");
    expect(danglingBody.danglingEdges[0].target).toBe("non_existent_node");

    // 4. SSRF detection during validation
    const ssrfValidationRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "bad_http", type: "http-request", config: { url: "http://127.0.0.1:8080/admin" } },
          ],
          edges: [],
        }),
      }),
      env
    );
    expect(ssrfValidationRes.status).toBe(200);
    const ssrfValidationBody = (await ssrfValidationRes.json()) as { valid: boolean; errors: string[] };
    expect(ssrfValidationBody.valid).toBe(false);
    expect(ssrfValidationBody.errors.some((e) => e.includes("SSRF guard"))).toBe(true);

    // 5. GET /api/workflows/:id/validate on saved workflow
    const saveRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Saved Valid Flow",
          nodes: [{ id: "n1", type: "trigger" }, { id: "n2", type: "merge" }],
          edges: [{ source: "n1", target: "n2" }],
        }),
      }),
      env
    );
    const { workflow: savedWf } = (await saveRes.json()) as { workflow: { id: string } };

    const getValidateRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${savedWf.id}/validate`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(getValidateRes.status).toBe(200);
    const getValidateBody = (await getValidateRes.json()) as { valid: boolean; workflowId: string };
    expect(getValidateBody.valid).toBe(true);
    expect(getValidateBody.workflowId).toBe(savedWf.id);

    // 6. Manifest inspection
    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    const manifest = (await manifestRes.json()) as {
      endpoints: Record<string, unknown>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.endpoints).toHaveProperty("validate_workflow");
    expect(manifest.tools.map((t) => t.function.name)).toContain("validate_workflow");
  });

  it("replays previous workflow runs with original or overridden inputs and supports HTTP node retry policy", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "replayer@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };

    const otherSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other-replayer@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token: otherToken } = (await otherSignup.json()) as { token: string };

    // 1. Create a workflow and execute an initial run
    const createRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Replayable Automation",
          nodes: [
            { id: "step_1", type: "transform", config: { fields: { echo: "hello", seq: 1 } } },
          ],
          edges: [],
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const { workflow } = (await createRes.json()) as { workflow: { id: string } };

    const execRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/execute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { orderId: "ord_101" } }),
      }),
      env
    );
    expect(execRes.status).toBe(200);
    const { executionId } = (await execRes.json()) as { executionId: string };

    // 2. Replay auth and ownership guards
    const unauthReplay = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/runs/${executionId}/replay`, {
        method: "POST",
      }),
      env
    );
    expect(unauthReplay.status).toBe(401);

    const otherReplay = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/runs/${executionId}/replay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${otherToken}` },
      }),
      env
    );
    expect(otherReplay.status).toBe(404);

    const badRunReplay = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/runs/nonexistent_run/replay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(badRunReplay.status).toBe(404);

    // 3. Successful replay with original payload
    const okReplay = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/runs/${executionId}/replay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    );
    expect(okReplay.status).toBe(201);
    const replayBody = (await okReplay.json()) as {
      success: boolean;
      replayedRunId: string;
      originalRunId: string;
      status: string;
    };
    expect(replayBody.success).toBe(true);
    expect(replayBody.originalRunId).toBe(executionId);
    expect(replayBody.replayedRunId).not.toBe(executionId);
    expect(replayBody.status).toBe("success");

    // 4. Successful replay with overridden input
    const okOverrideReplay = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflow.id}/runs/${executionId}/replay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ overrideInput: { orderId: "ord_202_overridden" } }),
      }),
      env
    );
    expect(okOverrideReplay.status).toBe(201);
    const overrideBody = (await okOverrideReplay.json()) as { success: boolean; status: string };
    expect(overrideBody.success).toBe(true);
    expect(overrideBody.status).toBe("success");

    // 5. HTTP node retry policy test
    const retryDagRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            {
              id: "http_retry_step",
              type: "http-request",
              config: {
                url: "https://unreachable.nonexistent-domain-404-500.com/test",
                retry: { maxAttempts: 2, backoffMs: 50 },
              },
            },
          ],
          edges: [],
          input: {},
        }),
      }),
      env
    );
    expect(retryDagRes.status).toBe(200);
    const retryBody = (await retryDagRes.json()) as {
      output: { ok: boolean; attempts: number; error: string };
    };
    expect(retryBody.output.ok).toBe(false);
    expect(retryBody.output.attempts).toBe(2);

    // 6. Manifest inspection
    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    const manifest = (await manifestRes.json()) as {
      endpoints: Record<string, unknown>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.endpoints).toHaveProperty("replay_workflow_run");
    expect(manifest.tools.map((t) => t.function.name)).toContain("replay_workflow_run");
  });

  it("records audit logs across workflow lifecycle and exposes audit log queries and tool definitions", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "auditor@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1. Create a workflow - should record workflow.create in audit_logs
    const createRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: "Audit Test Workflow",
          description: "Workflow for auditing verification",
          nodes: [{ id: "n1", type: "log", config: { message: "step 1" } }],
          edges: [],
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as { workflow: { id: string } };
    const workflowId = createBody.workflow.id;

    // 2. Update the workflow - should record workflow.update in audit_logs
    const updateRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: "Audit Test Workflow Renamed",
          change_summary: "Updated node configurations",
        }),
      }),
      env
    );
    expect(updateRes.status).toBe(200);

    // 3. Query workflow-scoped audit logs: GET /api/workflows/:id/audit-logs
    const wfAuditRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflowId}/audit-logs`),
      env
    );
    expect(wfAuditRes.status).toBe(401);

    const wfAuditAuthRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflowId}/audit-logs`, {
        headers: authHeaders,
      }),
      env
    );
    expect(wfAuditAuthRes.status).toBe(200);
    const wfAuditBody = (await wfAuditAuthRes.json()) as {
      success: boolean;
      workflowId: string;
      count: number;
      logs: Array<{ action: string; resource_type: string; resource_id: string }>;
    };
    expect(wfAuditBody.success).toBe(true);
    expect(wfAuditBody.workflowId).toBe(workflowId);
    expect(wfAuditBody.logs.length).toBeGreaterThanOrEqual(2);
    expect(wfAuditBody.logs.some((l) => l.action === "workflow.create")).toBe(true);
    expect(wfAuditBody.logs.some((l) => l.action === "workflow.update")).toBe(true);

    // 4. Query top-level audit logs: GET /api/audit-logs
    const topAuditRes = await worker.fetch(
      new Request("https://shadowflow.work/api/audit-logs", { headers: authHeaders }),
      env
    );
    expect(topAuditRes.status).toBe(200);
    const topAuditBody = (await topAuditRes.json()) as {
      success: boolean;
      count: number;
      logs: Array<{ action: string; resource_type: string }>;
    };
    expect(topAuditBody.success).toBe(true);
    expect(topAuditBody.count).toBeGreaterThanOrEqual(2);

    // 5. Delete workflow - should record workflow.delete in audit_logs
    const deleteRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${workflowId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
      env
    );
    expect(deleteRes.status).toBe(200);

    const deleteAuditRes = await worker.fetch(
      new Request("https://shadowflow.work/api/audit-logs?action=workflow.delete", {
        headers: authHeaders,
      }),
      env
    );
    expect(deleteAuditRes.status).toBe(200);
    const deleteAuditBody = (await deleteAuditRes.json()) as {
      logs: Array<{ action: string; resource_id: string }>;
    };
    expect(deleteAuditBody.logs.some((l) => l.action === "workflow.delete" && l.resource_id === workflowId)).toBe(true);

    // 6. Verify tools manifest exposure
    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    expect(manifestRes.status).toBe(200);
    const manifest = (await manifestRes.json()) as {
      endpoints: Record<string, unknown>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.endpoints).toHaveProperty("get_audit_logs");
    expect(manifest.endpoints).toHaveProperty("get_workflow_audit_logs");
    const toolNames = manifest.tools.map((t) => t.function.name);
    expect(toolNames).toContain("get_audit_logs");
    expect(toolNames).toContain("get_workflow_audit_logs");
    expect(toolNames.length).toBeGreaterThanOrEqual(18);
  });

  it("profiles DAG execution step latency, cancels workflow runs, and prunes historical audit logs", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    const signupRes = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ops@example.com", password: "secure-password-123" }),
      }),
      env
    );
    const { token } = (await signupRes.json()) as { token: string };
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1. DAG Execution with step duration and metrics profiling
    const dagRes = await worker.fetch(
      new Request("https://shadowflow.work/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "step1", type: "log", config: { message: "Starting pipeline" } },
            { id: "step2", type: "hash", config: { algorithm: "sha256", field: "message" } },
          ],
          edges: [{ source: "step1", target: "step2" }],
          input: { message: "Hello Profiler" },
        }),
      }),
      env
    );
    expect(dagRes.status).toBe(200);
    const dagBody = (await dagRes.json()) as {
      success: boolean;
      totalDurationMs: number;
      metrics: { totalSteps: number; completedSteps: number; skippedSteps: number; totalDurationMs: number };
      stepTraces: Array<{ nodeId: string; durationMs: number; payloadBytes: number }>;
    };
    expect(dagBody.success).toBe(true);
    expect(dagBody.metrics.totalSteps).toBe(2);
    expect(dagBody.metrics.completedSteps).toBe(2);
    expect(dagBody.metrics.skippedSteps).toBe(0);
    expect(dagBody.stepTraces[0]).toHaveProperty("durationMs");
    expect(dagBody.stepTraces[0]).toHaveProperty("payloadBytes");

    // 2. Create and execute a workflow to generate a run
    const createWfRes = await worker.fetch(
      new Request("https://shadowflow.work/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: "Cancellable Workflow",
          nodes: [{ id: "n1", type: "log" }],
          edges: [],
        }),
      }),
      env
    );
    expect(createWfRes.status).toBe(201);
    const { workflow: createdWf } = (await createWfRes.json()) as { workflow: { id: string } };

    const execWfRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${createdWf.id}/execute`, {
        method: "POST",
        headers: authHeaders,
      }),
      env
    );
    expect(execWfRes.status).toBe(200);
    const execBody = (await execWfRes.json()) as { executionId: string; runId: string };
    const runId = execBody.runId || execBody.executionId;

    // 3. Cancel the run: POST /api/workflows/:id/runs/:runId/cancel
    const cancelUnauthorizedRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${createdWf.id}/runs/${runId}/cancel`, {
        method: "POST",
      }),
      env
    );
    expect(cancelUnauthorizedRes.status).toBe(401);

    const cancelNotFoundRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${createdWf.id}/runs/non-existent-run/cancel`, {
        method: "POST",
        headers: authHeaders,
      }),
      env
    );
    expect(cancelNotFoundRes.status).toBe(404);

    const cancelRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${createdWf.id}/runs/${runId}/cancel`, {
        method: "POST",
        headers: authHeaders,
      }),
      env
    );
    expect(cancelRes.status).toBe(200);
    const cancelBody = (await cancelRes.json()) as {
      success: boolean;
      status: string;
      runId: string;
    };
    expect(cancelBody.success).toBe(true);
    expect(cancelBody.status).toBe("cancelled");
    expect(cancelBody.runId).toBe(runId);

    // Verify cancellation audit log
    const auditRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/workflows/${createdWf.id}/audit-logs`, {
        headers: authHeaders,
      }),
      env
    );
    const auditBody = (await auditRes.json()) as {
      logs: Array<{ action: string; details: { runId?: string } }>;
    };
    expect(auditBody.logs.some((l) => l.action === "workflow.cancel" && l.details?.runId === runId)).toBe(true);

    // 4. Prune audit logs: DELETE /api/audit-logs
    const badPruneRes = await worker.fetch(
      new Request("https://shadowflow.work/api/audit-logs?before=invalid-date", {
        method: "DELETE",
        headers: authHeaders,
      }),
      env
    );
    expect(badPruneRes.status).toBe(400);

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const futurePruneRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/audit-logs?before=${encodeURIComponent(futureDate)}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
      env
    );
    expect(futurePruneRes.status).toBe(400);

    const pruneDate = new Date().toISOString();
    const pruneRes = await worker.fetch(
      new Request(`https://shadowflow.work/api/audit-logs?before=${encodeURIComponent(pruneDate)}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
      env
    );
    expect(pruneRes.status).toBe(200);
    const pruneBody = (await pruneRes.json()) as { success: boolean; purgedBefore: string };
    expect(pruneBody.success).toBe(true);
    expect(pruneBody.purgedBefore).toBe(pruneDate);

    // 5. Verify 20 total tool definitions in manifest
    const manifestRes = await worker.fetch(new Request("https://shadowflow.work/api/backend/tools"), env);
    expect(manifestRes.status).toBe(200);
    const manifest = (await manifestRes.json()) as {
      endpoints: Record<string, unknown>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(manifest.endpoints).toHaveProperty("cancel_workflow_run");
    expect(manifest.endpoints).toHaveProperty("prune_audit_logs");
    expect(manifest.endpoints).toHaveProperty("get_admin_stats_summary");
    expect(manifest.endpoints).toHaveProperty("get_admin_stats_timeseries");
    expect(manifest.endpoints).toHaveProperty("get_admin_stats_repo");
    expect(manifest.endpoints).toHaveProperty("get_admin_stats_payments");
    const toolNames = manifest.tools.map((t) => t.function.name);
    expect(toolNames).toContain("cancel_workflow_run");
    expect(toolNames).toContain("prune_audit_logs");
    expect(toolNames).toContain("get_admin_stats_summary");
    expect(toolNames).toContain("get_admin_stats_timeseries");
    expect(toolNames).toContain("get_admin_stats_repo");
    expect(toolNames).toContain("get_admin_stats_payments");
    expect(toolNames.length).toBe(24);
  });

  it("serves /llms.txt, /llms-full.txt, and raw Markdown on /api/blogs/:slug for AI models", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);

    // Seed a blog post
    await mock.db
      .prepare(
        "INSERT INTO blogs (id, slug, title, excerpt, content, category, published_at, updated_at, reading_time_minutes, author, author_role, target_keyword, tags, schema_json_ld) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        "test-blog-1",
        "deepseek-reasoner-guide",
        "DeepSeek Reasoner Production Guide",
        "Comprehensive guide to reasoning models.",
        "# DeepSeek Reasoner Production Guide\n\nDetailed technical analysis of reasoning models.",
        "AI Architecture",
        "2026-11-22",
        "2026-11-22",
        6,
        "Faisal Muhammad",
        "Chief AI Architect",
        "deepseek reasoning",
        JSON.stringify(["DeepSeek", "AI"]),
        JSON.stringify({ "@context": "https://schema.org" })
      )
      .run();

    // 1. GET /llms.txt
    const llmsRes = await worker.fetch(new Request("https://shadowflow.work/llms.txt"), env);
    expect(llmsRes.status).toBe(200);
    expect(llmsRes.headers.get("content-type")).toContain("text/plain");
    const llmsText = await llmsRes.text();
    expect(llmsText).toContain("# ShadowFlow (shadowflow.work)");
    expect(llmsText).toContain("DeepSeek Reasoner Production Guide");
    expect(llmsText).toContain("https://shadowflow.work/llms-full.txt");

    // 2. GET /llms-full.txt
    const fullRes = await worker.fetch(new Request("https://shadowflow.work/llms-full.txt"), env);
    expect(fullRes.status).toBe(200);
    expect(fullRes.headers.get("content-type")).toContain("text/plain");
    const fullText = await fullRes.text();
    expect(fullText).toContain("# ShadowFlow (shadowflow.work) — Complete Corpus & AI Knowledge Graph");
    expect(fullText).toContain("DeepSeek Reasoner Production Guide");
    expect(fullText).toContain("Detailed technical analysis of reasoning models.");

    // 3. GET /api/blogs/:slug with Accept: text/markdown
    const mdRes = await worker.fetch(
      new Request("https://shadowflow.work/api/blogs/deepseek-reasoner-guide", {
        headers: { Accept: "text/markdown" },
      }),
      env
    );
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers.get("content-type")).toContain("text/markdown");
    const mdBody = await mdRes.text();
    expect(mdBody).toContain("# DeepSeek Reasoner Production Guide");
    expect(mdBody).toContain("Detailed technical analysis of reasoning models.");

    // 4. GET /api/blogs/:slug.md extension route
    const extRes = await worker.fetch(new Request("https://shadowflow.work/api/blogs/deepseek-reasoner-guide.md"), env);
    expect(extRes.status).toBe(200);
    expect(extRes.headers.get("content-type")).toContain("text/markdown");
    const extBody = await extRes.text();
    expect(extBody).toContain("# DeepSeek Reasoner Production Guide");

    // 5. Normal JSON lookup continues to return JSON object
    const jsonRes = await worker.fetch(new Request("https://shadowflow.work/api/blogs/deepseek-reasoner-guide"), env);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get("content-type")).toContain("application/json");
    const jsonBody = (await jsonRes.json()) as { success: boolean; post: { slug: string } };
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.post.slug).toBe("deepseek-reasoner-guide");
  });

  it("tracks cookie-free visits without storing raw IPs, filters bots, and logs asset downloads", async () => {
    const mock = createMockDb();
    const env = createEnv(mock.db);
    const clientIp = "203.0.113.77";

    // 1. Valid page view
    const trackRes = await worker.fetch(
      new Request("https://shadowflow.work/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0",
          "cf-connecting-ip": clientIp,
          "CF-IPCountry": "PK",
        },
        body: JSON.stringify({ path: "/blog/mcp-guide?utm_source=x", referrer: "https://google.com/search?q=shadowflow" }),
      }),
      env
    );
    expect(trackRes.status).toBe(201);
    const trackBody = (await trackRes.json()) as { tracked: boolean; path: string };
    expect(trackBody.tracked).toBe(true);
    expect(trackBody.path).toBe("/blog/mcp-guide");
    expect(mock.pageViews.length).toBe(1);
    expect(mock.pageViews[0].country).toBe("PK");
    expect(mock.pageViews[0].referrer_domain).toBe("google.com");
    expect(JSON.stringify(mock.pageViews[0])).not.toContain(clientIp);
    expect(mock.pageViews[0].visitor_hash.length).toBe(32);

    // 2. Bot filtering skips D1 write
    const botRes = await worker.fetch(
      new Request("https://shadowflow.work/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
        },
        body: JSON.stringify({ path: "/pricing" }),
      }),
      env
    );
    expect(botRes.status).toBe(200);
    const botBody = (await botRes.json()) as { tracked: boolean; reason: string };
    expect(botBody.tracked).toBe(false);
    expect(botBody.reason).toBe("bot");
    expect(mock.pageViews.length).toBe(1);

    // 3. Invalid path and oversized payload rejection
    const badPathRes = await worker.fetch(
      new Request("https://shadowflow.work/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({ path: "pricing" }),
      }),
      env
    );
    expect(badPathRes.status).toBe(400);

    const hugeRes = await worker.fetch(
      new Request("https://shadowflow.work/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({ path: "/pricing", referrer: "a".repeat(5000) }),
      }),
      env
    );
    expect(hugeRes.status).toBe(413);

    // 4. Download logging & 302 redirect + JSON format + traversal guard
    const dlRes = await worker.fetch(
      new Request("https://shadowflow.work/download/shadowflow-cli.zip", {
        headers: { "CF-IPCountry": "PK" },
      }),
      env
    );
    expect(dlRes.status).toBe(302);
    expect(dlRes.headers.get("location")).toBe(
      "https://github.com/muhdfaisalwork-gif/shadowflow/releases/latest/download/shadowflow-cli.zip"
    );
    expect(mock.downloads.length).toBe(1);

    const dlJsonRes = await worker.fetch(
      new Request("https://shadowflow.work/download/shadowflow-desktop.exe?format=json"),
      env
    );
    expect(dlJsonRes.status).toBe(200);
    const dlJsonBody = (await dlJsonRes.json()) as { asset: string; downloadUrl: string };
    expect(dlJsonBody.asset).toBe("shadowflow-desktop.exe");
    expect(mock.downloads.length).toBe(2);

    const badAssetRes = await worker.fetch(
      new Request("https://shadowflow.work/download/..%2Fetc%2Fpasswd"),
      env
    );
    expect(badAssetRes.status).toBe(400);
  });

  it("enforces owner-only admin access on /api/admin/stats/*, reports metrics accurately, and never leaks PII", async () => {
    const mock = createMockDb();
    const env: Env = {
      ...createEnv(mock.db),
      ADMIN_EMAILS: "owner@shadowflow.work",
    };
    const secretClientIp = "198.51.100.42";

    // Create owner and non-admin accounts
    const ownerSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@shadowflow.work", password: "StrongPassword123!", displayName: "Owner" }),
      }),
      env
    );
    const { token: ownerToken } = (await ownerSignup.json()) as { token: string };

    const userSignup = await worker.fetch(
      new Request("https://shadowflow.work/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other@example.com", password: "StrongPassword123!", displayName: "Other" }),
      }),
      env
    );
    const { token: otherToken } = (await userSignup.json()) as { token: string };

    // Seed visit, download, subscription, and repo stats
    await worker.fetch(
      new Request("https://shadowflow.work/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "cf-connecting-ip": secretClientIp,
          "CF-IPCountry": "PK",
        },
        body: JSON.stringify({ path: "/llms-full.txt" }),
      }),
      env
    );
    await worker.fetch(new Request("https://shadowflow.work/download/shadowflow.zip"), env);

    const today = new Date().toISOString().slice(0, 10);
    await mock.db
      .prepare(
        "INSERT OR REPLACE INTO repo_stats_daily (day, repo, stars, forks, watchers, open_issues, clones_count, clones_uniques, views_count, views_uniques, release_downloads, top_referrers, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(today, "muhdfaisalwork-gif/shadowflow", 12, 3, 5, 1, 90, 22, 140, 60, 0, "[]", new Date().toISOString())
      .run();
    mock.userSubscriptions.set("u1", "free");

    // 1. Auth gates: 401 unauthenticated, 403 non-admin
    const unauthRes = await worker.fetch(new Request("https://shadowflow.work/api/admin/stats/summary"), env);
    expect(unauthRes.status).toBe(401);

    const nonAdminRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/summary", {
        headers: { Authorization: `Bearer ${otherToken}` },
      }),
      env
    );
    expect(nonAdminRes.status).toBe(403);

    // 2. Owner JWT succeeds
    const summaryRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/summary?range=30d", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      env
    );
    expect(summaryRes.status).toBe(200);
    const summaryText = await summaryRes.text();
    expect(summaryText).not.toContain(secretClientIp);
    expect(summaryText).not.toContain("other@example.com");

    const summary = JSON.parse(summaryText) as {
      visits: { totalViews: number; uniqueVisitors: number; llmsViews: number };
      downloads: { directDownloads: number; totalDownloads: number };
      product: { usersTotal: number };
      payments: { status: string; note: string; planBreakdown: Array<{ plan: string; users: number }> };
      repo: { status: string; stars: number; clonesInRange: number; uniqueClonersInRange: number };
    };
    expect(summary.visits.totalViews).toBe(1);
    expect(summary.visits.uniqueVisitors).toBe(1);
    expect(summary.visits.llmsViews).toBe(1);
    expect(summary.downloads.directDownloads).toBe(1);
    expect(summary.product.usersTotal).toBe(2);
    expect(summary.payments.status).toBe("not_connected");
    expect(summary.payments.note).toContain("on hold");
    expect(summary.payments.planBreakdown).toEqual([{ plan: "free", users: 1 }]);
    expect(summary.repo.status).toBe("synced");
    expect(summary.repo.stars).toBe(12);
    expect(summary.repo.clonesInRange).toBe(90);

    // 3. Timeseries, repo, payments endpoints + x-admin-key fallback
    const tsBadRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/timeseries?metric=unknown", {
        headers: { "x-admin-key": env.JWT_SECRET! },
      }),
      env
    );
    expect(tsBadRes.status).toBe(400);

    const tsRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/timeseries?metric=clones&range=7d", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      env
    );
    expect(tsRes.status).toBe(200);
    const tsBody = (await tsRes.json()) as { metric: string; points: Array<{ day: string; value: number }> };
    expect(tsBody.metric).toBe("clones");
    expect(tsBody.points).toEqual([{ day: today, value: 90 }]);

    const repoRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/repo", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      env
    );
    expect(repoRes.status).toBe(200);
    const repoBody = (await repoRes.json()) as { status: string; latest: { stars: number } };
    expect(repoBody.status).toBe("synced");
    expect(repoBody.latest.stars).toBe(12);

    const payStatsRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/payments", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      env
    );
    expect(payStatsRes.status).toBe(200);
    const payStatsBody = (await payStatsRes.json()) as { status: string; note: string };
    expect(payStatsBody.status).toBe("not_connected");
  });

  it("holds /webhook/payments when unconfigured and verifies HMAC signatures + replay/idempotency when configured", async () => {
    const mock = createMockDb();
    const unconfiguredEnv = createEnv(mock.db);

    // 1. On hold -> 503 not_connected
    const holdRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: "evt_1" }),
      }),
      unconfiguredEnv
    );
    expect(holdRes.status).toBe(503);
    const holdBody = (await holdRes.json()) as { status: string };
    expect(holdBody.status).toBe("not_connected");

    // 2. Configured webhook verifies signature & timestamp
    const webhookSecret = "pay-secret-at-least-32-characters-long";
    const configuredEnv: Env = {
      ...createEnv(mock.db),
      ADMIN_EMAILS: "owner@shadowflow.work",
      PAYMENTS_WEBHOOK_SECRET: webhookSecret,
      PAYMENTS_PROVIDER: "payfast",
    };

    const payload = JSON.stringify({
      eventId: "evt_valid_1",
      provider: "payfast",
      plan: "pro",
      amountCents: 2900,
      currency: "USD",
      status: "succeeded",
    });
    const nowTs = String(Math.floor(Date.now() / 1000));
    const validSig = await signWebhookHmac(webhookSecret, `${nowTs}.${payload}`);

    // Forged signature -> 401
    const forgedRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payments-Timestamp": nowTs,
          "X-Payments-Signature": "0".repeat(64),
        },
        body: payload,
      }),
      configuredEnv
    );
    expect(forgedRes.status).toBe(401);

    // Stale timestamp -> 401
    const staleTs = String(Math.floor(Date.now() / 1000) - 900);
    const staleSig = await signWebhookHmac(webhookSecret, `${staleTs}.${payload}`);
    const staleRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payments-Timestamp": staleTs,
          "X-Payments-Signature": staleSig,
        },
        body: payload,
      }),
      configuredEnv
    );
    expect(staleRes.status).toBe(401);

    // Valid event -> 201
    const okRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payments-Timestamp": nowTs,
          "X-Payments-Signature": validSig,
        },
        body: payload,
      }),
      configuredEnv
    );
    expect(okRes.status).toBe(201);
    expect(mock.payments.length).toBe(1);

    // Replayed eventId -> 200 duplicate: true without second row
    const replayRes = await worker.fetch(
      new Request("https://shadowflow.work/webhook/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payments-Timestamp": nowTs,
          "X-Payments-Signature": validSig,
        },
        body: payload,
      }),
      configuredEnv
    );
    expect(replayRes.status).toBe(200);
    const replayBody = (await replayRes.json()) as { duplicate: boolean };
    expect(replayBody.duplicate).toBe(true);
    expect(mock.payments.length).toBe(1);

    // Admin payments stats shows connected total
    const payStatsRes = await worker.fetch(
      new Request("https://shadowflow.work/api/admin/stats/payments", {
        headers: { "x-admin-key": configuredEnv.JWT_SECRET! },
      }),
      configuredEnv
    );
    expect(payStatsRes.status).toBe(200);
    const payStats = (await payStatsRes.json()) as {
      status: string;
      provider: string;
      summary: { totalRevenueCents: number; succeededCount: number };
    };
    expect(payStats.status).toBe("connected");
    expect(payStats.provider).toBe("payfast");
    expect(payStats.summary.totalRevenueCents).toBe(2900);
    expect(payStats.summary.succeededCount).toBe(1);
  });
});
