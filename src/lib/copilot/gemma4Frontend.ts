export const GEMMA4_DEFAULT_MODEL = 'gemma4:latest';
export const GEMMA4_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
export const BACKEND_BASE_URL = 'https://shadowflow.work';

export interface Gemma4StatusResult {
  online: boolean;
  baseUrl: string;
  models: string[];
  activeModel: string;
  error?: string;
}

export interface Gemma4FormattedOutput {
  text: string;
  formattedBy: string;
  usedGemma4: boolean;
}

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl || GEMMA4_DEFAULT_BASE_URL).trim();
  return (raw || GEMMA4_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Probe local Ollama daemon for installed Gemma 4 models with a short timeout. */
export async function checkGemma4Status(baseUrl?: string): Promise<Gemma4StatusResult> {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;

  try {
    const res = await fetch(`${normalizedUrl}/api/tags`, {
      method: 'GET',
      signal: controller?.signal,
    });
    if (!res.ok) {
      return {
        online: false,
        baseUrl: normalizedUrl,
        models: [],
        activeModel: GEMMA4_DEFAULT_MODEL,
        error: `Ollama HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
    const allModels = (data.models || [])
      .map((m) => String(m.name || m.model || '').trim())
      .filter(Boolean);
    const gemmaModels = allModels.filter((name) => name.toLowerCase().startsWith('gemma4'));
    const candidateList = gemmaModels.length > 0 ? gemmaModels : allModels;
    const activeModel =
      gemmaModels.find((name) => name === GEMMA4_DEFAULT_MODEL) ||
      gemmaModels[0] ||
      allModels[0] ||
      GEMMA4_DEFAULT_MODEL;

    return {
      online: true,
      baseUrl: normalizedUrl,
      models: candidateList,
      activeModel,
    };
  } catch (err) {
    return {
      online: false,
      baseUrl: normalizedUrl,
      models: [],
      activeModel: GEMMA4_DEFAULT_MODEL,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

/** Dispatch the current canvas DAG to the headless ShadowFlow Cloudflare Worker backend. */
export async function executeWorkflowOnBackend(
  nodes: unknown[],
  edges: unknown[],
  input?: unknown,
  workflowId?: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BACKEND_BASE_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId: workflowId || undefined,
      nodes,
      edges,
      input: input ?? {},
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok && !payload.error) {
    throw new Error(`Backend execution failed with HTTP ${res.status}`);
  }
  return payload;
}

function buildDeterministicSummary(backendPayload: unknown): string {
  if (!backendPayload || typeof backendPayload !== 'object') {
    return `Backend returned: ${String(backendPayload)}`;
  }
  const data = backendPayload as {
    success?: boolean;
    error?: string;
    cycleNodes?: string[];
    stepsExecuted?: number;
    nodesCount?: number;
    totalDurationMs?: number;
    executionOrder?: string[];
    stepTraces?: Array<{ nodeId: string; label?: string; status: string }>;
    output?: unknown;
  };

  if (data.success === false || data.error) {
    const cycleSuffix =
      Array.isArray(data.cycleNodes) && data.cycleNodes.length > 0
        ? ` (cycle nodes: ${data.cycleNodes.join(', ')})`
        : '';
    return `Backend execution failed: ${data.error || 'Unknown error'}${cycleSuffix}.`;
  }

  const orderText =
    Array.isArray(data.executionOrder) && data.executionOrder.length > 0
      ? ` Order: ${data.executionOrder.join(' -> ')}.`
      : '';
  const skipped = Array.isArray(data.stepTraces)
    ? data.stepTraces.filter((s) => s.status === 'skipped').map((s) => s.label || s.nodeId)
    : [];
  const skippedText = skipped.length > 0 ? ` Skipped branches: ${skipped.join(', ')}.` : '';
  const executed = data.stepsExecuted ?? data.nodesCount ?? 1;
  const duration = typeof data.totalDurationMs === 'number' ? ` in ${data.totalDurationMs}ms` : '';

  return `Executed ${executed} step(s)${duration}.${orderText}${skippedText}\n\nBackend output:\n\`\`\`json\n${JSON.stringify(data.output ?? data, null, 2)}\n\`\`\``;
}

/** Have local Gemma 4 translate raw headless backend JSON into a clear user-facing summary. */
export async function gemma4FormatBackendOutput(
  userIntent: string,
  backendPayload: unknown,
  options?: { baseUrl?: string; model?: string }
): Promise<Gemma4FormattedOutput> {
  const baseUrl = normalizeBaseUrl(options?.baseUrl);
  const model = (options?.model || GEMMA4_DEFAULT_MODEL).trim() || GEMMA4_DEFAULT_MODEL;

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          {
            role: 'system',
            content:
              'You are the Gemma 4 front-end presentation layer for ShadowFlow. Convert the headless backend JSON payload into a brief, accurate, plain-English summary for the user. Mention executed steps, skipped branches or errors, and key output values. Avoid buzzwords or filler.',
          },
          {
            role: 'user',
            content: `User intent: ${userIntent}\n\nBackend JSON:\n${JSON.stringify(backendPayload)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as { message?: { content?: string }; model?: string };
    const text = data.message?.content?.trim();
    if (!text) {
      throw new Error('Empty Gemma 4 response');
    }

    return {
      text,
      formattedBy: data.model || model,
      usedGemma4: true,
    };
  } catch {
    return {
      text: buildDeterministicSummary(backendPayload),
      formattedBy: 'deterministic-fallback',
      usedGemma4: false,
    };
  }
}
