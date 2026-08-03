import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docstest-cli-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function entry(path: string) {
  return { path, title: path, description: `${path} docs` };
}

async function seedManifest(paths: string[]): Promise<void> {
  await writeFile(
    join(root, "projects.json"),
    JSON.stringify({ projects: paths.map(entry) }),
  );
}

describe("run", () => {
  test("regenerates the landing page for every project in the manifest", async () => {
    await seedManifest(["test", "beacon"]);

    await run({ repoRoot: root });

    const index = await Bun.file(join(root, "index.html")).text();
    expect(index).toContain('href="/test/"');
    expect(index).toContain('href="/beacon/"');
  });

  test("does not require the project's directory to exist", async () => {
    await seedManifest(["test"]);

    await expect(run({ repoRoot: root })).resolves.toBeUndefined();
    expect(await Bun.file(join(root, "index.html")).exists()).toBe(true);
  });

  test("succeeds with an empty manifest", async () => {
    await seedManifest([]);

    await run({ repoRoot: root });

    expect(await Bun.file(join(root, "index.html")).exists()).toBe(true);
  });

  test("reports how many projects were assembled", async () => {
    await seedManifest(["test"]);
    const messages: string[] = [];

    await run({ repoRoot: root, log: (message) => messages.push(message) });

    expect(messages.join("\n")).toContain("1 project(s)");
  });
});
