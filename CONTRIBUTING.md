# Contributing to Helios Lab

## Branches
| Branch | Purpose |
|---|---|
| `main` | Production. Auto-deploys to Vercel. Only release merges. |
| `dev` | Integration branch. All feature PRs target `dev`. |
| `feature/<name>-<task>` | Your work, e.g. `feature/p2-oscilloscope-model` |
| `fix/<short-desc>` | Bug fixes |

## Workflow
```bash
git checkout dev && git pull
git checkout -b feature/p3-seed-scripts
# ...work...
git add <files>
git commit -m "feat(scripts): add template project seeder"
git push -u origin feature/p3-seed-scripts
```
Then open a Pull Request into `dev` on GitHub and fill in the template.

## Commit messages (Conventional Commits)
Format: `type(scope): short description` (lowercase, imperative, no full stop)

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code change that isn't a feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Dependencies, build config |
| `chore` | Maintenance, tooling, config |

Scopes: `auth`, `bench`, `sim`, `ide`, `store`, `firebase`, `security`, `functions`, `models`, `ui`, `docs`, `deps`

Examples:
- `feat(bench): add GLTF loader for oscilloscope model`
- `fix(auth): refresh token after role change`
- `docs(architecture): add telemetry data flow`

## Releases
- Semantic Versioning: `MAJOR.MINOR.PATCH`
- Each phase completion = a minor release (`v0.2.0`, `v0.3.0`); production launch = `v1.0.0`
- Every release updates `CHANGELOG.md` and gets a git tag and a GitHub Release.

## Rules
- Never commit `.env.local`, `service-account.json`, or any key file.
- 3D models: GLB only, compressed, under 2 MB each, in `public/models/`.
- Run `npm run lint` before pushing.
