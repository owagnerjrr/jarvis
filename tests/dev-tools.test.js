import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listFiles, readProjectFile, resolveSafePath, runProjectCommand, writeProjectFile } from "../src/dev-tools.js";

test("project tools stay inside allowed directories", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jarvis-tools-"));
  try {
    const config = { projectsRoot: dir, allowedProjectDirs: [] };
    const file = path.join(dir, "hello.txt");
    await writeFile(file, "ola", "utf8");

    assert.equal(resolveSafePath(config, file), file);
    await assert.rejects(() => readProjectFile(config, path.join(os.tmpdir(), "outside.txt")), /fora das pastas permitidas/);

    const listed = await listFiles(config, dir);
    assert.equal(listed[0].name, "hello.txt");

    const read = await readProjectFile(config, file);
    assert.equal(read.content, "ola");

    const written = await writeProjectFile(config, path.join(dir, "sub", "new.txt"), "novo");
    assert.equal(written.written, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("command runner allows narrow development commands", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jarvis-command-"));
  try {
    const config = { projectsRoot: dir, allowedProjectDirs: [] };
    const result = await runProjectCommand(config, dir, "node", ["--version"]);
    assert.equal(result.code, 0);
    await assert.rejects(() => runProjectCommand(config, dir, "cmd", ["/c", "dir"]), /Comando nao permitido/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
