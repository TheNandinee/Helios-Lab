# Person 4 – Backend, Auto-Grader, Testing and Hardening

This change set implements the Person 4 backend phases against the Helios Lab source snapshot.
It deliberately does not replace unrelated application files.

## What is included

- Firestore seed script for four hardware templates and four architecture-specific `test_suites` documents.
- A Firestore-safe object wire model, Wokwi-compliant diagram.json conversion, and Import/Export controls in the Project Bar. The converter uses Wokwi left/top pixel coordinates and string-based wire route instructions ([Wokwi diagram.json format](https://docs.wokwi.com/diagram-format)); Helios-only 8051/Jetson parts are intentionally rejected by stock-Wokwi export.
- Project save/load integration for wire connections. Published templates are queried separately from personal projects and open as student-owned copies, so saving a template never tries to overwrite the admin-owned source document.
- A second-generation Firestore `onDocumentCreated` trigger for `submissions/{submissionId}`.
- Arduino/ESP32 compilation through the same Wokwi build endpoint used by the existing app API.
- 8051 assembly through the project's existing `assemble()` implementation.
- Jetson configuration validation through the existing `parseJetsonConfig()` implementation.
- Rubric checks, scores, feedback and grading metadata written to the submission document.
- Vitest unit tests, a Playwright landing-page smoke test and Firestore Rules emulator tests.
- Tighter submission create/update rules: students must submit the required identity/code fields, and staff can change grading metadata without changing the submitted code or identity. Duplicate grading events retain retryability while an active grading lease is held.

## Important grading limitations

- Arduino and ESP32 are compiled through Wokwi's build service. Compilation is not the same as running a hardware simulation or proving pin behaviour at runtime.
- 8051 assembly validates source and emits an assembled image using the existing project's assembler. The function does not execute the firmware on a physical 8051.
- Jetson grading validates the platform's supported configuration settings and required inference-code markers. It does not execute CUDA/TensorRT or arbitrary Python submitted by students.
- Submitted code is never executed as a Node.js child process or shell command in Cloud Functions.
- The grader awards marks for compilation/validation and configured static rubric checks. Use a hardware simulator or hardware-in-the-loop service for runtime correctness claims.

## Install root test tools

Use Node.js 22.12 or newer for the current Vitest release:

```powershell
npm install --save-dev vitest @playwright/test @firebase/rules-unit-testing firebase-tools
npm pkg set "scripts.test=vitest run"
npm pkg set "scripts.test:watch=vitest"
npm pkg set "scripts.test:e2e=playwright test"
npm pkg set 'scripts.test:rules=firebase emulators:exec --only firestore --project demo-helios-lab-rules "vitest run --config vitest.rules.config.ts"'
```

Then install Chromium for Playwright:

```powershell
npx playwright install chromium
```

The commands above update the existing root `package.json` and `package-lock.json` without replacing them wholesale.

## Install Cloud Function dependencies

```powershell
cd functions
npm install
cd ..
```

This creates `functions/package-lock.json` locally. Commit that generated lock file with the Functions implementation.

## Local validation commands

```powershell
npm test
npm run test:e2e
npm run test:rules
cd functions
npm run build
cd ..
```

For Firestore-trigger testing with emulators, start the Firestore and Functions emulators:

```powershell
firebase emulators:start --only firestore,functions
```

The project owner must configure Firebase access before deployment. Real Firestore writes, deployed Cloud Functions, and production logs cannot be validated from a machine without project permissions.

## Seed templates and grading suites

Place the service-account JSON at repository root as `service-account.json` (already gitignored). A project administrator must first make sure the target user has `role: "admin"` custom claims.

Dry run:

```powershell
node scripts/seed-templates.mjs YOUR_ADMIN_UID
```

Write:

```powershell
node scripts/seed-templates.mjs YOUR_ADMIN_UID --apply
```

Add guest demo copies only if the team wants the public demo catalog:

```powershell
node scripts/seed-templates.mjs YOUR_ADMIN_UID --apply --include-demos
```

The script uses deterministic document IDs, preserving `created_at` and refreshing `updated_at` on reruns. It writes four `lab_projects`, four `test_suites`, and optionally four `demo_projects` documents.

## Deployment (project owner access required)

```powershell
firebase login
firebase use helios-lab-156bb
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

Cloud Functions deployment requires the Firebase project to be on the Blaze plan. Confirm billing with the project owner before deployment; a budget alert is not a hard spending cap.

## Index assessment

The current application queries use single-field filters/orderings, and the grader reads `test_suites` by deterministic document ID. Firestore automatically maintains single-field indexes, so this implementation does not add speculative composite indexes. If a future compound query produces a missing-index error, add the exact suggested definition to `firestore.indexes.json` and commit it.
