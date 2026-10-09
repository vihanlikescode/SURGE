<div align="center">

# SURGE

### When energy becomes a clinical decision.

![SDG 7](https://img.shields.io/badge/SDG%207-Affordable%20%26%20Clean%20Energy-FCC30B?style=for-the-badge)
![SDG 3](https://img.shields.io/badge/SDG%203-Good%20Health%20%26%20Well--being-4C9F38?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## Why we built this

Picture a rural health centre at night. The grid just went down, which happens most days. There's a battery, and a lot hangs on it: the oxygen and ICU equipment, the vaccine fridge, the lights, the phone or radio you'd use to call for help.

The battery won't carry all of that for long, and the nurse on shift has to decide where the power goes. Nobody trained them for it, and no tool says how many hours they actually have. They guess.

The numbers behind this are bad:

- Over **$35B** of vaccines and biologics are ruined every year by cold-chain failures.
- India has **27,000+ Primary Health Centres**. In rural ones, daily outages hit up to **70% of vaccine fridges**.

We think of electricity at a PHC as a medical supply. It runs out, someone has to ration it, and how they ration it affects patients. SURGE puts numbers behind that decision.

---

## What it does

### Power management for the ICU and everything else that matters

SURGE simulates a rural clinic on solar, battery and grid. Hit the blackout button and watch the battery drain across four loads:

| Load | Why it's on the list |
|---|---|
| Oxygen / ICU | Patients on support can't wait |
| Refrigeration | Vaccines spoil outside their temperature range |
| Emergency lighting | Night deliveries and procedures |
| Comms | The only way to call for backup or transport |

We deliberately don't rank these. All four are critical, and which one gives way depends on the night. SURGE shows each load's discharge curve, how many hours you have at the current split, and what you buy or lose by cutting one load to save another. The call stays with the person in the room.

### Medicine and vaccine storage

Every batch in the clinic's stock gets tracked: its storage temperature and how long it has spent outside the safe range.

The printed expiry date assumes the vial stayed cold. After a blackout it didn't, so SURGE adds up the actual heat exposure per batch and shortens its effective shelf life. Stock is then sorted First-Expired, First-Out using that adjusted date. The batch that got the most heat gets used first, before it quietly stops working.

Everything is saved in the browser (`localStorage`). There's no backend database, which keeps it usable on a bad connection.

SURGE is also a PWA, so you can install it from the browser on any phone, tablet or PC. No app store and no `.exe`. The app shell and simulation are cached so the dashboard and rules-based alerts still load when the power and the internet go out together.

### ColdGuard, the AI triage helper

Raw numbers like "battery 31%, fridge 7.8°C and climbing, no solar" don't help much at 2 a.m. ColdGuard takes the numbers, runs them through a TypeScript rules engine, and passes the result to Gemini 2.5 Flash. Gemini writes a short, plain-language set of steps: how to split the remaining power across the four loads, which stock to move, who to call.

The rules engine does the math. Gemini only does the wording. It never gets to make up a number.

---

## Walking through the demo

1. Open the dashboard. Solar is charging the battery, the grid is on, all four loads are green.
2. Look at the baseline: battery level, fridge temperature, and stock with its printed expiry dates.
3. Trigger a blackout. The grid drops. At night or under cloud, solar drops too.
4. Watch the discharge curves for ICU/oxygen, refrigeration, lighting and comms.
5. When the battery or fridge temperature crosses a risk level, the rules engine raises an alert.
6. ColdGuard sends that state to Gemini, and the action steps stream into the panel.
7. Shed a load, or don't, and watch the curves change.
8. Restore power and open the inventory. Batches now show heat-adjusted expiry dates, reordered by FEFO.

---

## How it fits together

```
┌────────────────────┐
│  Telemetry / Input │   Zustand tick simulation: solar, battery,
│  (Digital Twin)    │   grid, 4 loads, fridge temp, batches.
│                    │   + Open-Meteo ambient temp (Zod-validated)
└─────────┬──────────┘
          │  state snapshots
          ▼
┌────────────────────┐
│   Rules Engine     │   TypeScript. Deterministic.
│   (TypeScript)     │   - battery runtime per load
│                    │   - risk thresholds / alert level
│                    │   - cumulative heat exposure per batch
│                    │   - heat-adjusted FEFO ranking
└─────────┬──────────┘
          │  structured, validated context
          ▼
┌────────────────────┐
│  Gemini 2.5 Flash  │   Server-side API route.
│  (ColdGuard AI)    │   Turns the context into step-by-step
│                    │   clinical actions, streamed via the
│                    │   Vercel AI SDK
└─────────┬──────────┘
          │  streamed protocol text
          ▼
┌────────────────────┐
│    Next.js UI      │   Tailwind + shadcn/ui + Framer Motion.
│  Dashboard / Triage│   Tremor + Chart.js for live curves,
│  / Inventory       │   FEFO inventory view
└─────────┬──────────┘
          │  clinic profiles, batch logs
          ▼
┌────────────────────┐
│    localStorage    │   Zustand persist. Clerk orgs pick the
│  (per browser)     │   clinic; data never leaves the device
└────────────────────┘
```

One rule shaped the design: all the math lives in the rules engine, and the LLM only explains it. If Gemini is slow or down, the dashboard and the rules-based alerts still work.

---

## Tech stack

| Layer | What we used | What it does here |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Dashboard, Server Actions, API routes |
| UI | Tailwind CSS, shadcn/ui, Framer Motion | High-contrast clinical UI, transitions, alert pulses |
| Charts | Tremor, Chart.js | Metric cards, discharge timelines, load curves |
| Simulation | Zustand | Tick-based store for power drain and thermal decay |
| AI | Vercel AI SDK, Gemini 2.5 Flash | Streams the emergency protocol during a blackout |
| Storage | `localStorage` via Zustand `persist` | Clinic profiles and batch logs, no backend database |
| PWA | Web app manifest, service worker (`@serwist/next`) | Install to home screen, offline app shell |
| Auth | Clerk | Organization switching (`PHC Hoskote` vs. `District Hospital`) |
| Validation | Zod | Checks weather payloads and simulation inputs |
| Weather | Open-Meteo REST API | Live ambient temperature by clinic coordinates, no API key |
| Hosting | Vercel + GitHub | Free tier, auto-deploys on every push |

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

Built at a hackathon, for the people who keep the cold chain running.

</div>
