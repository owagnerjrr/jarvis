import path from "node:path";
import { readJson, writeJson } from "./storage.js";

export const defaultConfig = {
  port: 5185,
  host: "0.0.0.0",
  ollamaUrl: "http://127.0.0.1:11434",
  localModel: "llama3.1:8b",
  openaiApiKey: "",
  openaiModel: "gpt-5.5",
  openaiReasoning: "high",
  openaiTtsEnabled: false,
  openaiTtsModel: "gpt-4o-mini-tts",
  openaiTtsVoice: "ash",
  projectsRoot: "",
  allowedProjectDirs: []
};

export async function loadConfig(dataDir) {
  const configPath = path.join(dataDir, "config.json");
  const fileConfig = await readJson(configPath, defaultConfig);
  return {
    ...defaultConfig,
    ...fileConfig,
    port: Number(process.env.PORT || fileConfig.port || defaultConfig.port),
    host: process.env.HOST || fileConfig.host || defaultConfig.host,
    ollamaUrl: process.env.OLLAMA_URL || fileConfig.ollamaUrl || defaultConfig.ollamaUrl,
    localModel: process.env.JARVIS_MODEL || fileConfig.localModel || defaultConfig.localModel,
    openaiApiKey: process.env.OPENAI_API_KEY || fileConfig.openaiApiKey || "",
    openaiModel: process.env.OPENAI_MODEL || fileConfig.openaiModel || defaultConfig.openaiModel,
    openaiReasoning: process.env.OPENAI_REASONING || fileConfig.openaiReasoning || defaultConfig.openaiReasoning,
    openaiTtsModel: process.env.OPENAI_TTS_MODEL || fileConfig.openaiTtsModel || defaultConfig.openaiTtsModel,
    openaiTtsVoice: process.env.OPENAI_TTS_VOICE || fileConfig.openaiTtsVoice || defaultConfig.openaiTtsVoice
  };
}

export async function saveConfig(dataDir, patch) {
  const current = await loadConfig(dataDir);
  const next = {
    ...current,
    ...sanitizeConfigPatch(patch)
  };
  await writeJson(path.join(dataDir, "config.json"), next);
  return redactConfig(next);
}

export function redactConfig(config) {
  return {
    ...config,
    openaiApiKey: config.openaiApiKey ? "configured" : ""
  };
}

function sanitizeConfigPatch(patch) {
  const allowed = new Set(Object.keys(defaultConfig));
  const next = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (!allowed.has(key)) continue;
    if (key === "port") next[key] = Number(value) || defaultConfig.port;
    else if (key === "allowedProjectDirs") next[key] = Array.isArray(value) ? value.map(String) : [];
    else if (key === "openaiTtsEnabled") next[key] = Boolean(value);
    else next[key] = String(value || "").trim();
  }
  return next;
}
