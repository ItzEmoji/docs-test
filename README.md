# docs-test

Staging ground for documentation before it goes to `docs.itzemoji.com`. Each
project's docs are built in its own repo and its output is copied in by hand
under a top-level directory named after the project (e.g. `test/` for
[`itzemoji/test`](https://github.com/itzemoji/test)) — there is no submodule
and no build step run against them here.

What this repo *does* automate is the landing page: a small Bun/TS generator,
lifted from `docs.itzemoji.com`'s own orchestrator, reads `projects.json` and
regenerates the root `index.html` + `app.css` + `fonts/` so the register of
projects stays in sync without hand-editing HTML.

## Usage

```bash
bun install
bun run build   # regenerate index.html / app.css / fonts from projects.json
bun run serve   # preview the whole repo root at http://localhost:8080
bun run dev     # build, then serve
bun test        # test the generator itself
```

`bun run serve` never builds — it serves whatever is on disk, so you can
rebuild in another terminal without restarting it. Pass `--port 3000` or set
`$PORT` to change the port.

`index.html`, `app.css` and `fonts/` are generated and gitignored — don't
edit them by hand, they'll be overwritten by the next build. CI runs the
build fresh on every deploy, so nothing generated needs to be committed.

## Adding a project

1. Build the project's docs in its own repo, however it builds (Docusaurus,
   VitePress, whatever) — pointed at base path `/<name>/` if the tool
   supports one, so its own asset links resolve once served here.
2. Copy the build output into `<name>/` at the root of this repo.
3. Add an entry to `projects.json`:

   ```json
   {
     "projects": [
       {
         "name": "test",
         "title": "Test",
         "description": "One line shown on the landing page."
       }
     ]
   }
   ```

4. Run `bun run build` (or just push — CI does this before every deploy) and
   the new project shows up in the register automatically.

`name` doubles as the served path and must be lowercase letters, digits and
dashes. `fonts` is reserved — the site's own assets live there.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: it installs the
generator's dependencies, tests it, runs `bun run build`, then publishes the
repo root to Cloudflare Pages.

The Cloudflare Pages project `docs-test` must already exist in the account —
`wrangler pages deploy` does not create it.

Required repository secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token with the Cloudflare Pages edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
