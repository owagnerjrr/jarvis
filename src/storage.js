import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function resolveDataDir(rootDir) {
  if (process.env.JARVIS_DATA_DIR) return path.resolve(process.env.JARVIS_DATA_DIR);
  if (process.env.APPDATA) return path.join(process.env.APPDATA, "Jarvis");
  return path.join(os.homedir(), ".jarvis");
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeJson(filePath, fallback);
    return structuredClone(fallback);
  }
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}
