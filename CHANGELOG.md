# Changelog
All notable changes to Helios Lab are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/)

## [Unreleased]

## [0.1.0] - 2026-11-11
Phase 1: Core system setup, cloud infrastructure and base layout.

### Added
- Next.js App Router project with TypeScript, Tailwind CSS and Zustand global store
- Firebase client SDK (Auth, Firestore, Realtime Database)
- Email/password and Google OAuth sign-in with automatic user profile creation
- Role-based access via JWT custom claims and an admin role-assignment script
- Firestore and Realtime Database security rules enforcing student/instructor/admin/guest access
- 3D lab workbench (React Three Fiber): lighting rig, bounded orbit camera, raycast hover/select, adaptive resolution via PerformanceMonitor
- Component palette (8051, Arduino Uno, ESP32, Jetson Nano, LED) and inspector panel
- Embedded Wokwi simulator panel with origin-checked postMessage bridge
- Guest demo mode on the lab page
- Project documentation: README, contributing guide, architecture, decision records, security notes

[Unreleased]: https://github.com/TheNandinee/Helios-Lab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TheNandinee/Helios-Lab/releases/tag/v0.1.0