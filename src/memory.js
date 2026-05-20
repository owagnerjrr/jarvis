import path from "node:path";
import { readJson, writeJson } from "./storage.js";

export const defaultMemory = {
  profile: {
    assistantName: "Jarvis",
    owner: "Voce",
    privacy: "Local-first: historico e preferencias ficam neste computador."
  },
  notes: [],
  conversations: []
};

export async function loadMemory(dataDir) {
  return readJson(path.join(dataDir, "jarvis-memory.json"), defaultMemory);
}

export async function saveMemory(dataDir, memory) {
  await writeJson(path.join(dataDir, "jarvis-memory.json"), memory);
}
