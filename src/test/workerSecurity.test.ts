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

function createMockDb(options?: { failHealthCheck?: boolean }): {
  db: D1Database;
  users: Map<string, StoredUser>;
  tfaByUserId: Map<string, StoredTfa>;
  workflows: Map<string, StoredWorkflow>;
  workflowRuns: StoredWorkflowRun[];
  selectOneCount: () => number;
} {
  const users = new Map<string, StoredUser>();
  const tfaByUserId = new Map<string, StoredTfa>();
  const workflows = new Map<string, StoredWorkflow>();
  const workflowRuns: StoredWorkflowRun[] = [];
  let healthQueries = 0;

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
    selectOneCount: () => healthQueries,
  };
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
});
