import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

function entry(name: string) {
  return { name, title: name, description: `${name} docs` };
}

/** Writes the manifest and a pre-built output directory for each project. */
async function seed(names: string[]): Promise<void> {
  await writeFile(
    join(root, "projects.json"),
    JSON.stringify({ projects: names.map(entry) }),
  );
  for (const name of names) {
    await mkdir(join(root, name), { recursive: true });
    await writeFile(join(root, name, "index.html"), `<h1>${name}</h1>`);
  }
}

describe("run", () => {
  test("regenerates the landing page for every project in the manifest", async () => {
    await seed(["test", "beacon"]);

    await run({ repoRoot: root });

    const index = await Bun.file(join(root, "index.html")).text();
    expect(index).toContain('href="/test/"');
    expect(index).toContain('href="/beacon/"');
  });

  test("throws and writes nothing when a listed project has no directory", async () => {
    await writeFile(
      join(root, "projects.json"),
      JSON.stringify({ projects: [entry("test")] }),
    );

    await expect(run({ repoRoot: root })).rejects.toThrow(
      /copy its built output there first/,
    );
    expect(await Bun.file(join(root, "index.html")).exists()).toBe(false);
  });

  test("succeeds with an empty manifest", async () => {
    await seed([]);

    await run({ repoRoot: root });

    expect(await Bun.file(join(root, "index.html")).exists()).toBe(true);
  });

  test("reports how many projects were assembled", async () => {
    await seed(["test"]);
    const messages: string[] = [];

    await run({ repoRoot: root, log: (message) => messages.push(message) });

    expect(messages.join("\n")).toContain("1 project(s)");
  });
});
