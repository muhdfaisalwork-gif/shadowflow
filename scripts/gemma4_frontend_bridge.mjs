#!/usr/bin/env node

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const GEMMA4_MODEL = process.env.GEMMA4_MODEL || 'gemma4:latest';
const SHADOWFLOW_API_URL = (process.env.SHADOWFLOW_API_URL || 'https://shadowflow.work').replace(/\/+$/, '');
const SHADOWFLOW_TOKEN = process.env.SHADOWFLOW_TOKEN || '';

async function fetchBackendManifest() {
  const res = await fetch(`${SHADOWFLOW_API_URL}/api/backend/tools`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Backend manifest HTTP ${res.status}`);
  }
  return res.json();
}

async function checkLocalGemma4() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) {
      return { online: false, status: res.status, gemma4Models: [] };
    }
    const data = await res.json();
    const names = Array.isArray(data.models) ? data.models.map((m) => String(m.name || m.model || '')) : [];
    return {
      online: true,
      url: OLLAMA_URL,
      configuredModel: GEMMA4_MODEL,
      gemma4Models: names.filter((n) => n.toLowerCase().startsWith('gemma4')),
    };
  } catch (err) {
    return {
      online: false,
      url: OLLAMA_URL,
      configuredModel: GEMMA4_MODEL,
      error: err instanceof Error ? err.message : String(err),
      gemma4Models: [],
    };
  }
}

async function dispatchBackendTool(toolName, rawArgs, manifest) {
  const spec = manifest?.endpoints?.[toolName];
  if (!spec) {
    return { error: `Unknown backend tool: ${toolName}` };
  }

  let args = {};
  if (typeof rawArgs === 'string') {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      args = {};
    }
  } else if (rawArgs && typeof rawArgs === 'object') {
    args = rawArgs;
  }

  if (spec.requiresAuth && !SHADOWFLOW_TOKEN) {
    return {
      error: `Authentication required for ${toolName}. Set SHADOWFLOW_TOKEN environment variable.`,
      endpoint: `${spec.method} ${spec.path}`,
    };
  }

  let resolvedPath = String(spec.path);
  if (resolvedPath.includes(':id')) {
    const workflowId = args.workflowId ? String(args.workflowId).trim() : '';
    if (!workflowId) {
      return { error: `workflowId is required for ${toolName}` };
    }
    resolvedPath = resolvedPath.replace(':id', encodeURIComponent(workflowId));
  }

  if (toolName === 'get_workflow_runs' && args.limit !== undefined) {
    const sep = resolvedPath.includes('?') ? '&' : '?';
    resolvedPath += `${sep}limit=${encodeURIComponent(String(args.limit))}`;
  }

  const headers = { Accept: 'application/json' };
  if (SHADOWFLOW_TOKEN) {
    headers['Authorization'] = `Bearer ${SHADOWFLOW_TOKEN}`;
  }

  const fetchOpts = { method: spec.method, headers };
  if (spec.method === 'POST' || spec.method === 'PUT') {
    headers['Content-Type'] = 'application/json';
    const bodyPayload = { ...args };
    if (toolName === 'execute_saved_workflow') {
      delete bodyPayload.workflowId;
    }
    fetchOpts.body = JSON.stringify(bodyPayload);
  }

  const res = await fetch(`${SHADOWFLOW_API_URL}${resolvedPath}`, fetchOpts);
  const text = await res.text();
  try {
    return { httpStatus: res.status, data: JSON.parse(text) };
  } catch {
    return { httpStatus: res.status, data: text };
  }
}

async function runGemma4Chat(messages, tools) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GEMMA4_MODEL,
      stream: false,
      think: false,
      messages,
      tools,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama /api/chat returned HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--tools')) {
    const [manifest, gemma4] = await Promise.all([fetchBackendManifest(), checkLocalGemma4()]);
    console.log(JSON.stringify({ gemma4, manifest }, null, 2));
    return;
  }

  const prompt = args.join(' ').trim();
  if (!prompt) {
    console.error('Usage: node scripts/gemma4_frontend_bridge.mjs [--tools | "<prompt>"]');
    process.exit(1);
  }

  const manifest = await fetchBackendManifest();
  const messages = [
    {
      role: 'system',
      content:
        'You are the Gemma 4 front-end for ShadowFlow. Handle all user input and format all final output cleanly for the user. Use the provided backend tools whenever backend data or DAG execution is needed.',
    },
    { role: 'user', content: prompt },
  ];

  let finalContent = '';
  for (let round = 0; round < 3; round += 1) {
    const response = await runGemma4Chat(messages, manifest.tools || []);
    const assistantMsg = response?.message || {};
    const toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : [];

    messages.push(assistantMsg);

    if (toolCalls.length === 0) {
      finalContent = String(assistantMsg.content || '').trim();
      break;
    }

    for (const call of toolCalls) {
      const fnName = call?.function?.name;
      const fnArgs = call?.function?.arguments;
      const backendResult = await dispatchBackendTool(fnName, fnArgs, manifest);
      messages.push({
        role: 'tool',
        content: JSON.stringify(backendResult),
      });
    }
  }

  if (!finalContent) {
    const finalTurn = await runGemma4Chat(messages, []);
    finalContent = String(finalTurn?.message?.content || '').trim();
  }

  console.log(finalContent);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
