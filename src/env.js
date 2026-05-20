import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadEnvFile(rootDir) {
  try {
    const contents = await readFile(path.join(rootDir, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Optional. Jarvis runs local-only without .env.
  }
}
