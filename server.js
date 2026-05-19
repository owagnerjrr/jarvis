import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const memoryFile = path.join(dataDir, "jarvis-memory.json");

await loadEnvFile();

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const model = process.env.JARVIS_MODEL || "llama3.1:8b";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiModel = process.env.OPENAI_MODEL || "gpt-5.5";
const openaiReasoning = process.env.OPENAI_REASONING || "high";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"]
]);

async function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, ".env");
    const contents = await readFile(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional. Jarvis can run local-only without it.
  }
}

async function ensureMemory() {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(memoryFile, "utf8"));
  } catch {
    const initial = {
      profile: {
        assistantName: "Jarvis",
        owner: "Voce",
        privacy: "Local-first: historico e preferencias ficam neste computador."
      },
      notes: [],
      conversations: []
    };
    await writeFile(memoryFile, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function saveMemory(memory) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(memoryFile, JSON.stringify(memory, null, 2));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function buildSystemPrompt(memory) {
  const notes = memory.notes.length
    ? memory.notes.map((note, index) => `${index + 1}. ${note}`).join("\n")
    : "Nenhuma nota permanente registrada ainda.";

  return [
    "Voce e Jarvis, uma IA particular, discreta, util e direta.",
    "Responda em portugues do Brasil, a menos que o usuario peca outro idioma.",
    "Priorize privacidade: nao sugira servicos em nuvem quando uma alternativa local for razoavel.",
    "Quando estiver em modo programador, aja como um engenheiro senior: leia o problema, proponha passos claros, escreva codigo completo quando fizer sentido, explique tradeoffs e destaque riscos de seguranca.",
    "Nao invente APIs, arquivos ou resultados de testes. Se algo depender do ambiente do usuario, diga isso claramente.",
    "Se faltar informacao, faca uma pergunta curta ou assuma de forma conservadora.",
    "Memorias permanentes do usuario:",
    notes
  ].join("\n");
}

function buildTranscript(messages) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Jarvis" : "Usuario"}: ${message.content}`)
    .join("\n\n");
}

async function askOllama(messages, memory) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: buildSystemPrompt(memory) },
        ...messages
      ],
      options: {
        temperature: 0.6
      }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Ollama respondeu ${response.status}: ${details}`);
  }

  const payload = await response.json();
  return payload.message?.content || "Nao recebi resposta do modelo local.";
}

async function askOpenAI(messages, memory) {
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY nao configurada. Crie um arquivo .env para usar o modo programador forte.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${openaiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      instructions: buildSystemPrompt(memory),
      input: buildTranscript(messages),
      reasoning: { effort: openaiReasoning },
      max_output_tokens: 6000
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI respondeu ${response.status}: ${details}`);
  }

  const payload = await response.json();
  if (payload.output_text) return payload.output_text;

  const text = (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" || item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();

  return text || "Nao recebi resposta do modelo OpenAI.";
}

async function askJarvis(mode, messages, memory) {
  if (mode === "programmer") {
    return {
      provider: "openai",
      model: openaiModel,
      answer: await askOpenAI(messages, memory)
    };
  }

  if (mode === "auto" && openaiApiKey) {
    return {
      provider: "openai",
      model: openaiModel,
      answer: await askOpenAI(messages, memory)
    };
  }

  return {
    provider: "ollama",
    model,
    answer: await askOllama(messages, memory)
  };
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/status") {
    try {
      const ollama = await fetch(`${ollamaUrl}/api/tags`);
      const tags = ollama.ok ? await ollama.json() : { models: [] };
      sendJson(response, 200, {
        ok: true,
        ollama: ollama.ok,
        model,
        openai: Boolean(openaiApiKey),
        openaiModel,
        openaiReasoning,
        availableModels: (tags.models || []).map((item) => item.name)
      });
    } catch (error) {
      sendJson(response, 200, {
        ok: true,
        ollama: false,
        model,
        openai: Boolean(openaiApiKey),
        openaiModel,
        openaiReasoning,
        availableModels: [],
        message: error.message
      });
    }
    return;
  }

  if (pathname === "/api/memory" && request.method === "GET") {
    sendJson(response, 200, await ensureMemory());
    return;
  }

  if (pathname === "/api/memory" && request.method === "POST") {
    const body = await readBody(request);
    const memory = await ensureMemory();
    const note = String(body.note || "").trim();
    if (!note) {
      sendJson(response, 400, { error: "Escreva uma memoria para salvar." });
      return;
    }
    memory.notes.unshift(note);
    memory.notes = memory.notes.slice(0, 50);
    await saveMemory(memory);
    sendJson(response, 200, memory);
    return;
  }

  if (pathname === "/api/chat" && request.method === "POST") {
    const body = await readBody(request);
    const text = String(body.message || "").trim();
    const mode = ["local", "programmer", "auto"].includes(body.mode) ? body.mode : "local";
    if (!text) {
      sendJson(response, 400, { error: "Mensagem vazia." });
      return;
    }

    const memory = await ensureMemory();
    const recent = memory.conversations.slice(-12).flatMap((turn) => [
      { role: "user", content: turn.user },
      { role: "assistant", content: turn.assistant }
    ]);
    const result = await askJarvis(mode, [...recent, { role: "user", content: text }], memory);

    memory.conversations.push({
      at: new Date().toISOString(),
      mode,
      provider: result.provider,
      model: result.model,
      user: text,
      assistant: result.answer
    });
    memory.conversations = memory.conversations.slice(-80);
    await saveMemory(memory);

    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { error: "Rota nao encontrada." });
}

function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  response.writeHead(200, {
    "content-type": mimeTypes.get(ext) || "application/octet-stream"
  });
  createReadStream(filePath)
    .on("error", () => {
      response.writeHead(404);
      response.end("Not found");
    })
    .pipe(response);
}

export const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
      return;
    }
    serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

export function startServer(options = {}) {
  const selectedPort = Number(options.port || port);
  const selectedHost = options.host || host;

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(selectedPort, selectedHost, () => {
      server.off("error", reject);
      console.log(`Jarvis rodando em http://127.0.0.1:${selectedPort}`);
      console.log(`Modelo local: ${model}`);
      console.log(`Modo programador: ${openaiApiKey ? openaiModel : "OPENAI_API_KEY nao configurada"}`);
      resolve({ port: selectedPort, host: selectedHost });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
