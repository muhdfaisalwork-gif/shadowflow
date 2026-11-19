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

function createMockDb(options?: { failHealthCheck?: boolean }): {
  db: D1Database;
  users: Map<string, StoredUser>;
  tfaByUserId: Map<string, StoredTfa>;
  selectOneCount: () => number;
} {
  const users = new Map<string, StoredUser>();
  const tfaByUserId = new Map<string, StoredTfa>();
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
        }
        return { success: true };
      },
      all: async () => ({ success: true, results: [] }),
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
});
