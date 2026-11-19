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

function createMockDb(options?: { failHealthCheck?: boolean }): {
  db: D1Database;
  users: Map<string, StoredUser>;
  tfaByUserId: Map<string, StoredTfa>;
  workflows: Map<string, StoredWorkflow>;
  workflowRuns: StoredWorkflowRun[];
  workflowVersions: StoredWorkflowVersion[];
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
          query.startsWith("SELECT id, user_id, name, description, is_active FROM workflows WHERE id = ? AND user_id = ?")
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
});
