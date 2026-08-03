import { copyFile, mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { renderIndexPage } from "./index-page.ts";
import { APP_CSS } from "./styles.ts";
import type { ProjectConfig } from "./manifest.ts";

export interface AssembleOptions {
  repoRoot: string;
}

/**
 * Public Sans carries the prose, JetBrains Mono the served paths. Vendored
 * out of node_modules rather than loaded from a CDN, same as
 * docs.itzemoji.com.
 */
const FONTS: Array<[pkg: string, file: string, out: string]> = [
  ["@fontsource/public-sans", "public-sans-latin-400-normal.woff2", "public-sans-400.woff2"],
  ["@fontsource/public-sans", "public-sans-latin-500-normal.woff2", "public-sans-500.woff2"],
  ["@fontsource/public-sans", "public-sans-latin-600-normal.woff2", "public-sans-600.woff2"],
  ["@fontsource/jetbrains-mono", "jetbrains-mono-latin-400-normal.woff2", "jetbrains-mono-400.woff2"],
];

/**
 * Unlike docs.itzemoji.com's `dist/`, `repoRoot` is the whole repository —
 * it holds every manually-copied project directory, the source of this
 * generator, and everything else in the repo. Assembling here only ever
 * writes the site's own generated assets (`app.css`, `fonts/`, `index.html`)
 * and never clears the directory first.
 */
export async function writeAssets(repoRoot: string): Promise<void> {
  const require = createRequire(import.meta.url);
  await Bun.write(join(repoRoot, "app.css"), APP_CSS.trimStart());

  const fontsOut = join(repoRoot, "fonts");
  await mkdir(fontsOut, { recursive: true });

  for (const [pkg, file, out] of FONTS) {
    const root = dirname(require.resolve(`${pkg}/package.json`));
    await copyFile(join(root, "files", file), join(fontsOut, out));
  }
}

/**
 * Each project's build output is copied into `<name>/` by hand, outside this
 * tool — there is no submodule and no build command to run. This only
 * checks that the promised directory is actually there before the generated
 * index page links to it.
 */
export async function preflight(
  project: ProjectConfig,
  repoRoot: string,
): Promise<void> {
  const dir = join(repoRoot, project.name);

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw new Error(
      `${project.name}: no directory at ${project.name}/ — copy its built output there first`,
    );
  }

  if (entries.length === 0 || !entries.includes("index.html")) {
    throw new Error(
      `${project.name}: ${project.name}/ has no index.html — copy its built output there first`,
    );
  }
}

export async function assemble(
  projects: ProjectConfig[],
  options: AssembleOptions,
): Promise<void> {
  const { repoRoot } = options;

  for (const project of projects) {
    await preflight(project, repoRoot);
  }

  await writeAssets(repoRoot);
  await Bun.write(join(repoRoot, "index.html"), renderIndexPage(projects));
}
