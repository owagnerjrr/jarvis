import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig, saveConfig } from "../src/config.js";
import { loadMemory, saveMemory } from "../src/memory.js";

test("config persists sanitized settings", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jarvis-config-"));
  try {
    const saved = await saveConfig(dir, {
      port: "5199",
      localModel: "llama3.2:3b",
      openaiApiKey: "secret",
      allowedProjectDirs: ["C:\\Projects"]
    });

    assert.equal(saved.openaiApiKey, "configured");

    const config = await loadConfig(dir);
    assert.equal(config.port, 5199);
    assert.equal(config.localModel, "llama3.2:3b");
    assert.equal(config.openaiApiKey, "secret");
    assert.deepEqual(config.allowedProjectDirs, ["C:\\Projects"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("memory persists notes and conversations", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jarvis-memory-"));
  try {
    const memory = await loadMemory(dir);
    memory.notes.push("Teste");
    memory.conversations.push({ user: "oi", assistant: "ola" });
    await saveMemory(dir, memory);

    const next = await loadMemory(dir);
    assert.equal(next.notes[0], "Teste");
    assert.equal(next.conversations[0].assistant, "ola");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
