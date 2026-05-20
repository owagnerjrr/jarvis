import { readdir, readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const allowedCommands = new Map([
  ["npm", new Set(["install", "test", "run", "--version"])],
  ["git", new Set(["status", "diff", "log", "branch", "remote", "fetch", "pull", "push"])],
  ["node", new Set(["--version", "--check"])]
]);

export function normalizeAllowedDirs(config) {
  const dirs = [
    config.projectsRoot,
    ...(Array.isArray(config.allowedProjectDirs) ? config.allowedProjectDirs : [])
  ].filter(Boolean);

  return dirs.map((dir) => path.resolve(dir));
}

export function resolveSafePath(config, targetPath = ".") {
  const resolved = path.resolve(String(targetPath || "."));
  const allowedDirs = normalizeAllowedDirs(config);

  if (!allowedDirs.length) {
    throw new Error("Nenhuma pasta de projetos permitida foi configurada.");
  }

  const allowed = allowedDirs.some((dir) => resolved === dir || resolved.startsWith(`${dir}${path.sep}`));
  if (!allowed) {
    throw new Error(`Caminho fora das pastas permitidas: ${resolved}`);
  }

  return resolved;
}

export async function listFiles(config, targetPath = ".") {
  const dir = resolveSafePath(config, targetPath);
  const entries = await readdir(dir, { withFileTypes: true });
  return Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    const info = await stat(fullPath);
    return {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? "directory" : "file",
      size: info.size,
      updatedAt: info.mtime.toISOString()
    };
  }));
}

export async function readProjectFile(config, filePath) {
  const safePath = resolveSafePath(config, filePath);
  const info = await stat(safePath);
  if (info.isDirectory()) throw new Error("O caminho informado e uma pasta, nao um arquivo.");
  if (info.size > 250_000) throw new Error("Arquivo grande demais para leitura direta no Jarvis.");
  return {
    path: safePath,
    content: await readFile(safePath, "utf8")
  };
}

export async function writeProjectFile(config, filePath, content) {
  const safePath = resolveSafePath(config, filePath);
  await mkdir(path.dirname(safePath), { recursive: true });
  await writeFile(safePath, String(content ?? ""), "utf8");
  return { path: safePath, written: true };
}

export async function runProjectCommand(config, cwd, command, args = []) {
  const safeCwd = resolveSafePath(config, cwd);
  const normalizedCommand = String(command || "").trim();
  const normalizedArgs = Array.isArray(args) ? args.map(String) : [];
  validateCommand(normalizedCommand, normalizedArgs);

  return new Promise((resolve, reject) => {
    const child = spawn(normalizedCommand, normalizedArgs, {
      cwd: safeCwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const limit = 80_000;

    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-limit);
    });

    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-limit);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        cwd: safeCwd,
        command: normalizedCommand,
        args: normalizedArgs,
        code,
        stdout,
        stderr
      });
    });
  });
}

function validateCommand(command, args) {
  const allowedFirstArgs = allowedCommands.get(command);
  if (!allowedFirstArgs) throw new Error(`Comando nao permitido: ${command}`);
  const firstArg = args[0] || "--version";
  if (!allowedFirstArgs.has(firstArg)) {
    throw new Error(`Subcomando nao permitido para ${command}: ${firstArg}`);
  }

  if (command === "npm" && firstArg === "run") {
    const scriptName = args[1] || "";
    if (!/^[\w:-]+$/.test(scriptName)) throw new Error("Nome de script npm invalido.");
  }
}
