# Documentation Convention

Each unit of work has its own directory and specification:

```text
docs/<type>/<version>-<slug>/spec.md
```

| Type      | Purpose                                                   | Branch           |
| --------- | --------------------------------------------------------- | ---------------- |
| `feature` | New application behavior or foundations                   | `feature/<slug>` |
| `fix`     | Correct an existing defect                                | `fix/<slug>`     |
| `plan`    | Proposals, investigation, and future implementation plans | `plan/<slug>`    |
| `doc`     | Documentation-only changes                                | `doc/<slug>`     |

The version has **four numeric components**, beginning with `0.0.0.0`. It is a
feature/document version, separate from npm's three-part package version and the
catalog's `schemaVersion`. It is not automatically a semantic-versioning promise.
Use a unique next version for new work, incrementing the last component by default
(for example, `0.0.0.1`). Deliberate larger increments can be agreed as releases evolve.

Use lowercase kebab-case slugs, such as `band-sessions`. The branch excludes the
version: `docs/feature/0.0.0.1-band-sessions/` maps to `feature/band-sessions`.
Keep a folder's version and slug stable once established. Additional diagrams,
design decisions, verification notes, and examples may live beside `spec.md`.

Start from [templates/spec.md](templates/spec.md). Record the intended behavior and
acceptance criteria before implementing; update status and validation evidence as
the work progresses. The initial [base feature](feature/0.0.0.0-base/spec.md) also
owns the initial documentation convention and architecture.

## Index

| Version | Type    | Slug | Specification                        |
| ------- | ------- | ---- | ------------------------------------ |
| 0.0.0.0 | feature | base | [Base](feature/0.0.0.0-base/spec.md) |
| 0.0.0.1 | feature | kubernetes-deployment | [Kubernetes Deployment](feature/0.0.0.1-kubernetes-deployment/spec.md) |
