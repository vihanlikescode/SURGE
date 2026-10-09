<div align="center">

# SURGE

### Power and temperature management for healthcare facilities.

![SDG 7](https://img.shields.io/badge/SDG%207-Affordable%20%26%20Clean%20Energy-FCC30B?style=for-the-badge)
![SDG 3](https://img.shields.io/badge/SDG%203-Good%20Health%20%26%20Well--being-4C9F38?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

SURGE is a progressive web app focused on two needs in healthcare facilities: managing hospital power and monitoring temperatures in clinic storage. Its simulation and saved data work offline after the app has been opened online once.

## Why SURGE

Hospitals rely on electricity for critical equipment, while clinics rely on stable temperatures to protect medicines and vaccines. During a power outage or a cooling problem, staff need a clear view of remaining power, critical loads, and storage conditions.

SURGE puts those two operational views in one place.

## What it does

### Hospital power management

SURGE simulates a facility powered by solar, batteries, and the grid. During an outage, it shows battery use across four critical loads:

| Load | Purpose |
|---|---|
| Oxygen and ICU equipment | Supports patients who need respiratory or intensive care |
| Medicine and vaccine refrigeration | Keeps clinical storage within its required temperature range |
| Emergency lighting | Supports care during a power interruption |
| Communications | Helps staff contact support or arrange transport |

The dashboard shows each load's discharge curve and estimated remaining runtime at the current allocation. Staff can adjust loads and see how those changes affect available power.

### Clinic and storage temperature management

SURGE models temperature conditions in the clinic and its medicine and vaccine storage. It tracks storage temperature and how long each batch has spent outside its safe range. Temperature alerts help staff identify storage excursions and respond to them.

The demo simulates storage temperature and uses local ambient temperature data when available. The dashboard and saved clinic data remain available offline.

## Demo walkthrough

1. Open the dashboard and review the facility's power and storage temperature status.
2. Trigger a grid outage and observe battery use across the four loads.
3. Adjust a load allocation and compare the estimated remaining runtime.
4. Watch the storage temperature model and alerts as conditions change.
5. Switch to airplane mode and reload the installed app to see the simulation and saved data continue offline.

## How it fits together

```
┌────────────────────┐
│ Simulation / Input │   Solar, battery, grid, facility loads,
│                    │   storage temperature and ambient weather.
└─────────┬──────────┘
          │ state snapshots
          ▼
┌────────────────────┐
│ Rules Engine       │   Runtime estimates and temperature alerts.
│ (TypeScript)       │
└─────────┬──────────┘
          │ validated facility status
          ▼
┌────────────────────┐
│ Next.js Dashboard  │   Power management and storage temperature.
└─────────┬──────────┘
          │ saved facility data
          ▼
┌────────────────────┐
│ localStorage       │   Data stored in the browser for offline use.
└────────────────────┘
```

## Tech stack

| Layer | What we used | What it does here |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Dashboard and API routes |
| UI | Tailwind CSS, shadcn/ui, Framer Motion | Facility dashboard and interactions |
| Icons | Lucide | Interface icons |
| Charts | Tremor, Chart.js | Power and temperature trends |
| Simulation | Zustand | Power use and storage temperature simulation |
| Storage | `localStorage` via Zustand `persist` | Saved facility settings and storage records |
| PWA | Web app manifest, service worker (`@serwist/next`) | Installable app shell with offline support |
| Validation | Zod | Validates weather data and simulation inputs |
| Weather | Open-Meteo REST API | Ambient temperature by facility coordinates; no API key |
| Hosting | Vercel + GitHub | Hosting and deployment |

---

## License

MIT. See [LICENSE](LICENSE).
