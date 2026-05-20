import http from "node:http";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "./env.js";
import { loadConfig, redactConfig, saveConfig } from "./config.js";
import { loadMemory, saveMemory } from "./memory.js";
import { resolveDataDir } from "./storage.js";
import { askJarvis, synthesizeSpeech } from "./ai.js";
import { getDiagnostics } from "./diagnostics.js";
import { listFiles, readProjectFile, runProjectCommand, writeProjectFile } from "./dev-tools.js";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".mp3", "audio/mpeg"]
]);

export async function createJarvisServer({ rootDir }) {
  await loadEnvFile(rootDir);
  const publicDir = path.join(rootDir, "public");
  const dataDir = resolveDataDir(rootDir);
  await mkdir(dataDir, { recursive: true });
  let config = await loadConfig(dataDir);

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

  function sendBuffer(response, status, buffer, contentType) {
    response.writeHead(status, {
      "content-type": contentType,
      "cache-control": "no-store"
    });
    response.end(buffer);
  }

  async function refreshConfig() {
    config = await loadConfig(dataDir);
    return config;
  }

  async function handleApi(request, response, pathname) {
    if (pathname === "/api/status") {
      const diagnostics = await getDiagnostics(await refreshConfig(), dataDir);
      sendJson(response, 200, {
        ok: true,
        ollama: diagnostics.ollama.ok,
        model: config.localModel,
        openai: diagnostics.openai.ok,
        openaiModel: config.openaiModel,
        openaiReasoning: config.openaiReasoning,
        availableModels: diagnostics.ollama.availableModels,
        diagnostics
      });
      return;
    }

    if (pathname === "/api/config" && request.method === "GET") {
      sendJson(response, 200, redactConfig(await refreshConfig()));
      return;
    }

    if (pathname === "/api/config" && request.method === "POST") {
      const body = await readBody(request);
      const next = await saveConfig(dataDir, body);
      config = await loadConfig(dataDir);
      sendJson(response, 200, next);
      return;
    }

    if (pathname === "/api/diagnostics") {
      sendJson(response, 200, await getDiagnostics(await refreshConfig(), dataDir));
      return;
    }

    if (pathname === "/api/memory" && request.method === "GET") {
      sendJson(response, 200, await loadMemory(dataDir));
      return;
    }

    if (pathname === "/api/memory" && request.method === "POST") {
      const body = await readBody(request);
      const memory = await loadMemory(dataDir);
      const note = String(body.note || "").trim();
      if (!note) {
        sendJson(response, 400, { error: "Escreva uma memoria para salvar." });
        return;
      }
      memory.notes.unshift(note);
      memory.notes = memory.notes.slice(0, 50);
      await saveMemory(dataDir, memory);
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

      const activeConfig = await refreshConfig();
      const memory = await loadMemory(dataDir);
      const recent = memory.conversations.slice(-12).flatMap((turn) => [
        { role: "user", content: turn.user },
        { role: "assistant", content: turn.assistant }
      ]);
      const result = await askJarvis(mode, [...recent, { role: "user", content: text }], memory, activeConfig);

      memory.conversations.push({
        at: new Date().toISOString(),
        mode,
        provider: result.provider,
        model: result.model,
        user: text,
        assistant: result.answer
      });
      memory.conversations = memory.conversations.slice(-80);
      await saveMemory(dataDir, memory);

      sendJson(response, 200, result);
      return;
    }

    if (pathname === "/api/speech" && request.method === "POST") {
      const body = await readBody(request);
      const text = String(body.text || "").trim().slice(0, 4000);
      if (!text) {
        sendJson(response, 400, { error: "Texto vazio para voz." });
        return;
      }
      const audio = await synthesizeSpeech(text, await refreshConfig());
      sendBuffer(response, 200, audio, "audio/mpeg");
      return;
    }

    if (pathname === "/api/tools/list" && request.method === "POST") {
      const body = await readBody(request);
      sendJson(response, 200, { files: await listFiles(await refreshConfig(), body.path) });
      return;
    }

    if (pathname === "/api/tools/read" && request.method === "POST") {
      const body = await readBody(request);
      sendJson(response, 200, await readProjectFile(await refreshConfig(), body.path));
      return;
    }

    if (pathname === "/api/tools/write" && request.method === "POST") {
      const body = await readBody(request);
      sendJson(response, 200, await writeProjectFile(await refreshConfig(), body.path, body.content));
      return;
    }

    if (pathname === "/api/tools/run" && request.method === "POST") {
      const body = await readBody(request);
      sendJson(response, 200, await runProjectCommand(await refreshConfig(), body.cwd, body.command, body.args));
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

  function startServer(options = {}) {
    const selectedPort = Number(options.port || config.port);
    const selectedHost = options.host || config.host;

    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(selectedPort, selectedHost, () => {
        server.off("error", reject);
        console.log(`Jarvis rodando em http://127.0.0.1:${selectedPort}`);
        console.log(`Dados em: ${dataDir}`);
        resolve({ port: selectedPort, host: selectedHost, dataDir });
      });
    });
  }

  function stopServer() {
    return new Promise((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((error) => error ? reject(error) : resolve());
    });
  }

  return { server, startServer, stopServer, dataDir };
}
