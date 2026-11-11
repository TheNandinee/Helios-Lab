# Architecture Decision Records

## ADR-001: Next.js App Router + React Three Fiber
**Status:** Accepted (v0.1.0)
**Context:** Need a responsive web front end with an interactive 3D scene.
**Decision:** Next.js for routing and Vercel-native deployment; R3F for declarative three.js inside React. The 3D canvas is loaded client-side only (`ssr: false`) because WebGL needs a browser.
**Consequences:** One language (TypeScript) end to end; the 3D bundle is lazy-loaded.

## ADR-002: Firebase + Vercel as cloud platform
**Status:** Accepted (v0.1.0)
**Decision:** Firebase Auth, Firestore, Realtime Database, and Cloud Functions; Vercel for hosting.
**Consequences:** Fully managed and auto-scaling. Cloud Functions require the Blaze plan.

## ADR-003: Roles via JWT custom claims
**Status:** Accepted (v0.1.0)
**Decision:** Roles live in Firebase Auth custom claims, set only by the Admin SDK (`scripts/set-role.mjs`). Security rules read `request.auth.token.role`.
**Consequences:** Users cannot escalate their own role; a role change requires the user to sign in again.

## ADR-004: Simulation strategy
**Status:** Accepted (v0.1.0)
**Decision:** Embed Wokwi for circuit simulation. For full programmatic control, use avr8js (open-source AVR core) for Arduino, and a custom TypeScript 8051 emulator for Tier 1.
**Consequences:** Pin-level control without depending on a private API.

## ADR-005: Realtime Database for telemetry
**Status:** Accepted (v0.1.0)
**Decision:** High-frequency pin data goes to Realtime Database, not Firestore.
**Consequences:** Lower latency and cost for frequent small writes; Firestore stays for structured documents.