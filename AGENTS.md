# Repository Guidance

- Read `docs/README.md` and the relevant versioned specification before changing behavior.
- Document each new unit of work under `docs/<type>/<four-part-version>-<slug>/spec.md`.
  Supported types are `feature`, `fix`, `plan`, and `doc`; branches are `<type>/<slug>`.
- Keep platform-neutral catalog rules in `packages/core`; browser APIs belong in `apps/web`.
- Preserve imported source files. Preview transforms must not rewrite original documents.
- Never silently replace a song during import. Keep incompatible schema versions explicit.
- Use existing notation libraries for parsing/rendering and preserve their attribution.
- Run `npm run check`; run relevant Playwright workflows for UI or import/export changes.
- Document unimplemented mobile and synchronization work accurately; no simulated network controls.
