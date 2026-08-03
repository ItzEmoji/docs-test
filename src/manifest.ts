export interface ProjectConfig {
  /** Where the project is served: `<path>/` at the repo root. */
  path: string;
  title: string;
  description: string;
}

const REQUIRED_FIELDS = [
  "path",
  "title",
  "description",
] as const satisfies readonly (keyof ProjectConfig)[];

const PATH_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Directories the site's own assets occupy at the repo root. A project
 * served from one of them would sit alongside the assets and then be
 * shadowed by them, silently serving a stylesheet's fonts where its
 * documentation should be.
 */
const RESERVED_PATHS = new Set(["fonts"]);

export function parseManifest(raw: string): ProjectConfig[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`projects.json is not valid JSON: ${(cause as Error).message}`);
  }

  const projects = (data as { projects?: unknown } | null)?.projects;
  if (!Array.isArray(projects)) {
    throw new Error('projects.json must contain a "projects" array');
  }

  const seen = new Set<string>();
  return projects.map((entry, index) => {
    const project = validateProject(entry, index);
    if (seen.has(project.path)) {
      throw new Error(`projects.json: duplicate path "${project.path}"`);
    }
    seen.add(project.path);
    return project;
  });
}

function validateProject(entry: unknown, index: number): ProjectConfig {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`projects.json: project at index ${index} must be an object`);
  }

  const record = entry as Record<string, unknown>;
  const rawPath = record.path;
  // Identify the project by path where possible, by index otherwise.
  const label = typeof rawPath === "string" && rawPath.length > 0
    ? `project "${rawPath}"`
    : `project at index ${index}`;

  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `projects.json: ${label} requires a non-empty string "${field}"`,
      );
    }
  }

  const project = record as unknown as ProjectConfig;
  if (!PATH_PATTERN.test(project.path)) {
    throw new Error(
      `projects.json: ${label} has an invalid path — use lowercase letters, digits and dashes, starting with a letter or digit`,
    );
  }

  if (RESERVED_PATHS.has(project.path)) {
    throw new Error(
      `projects.json: ${label} uses the reserved path "${project.path}" — the site serves its own assets from there, so pick another`,
    );
  }

  return {
    path: project.path,
    title: project.title,
    description: project.description,
  };
}

export async function loadManifest(filePath: string): Promise<ProjectConfig[]> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`manifest not found at ${filePath}`);
  }
  return parseManifest(await file.text());
}
