import { fileURLToPath } from "node:url";
import path from "node:path";
import { createJarvisServer } from "./src/server-app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jarvis = await createJarvisServer({ rootDir: __dirname });

export const server = jarvis.server;
export const startServer = jarvis.startServer;
export const stopServer = jarvis.stopServer;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
