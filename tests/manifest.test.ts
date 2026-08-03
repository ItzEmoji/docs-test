import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifest, parseManifest } from "../src/manifest.ts";

const valid = {
  projects: [
    {
      path: "test",
      title: "Test",
      description: "Sandbox docs project.",
    },
  ],
};

function withProjects(projects: unknown[]): string {
  return JSON.stringify({ projects });
}

describe("parseManifest", () => {
  test("parses a valid manifest", () => {
    const projects = parseManifest(JSON.stringify(valid));
    expect(projects).toHaveLength(1);
    expect(projects[0]!.path).toBe("test");
    expect(projects[0]!.title).toBe("Test");
  });

  test("accepts an empty project list", () => {
    expect(parseManifest(withProjects([]))).toEqual([]);
  });

  test("rejects invalid JSON", () => {
    expect(() => parseManifest("{ not json")).toThrow(/not valid JSON/);
  });

  test("rejects a missing projects array", () => {
    expect(() => parseManifest("{}")).toThrow(/"projects" array/);
  });

  test("names the missing field and the offending project", () => {
    const broken = { ...valid.projects[0], title: undefined };
    expect(() => parseManifest(withProjects([broken]))).toThrow(
      /project "test".*"title"/,
    );
  });

  test("reports the index when the path itself is missing", () => {
    const broken = { ...valid.projects[0], path: undefined };
    expect(() => parseManifest(withProjects([broken]))).toThrow(/index 0.*"path"/);
  });

  test("rejects a malformed path", () => {
    const broken = { ...valid.projects[0], path: "Test Project" };
    expect(() => parseManifest(withProjects([broken]))).toThrow(/lowercase/);
  });

  test("rejects a path the site's own assets already occupy", () => {
    const broken = { ...valid.projects[0], path: "fonts" };
    expect(() => parseManifest(withProjects([broken]))).toThrow(/reserved path "fonts"/);
  });

  test("rejects duplicate paths", () => {
    expect(() =>
      parseManifest(withProjects([valid.projects[0], valid.projects[0]])),
    ).toThrow(/duplicate path "test"/);
  });

  test("rejects a non-string field", () => {
    const broken = { ...valid.projects[0], description: 42 };
    expect(() => parseManifest(withProjects([broken]))).toThrow(/"description"/);
  });
});

describe("loadManifest", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "docstest-manifest-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("rejects a path that does not exist", async () => {
    await expect(loadManifest(join(root, "projects.json"))).rejects.toThrow(
      /manifest not found/,
    );
  });

  test("reads and parses a manifest file from disk", async () => {
    const manifestPath = join(root, "projects.json");
    await writeFile(manifestPath, JSON.stringify(valid));

    const projects = await loadManifest(manifestPath);

    expect(projects).toHaveLength(1);
    expect(projects[0]!.path).toBe("test");
  });
});
