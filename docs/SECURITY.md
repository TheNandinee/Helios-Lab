# Security Considerations

- **Authentication:** Firebase Auth (email/password, Google OAuth). Sessions use short-lived JWT ID tokens.
- **Authorization (RBAC):** Roles are stored as custom claims and set only server-side with the Admin SDK. Firestore and RTDB rules enforce:
  - Students read/write only their own projects and submissions.
  - Instructors and admins read all projects and submissions and manage test suites.
  - Guests read only `demo_projects`.
  - Clients cannot write a `role` field to their own profile.
- **Secrets:** `.env.local` and the service account key are git-ignored. Firebase web config values are public identifiers by design; security comes from the rules.
- **Simulator bridge:** postMessage handlers accept only the `https://wokwi.com` origin.
- **Code execution isolation (planned):** User firmware runs only in browser sandboxes (Wasm/JS) or isolated Cloud Functions.
- **Default deny:** Firestore was created in production mode (deny-all); access is granted only by explicit rules.