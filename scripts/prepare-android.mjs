import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const targetDir = path.join(rootDir, "android", "app", "src", "main", "assets", "public");
await mkdir(targetDir, { recursive: true });
await copyFile(path.join(rootDir, "public", "mobile.html"), path.join(targetDir, "index.html"));
console.log("Android entry points to the home PC connection screen.");
