import { join } from "node:path";
import { assemble } from "./assemble.ts";
import { loadManifest } from "./manifest.ts";

export interface RunOptions {
  repoRoot: string;
  manifestPath?: string;
  log?: (message: string) => void;
}

export async function run(options: RunOptions): Promise<void> {
  const manifestPath = options.manifestPath ?? join(options.repoRoot, "projects.json");
  const log = options.log ?? console.log;

  const projects = await loadManifest(manifestPath);
  await assemble(projects, { repoRoot: options.repoRoot });

  log(`\n✓ landing page regenerated for ${projects.length} project(s)`);
}

if (import.meta.main) {
  try {
    await run({ repoRoot: process.cwd() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ ${message}`);
    process.exit(1);
  }
}
