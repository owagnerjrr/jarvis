import { access } from "node:fs/promises";
import { synthesizeSpeech } from "./ai.js";
import { normalizeAllowedDirs } from "./dev-tools.js";
import { redactConfig } from "./config.js";

export async function getDiagnostics(config, dataDir) {
  const [ollama, openai, tts, projectDirs, dataWritable] = await Promise.all([
    checkOllama(config),
    checkOpenAI(config),
    checkTts(config),
    checkProjectDirs(config),
    checkDataDir(dataDir)
  ]);

  return {
    at: new Date().toISOString(),
    config: redactConfig(config),
    dataDir,
    dataWritable,
    ollama,
    openai,
    tts,
    projectDirs,
    microphone: {
      ok: null,
      message: "Verificado no navegador/app, porque permissao de microfone depende da interface."
    }
  };
}

async function checkOllama(config) {
  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`);
    const payload = response.ok ? await response.json() : { models: [] };
    return {
      ok: response.ok,
      model: config.localModel,
      availableModels: (payload.models || []).map((item) => item.name)
    };
  } catch (error) {
    return { ok: false, model: config.localModel, message: error.message, availableModels: [] };
  }
}

async function checkOpenAI(config) {
  if (!config.openaiApiKey) return { ok: false, model: config.openaiModel, message: "Chave nao configurada." };
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${config.openaiApiKey}` }
    });
    return { ok: response.ok, model: config.openaiModel, status: response.status };
  } catch (error) {
    return { ok: false, model: config.openaiModel, message: error.message };
  }
}

async function checkTts(config) {
  if (!config.openaiTtsEnabled) return { ok: false, enabled: false, message: "Voz neural desligada." };
  try {
    const audio = await synthesizeSpeech("Teste de voz do Jarvis.", config);
    return { ok: audio.length > 0, enabled: true, model: config.openaiTtsModel, voice: config.openaiTtsVoice };
  } catch (error) {
    return { ok: false, enabled: true, message: error.message };
  }
}

async function checkProjectDirs(config) {
  const dirs = normalizeAllowedDirs(config);
  return Promise.all(dirs.map(async (dir) => {
    try {
      await access(dir);
      return { path: dir, ok: true };
    } catch (error) {
      return { path: dir, ok: false, message: error.message };
    }
  }));
}

async function checkDataDir(dataDir) {
  try {
    await access(dataDir);
    return true;
  } catch {
    return false;
  }
}
