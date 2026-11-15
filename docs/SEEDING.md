# Firestore Template and Grading Suite Seeding

`scripts/seed-templates.mjs` writes four starter projects to `lab_projects` and four architecture-specific grading definitions to `test_suites`.

## Prerequisites

- Root dependencies installed (`npm install`), including the existing `firebase-admin` dependency.
- Project owner supplies a service-account credential as `service-account.json` in the repository root. This file is gitignored and must never be committed.
- The UID passed to the script belongs to an existing Firebase Auth user with custom claim `role: "admin"`.
- The credential's `project_id` matches `.firebaserc`.

## Commands

```powershell
node scripts/seed-templates.mjs YOUR_ADMIN_UID
node scripts/seed-templates.mjs YOUR_ADMIN_UID --apply
node scripts/seed-templates.mjs YOUR_ADMIN_UID --apply --include-demos
```

Without `--apply`, the script validates the admin account and prints planned writes without writing Firestore data. Deterministic document IDs make repeated runs idempotent. Existing `created_at` timestamps are preserved, and `updated_at` is refreshed.

The shared grading rubrics live in `config/grading-test-suites.json`; both the seed script and Cloud Function read this file so the rubric does not drift between local configuration and deployed grading.
