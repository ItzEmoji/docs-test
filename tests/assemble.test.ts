import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assemble } from "../src/assemble.ts";
import type { ProjectConfig } from "../src/manifest.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docstest-assemble-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function project(path: string): ProjectConfig {
  return { path, title: path, description: `${path} docs` };
}

describe("assemble", () => {
  test("writes a root index page linking each project", async () => {
    await assemble([project("test")], { repoRoot: root });

    const html = await Bun.file(join(root, "index.html")).text();
    expect(html).toContain('href="/test/"');
  });

  test("links a project even when its directory does not exist on disk", async () => {
    // The landing page is a register, not a build tool: it lists what
    // projects.json says regardless of what has actually been copied in.
    await assemble([project("not-copied-in-yet")], { repoRoot: root });

    const html = await Bun.file(join(root, "index.html")).text();
    expect(html).toContain('href="/not-copied-in-yet/"');
  });

  test("never touches files that are already in the repo", async () => {
    await writeFile(join(root, "README.md"), "hand-written");

    await assemble([project("test")], { repoRoot: root });

    expect(await Bun.file(join(root, "README.md")).text()).toBe("hand-written");
  });

  test("writes only the index page when there are no projects", async () => {
    await assemble([], { repoRoot: root });

    expect(await Bun.file(join(root, "index.html")).exists()).toBe(true);
  });

  test("writes the stylesheet and vendors both typefaces", async () => {
    await assemble([], { repoRoot: root });

    const css = await Bun.file(join(root, "app.css")).text();
    expect(css).toContain("--accent: #1b4b8f");
    expect(css).toContain("/fonts/public-sans-400.woff2");

    for (const font of [
      "public-sans-400.woff2",
      "public-sans-500.woff2",
      "public-sans-600.woff2",
      "jetbrains-mono-400.woff2",
    ]) {
      const file = Bun.file(join(root, "fonts", font));
      expect(await file.exists()).toBe(true);
      expect(await file.size).toBeGreaterThan(0);
    }
  });

  test("every font the stylesheet declares is one the build vendors", async () => {
    await assemble([], { repoRoot: root });

    const css = await Bun.file(join(root, "app.css")).text();
    const declared = [...css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]!);

    expect(declared.length).toBeGreaterThan(0);
    for (const font of declared) {
      expect(await Bun.file(join(root, "fonts", font)).exists()).toBe(true);
    }
  });
});
