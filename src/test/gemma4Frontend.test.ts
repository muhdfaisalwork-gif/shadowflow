import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkGemma4Status,
  executeWorkflowOnBackend,
  gemma4FormatBackendOutput,
} from "@/lib/copilot/gemma4Frontend";

describe("Gemma 4 Front-End I/O Layer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("detects installed gemma4 models from Ollama /api/tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { name: "qwen3.6:latest" },
            { name: "gemma4:12b" },
            { name: "gemma4:latest" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const status = await checkGemma4Status("http://127.0.0.1:11434/");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
    expect(status.online).toBe(true);
    expect(status.models).toEqual(["gemma4:12b", "gemma4:latest"]);
    expect(status.activeModel).toBe("gemma4:latest");
  });

  it("returns online=false cleanly when Ollama is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const status = await checkGemma4Status("http://127.0.0.1:11434");
    expect(status.online).toBe(false);
    expect(status.models).toEqual([]);
    expect(status.error).toContain("ECONNREFUSED");
  });

  it("formats backend JSON output through Gemma 4 /api/chat with think:false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "gemma4:latest",
          message: { role: "assistant", content: "Executed 2 steps cleanly." },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await gemma4FormatBackendOutput("Run DAG", {
      success: true,
      stepsExecuted: 2,
      output: { ok: true },
    });

    expect(result.usedGemma4).toBe(true);
    expect(result.formattedBy).toBe("gemma4:latest");
    expect(result.text).toBe("Executed 2 steps cleanly.");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const sent = JSON.parse(String(init.body)) as { model: string; think: boolean; stream: boolean };
    expect(sent.model).toBe("gemma4:latest");
    expect(sent.think).toBe(false);
    expect(sent.stream).toBe(false);
  });

  it("falls back deterministically when local Gemma 4 /api/chat is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await gemma4FormatBackendOutput("Run DAG", {
      success: true,
      stepsExecuted: 3,
      executionOrder: ["n1", "n2", "n3"],
      totalDurationMs: 4,
      output: { status: "completed" },
    });

    expect(result.usedGemma4).toBe(false);
    expect(result.formattedBy).toBe("deterministic-fallback");
    expect(result.text).toContain("Executed 3 step(s)");
    expect(result.text).toContain("n1 -> n2 -> n3");
  });

  it("posts serialized nodes and edges to https://shadowflow.work/api/execute", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, stepsExecuted: 1, output: { ok: true } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const nodes = [{ id: "n1", type: "webhook" }];
    const edges: unknown[] = [];
    const res = await executeWorkflowOnBackend(nodes, edges, { ping: true }, "wf_abc");

    expect(res.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://shadowflow.work/api/execute");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(String(init.body)) as { workflowId: string; nodes: unknown[]; edges: unknown[] };
    expect(sent.workflowId).toBe("wf_abc");
    expect(sent.nodes).toEqual(nodes);
  });
});
