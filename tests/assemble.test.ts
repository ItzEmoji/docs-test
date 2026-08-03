import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assemble, preflight } from "../src/assemble.ts";
import type { ProjectConfig } from "../src/manifest.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docstest-assemble-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function project(name: string): ProjectConfig {
  return { name, title: name, description: `${name} docs` };
}

/** Simulates a project's build output already having been copied to `<repoRoot>/<name>/`. */
async function seedProjectDir(root_: string, name: string): Promise<void> {
  await mkdir(join(root_, name), { recursive: true });
  await writeFile(join(root_, name, "index.html"), `<h1>${name}</h1>`);
}

describe("preflight", () => {
  test("passes when the project directory has an index.html", async () => {
    await seedProjectDir(root, "test");
    await expect(preflight(project("test"), root)).resolves.toBeUndefined();
  });

  test("fails when the directory does not exist", async () => {
    await expect(preflight(project("test"), root)).rejects.toThrow(
      /copy its built output there first/,
    );
  });

  test("fails when the directory has no index.html", async () => {
    await mkdir(join(root, "test"), { recursive: true });
    await expect(preflight(project("test"), root)).rejects.toThrow(
      /copy its built output there first/,
    );
  });
});

describe("assemble", () => {
  test("writes a root index page linking each project", async () => {
    await seedProjectDir(root, "test");

    await assemble([project("test")], { repoRoot: root });

    const html = await Bun.file(join(root, "index.html")).text();
    expect(html).toContain('href="/test/"');
  });

  test("throws instead of writing anything when a project directory is missing", async () => {
    await expect(
      assemble([project("test")], { repoRoot: root }),
    ).rejects.toThrow(/copy its built output there first/);

    expect(await Bun.file(join(root, "index.html")).exists()).toBe(false);
  });

  test("never touches files that are already in the repo", async () => {
    await seedProjectDir(root, "test");
    await writeFile(join(root, "README.md"), "hand-written");

    await assemble([project("test")], { repoRoot: root });

    expect(await Bun.file(join(root, "README.md")).text()).toBe("hand-written");
    expect(await Bun.file(join(root, "test/index.html")).text()).toBe("<h1>test</h1>");
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
