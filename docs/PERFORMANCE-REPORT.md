# Helios Lab – Performance and SRE Evidence

> Do not fill this report with estimated or invented values. Record measurements from the actual deployed build and the machine/browser used.

## Test environment

| Field | Value |
|---|---|
| Application URL / commit SHA | TODO |
| Date and time (with timezone) | TODO |
| OS and device | TODO |
| CPU / GPU / RAM | TODO |
| Browser and exact version | TODO |
| Network type | TODO |
| Screen resolution | TODO |

## Measurements

| Metric | Target from project SRS | Measured result | Evidence |
|---|---:|---:|---|
| WebGL workbench frame rate | 60 FPS at 1080p | TODO | DevTools Performance recording |
| Telemetry end-to-end latency | under 150 ms | TODO | Telemetry HUD / timestamp capture |
| Firmware build time | under 2.5 s | TODO | Build HUD / API response `buildMs` |
| Monthly availability | 99.9% | TODO | Monitoring period and uptime evidence |
| Client crash rate | under 0.1% sessions | TODO | Sentry session/error report |
| Lighthouse Performance | Record baseline; no numeric target specified | TODO | Lighthouse JSON/HTML report |

## Browser matrix

| Browser | Version | Workbench opens | Simulation works | FPS | Notes |
|---|---|---|---|---:|---|
| Chrome | TODO | TODO | TODO | TODO | TODO |
| Safari | TODO | TODO | TODO | TODO |
| Brave | TODO | TODO | TODO | TODO | TODO |

## Reliability / fallback tests

| Scenario | Expected behaviour | Result | Evidence |
|---|---|---|---|
| WebGL context lost | Switch to 2D schematic fallback | TODO | TODO |
| Wokwi unavailable | Show useful simulator/build error | TODO | TODO |
| Network disconnect | Keep local editor state and recover on reconnect | TODO | TODO |
| Invalid submission | Mark failed with actionable feedback, no function crash | TODO | TODO |
| Function retry / duplicate event | Do not double-grade a completed submission | TODO | TODO |

## Evidence to attach

- Chrome DevTools Performance recording.
- Lighthouse report from the deployed URL.
- Telemetry HUD screenshot with measured RTT/latency.
- Compiler HUD screenshot with `buildMs`.
- Cloud Function log excerpt for a successful submission.
- Cloud Function log excerpt for an intentionally invalid submission.
- Browser versions and device specifications.

## Interpretation

Document any unmet targets, measurement uncertainty, environmental factors, and corrective actions. A single local benchmark is not evidence of 99.9% monthly availability; use a measured monitoring period for availability and error-rate claims.
