import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const memoryFile = path.join(dataDir, "jarvis-memory.json");

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const model = process.env.JARVIS_MODEL || "llama3.1:8b";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"]
]);

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
    "Se faltar informacao, faca uma pergunta curta ou assuma de forma conservadora.",
    "Memorias permanentes do usuario:",
    notes
  ].join("\n");
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

async function handleApi(request, response, pathname) {
  if (pathname === "/api/status") {
    try {
      const ollama = await fetch(`${ollamaUrl}/api/tags`);
      const tags = ollama.ok ? await ollama.json() : { models: [] };
      sendJson(response, 200, {
        ok: true,
        ollama: ollama.ok,
        model,
        availableModels: (tags.models || []).map((item) => item.name)
      });
    } catch (error) {
      sendJson(response, 200, {
        ok: true,
        ollama: false,
        model,
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
    if (!text) {
      sendJson(response, 400, { error: "Mensagem vazia." });
      return;
    }

    const memory = await ensureMemory();
    const recent = memory.conversations.slice(-12).flatMap((turn) => [
      { role: "user", content: turn.user },
      { role: "assistant", content: turn.assistant }
    ]);
    const answer = await askOllama([...recent, { role: "user", content: text }], memory);

    memory.conversations.push({
      at: new Date().toISOString(),
      user: text,
      assistant: answer
    });
    memory.conversations = memory.conversations.slice(-80);
    await saveMemory(memory);

    sendJson(response, 200, { answer });
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

const server = http.createServer(async (request, response) => {
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

server.listen(port, host, () => {
  console.log(`Jarvis rodando em http://127.0.0.1:${port}`);
  console.log(`Modelo local: ${model}`);
});
