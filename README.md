# Helios Lab
**A cloud-native 3D virtual IoT & embedded systems laboratory**

![version](https://img.shields.io/badge/version-0.1.0-blue) ![status](https://img.shields.io/badge/status-in%20development-orange)

Live demo: _coming with first Vercel deploy_

Helios Lab replaces fragile, expensive physical embedded-systems labs with a browser-based 3D workbench. Students place microcontrollers (8051, Arduino, ESP32, NVIDIA Jetson) on a virtual bench, write firmware, run simulations, and stream live telemetry, all backed by Firebase and deployed on Vercel.

**Domain:** Education

## Features (current: v0.1.0)
- Email/password and Google sign-in (Firebase Auth)
- Role-based access (student / instructor / admin) via JWT custom claims
- Interactive 3D lab bench (React Three Fiber) with orbit controls and click-to-inspect
- Component palette (8051, Arduino Uno, ESP32, Jetson Nano, LED)
- Embedded Wokwi simulator panel with origin-checked message bridge
- Firestore and Realtime Database security rules enforcing RBAC

See [CHANGELOG.md](CHANGELOG.md) for the full history and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design.

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, Zustand |
| 3D | three.js, React Three Fiber, Drei |
| Auth | Firebase Authentication |
| Database | Cloud Firestore (projects, users), Realtime Database (telemetry) |
| Serverless | Firebase Cloud Functions (auto-grader, planned) |
| Hosting | Vercel |

## Getting started
```bash
git clone https://github.com/TheNandinee/Helios-Lab.git
cd Helios-Lab
npm install
cp .env.example .env.local   # fill in the values shared privately
npm run dev                  # http://localhost:3000
```

## Project structure
```
src/
  app/            routes: / (landing), /login, /lab
  components/
    auth/         AuthProvider (session + role)
    bench/        3D workbench (R3F)
    sim/          simulator integrations (Wokwi)
    ui/           palette, inspector, overlays
  lib/            Firebase client SDK
  store/          Zustand global state
scripts/          admin scripts (roles, seeding)
public/models/    3D GLB assets
functions/        Cloud Functions
tests/            test suites
docs/             architecture, decisions, security
```

## Team
| Member | Responsibility |
|---|---|
| Nandinee (P1) | Core app, 3D canvas, simulator integration, IDE, Firebase |
| Person 2 | 3D models, shaders, visual assets |
| Person 3 | Cloud Functions, seed scripts |
| Person 4 | Testing, performance audits, documentation |

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).