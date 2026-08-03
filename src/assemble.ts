import { copyFile, mkdir } from "node:fs/promises";
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
 * The landing page is just a register: it lists what `projects.json` says
 * and links to `/<path>/`, regardless of whether anything has been copied
 * to that path yet. Nothing here builds or checks project output — that
 * happens by hand, in each project's own repo, independently of this page.
 */
export async function assemble(
  projects: ProjectConfig[],
  options: AssembleOptions,
): Promise<void> {
  const { repoRoot } = options;

  await writeAssets(repoRoot);
  await Bun.write(join(repoRoot, "index.html"), renderIndexPage(projects));
}
