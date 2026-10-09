<div align="center">

# ⚡ SURGE

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

## Why SURGE?

A rural clinic has one battery and two jobs that can't fail: keep patients alive, and keep medicine usable.

- **$35B+** worth of vaccines and biologics are lost every year to cold-chain failures.
- India has **27,000+ Primary Health Centres (PHCs)**. In rural ones, power cuts happen daily, and up to **70% of vaccine fridges** are affected.
- When the grid drops, the same battery feeds the ICU and oxygen equipment, the vaccine fridge, emergency lighting, and comms. There isn't enough for all of them for long.

The health worker has to decide who gets power, in what order, and for how long. Nobody has trained them for that call, and no tool tells them what the battery can actually cover. They guess.

**Electricity at a PHC is a medical supply.** It runs out, it has to be rationed, and rationing it is a clinical decision. SURGE gives that decision numbers.

---

## Core Features

### 1. Electricity Management for the ICU and Every Patient-Critical Load
A live digital twin of a rural clinic on **solar + battery + grid**. Trigger a blackout and watch the battery split across four loads:

| Load | Why it matters |
|---|---|
| 🫁 Oxygen / ICU | Patients on support can't wait |
| 🧊 Refrigeration | Vaccines and biologics spoil outside their temperature range |
| 💡 Emergency lighting | Night deliveries and procedures |
| 📡 Comms | The only way to call for backup or transport |

All four are equally critical. SURGE doesn't rank them. It shows the tradeoff and the health worker decides.

SURGE shows the discharge curve per load, how many hours the battery lasts at the current split, and what you gain or lose by shedding one load to protect another. Everyone in the building who depends on that power, from the ICU bed to the vaccine vial, gets accounted for.

### 2. Medicine & Vaccine Storage Tracking
The clinic's stock lives in the app: every batch, its storage temperature, and how long it has sat outside the safe range.

- **Dynamic Thermal Expiration.** The printed expiry date assumes the vial stayed cold. After a blackout it didn't. SURGE adds up real heat exposure per batch and shortens the effective shelf life.
- **Heat-adjusted FEFO.** Stock is ranked First-Expired, First-Out using the *adjusted* date. The batch that took the most heat gets used first, before it quietly stops working.
- **Local storage.** Clinic profiles and batch logs persist in the browser. No backend database, so it still works on a bad connection.
- **Installable PWA.** SURGE is a website you can install to the home screen of any phone, tablet or PC. No app store, no `.exe`. The app shell and simulation are cached, so the dashboard and rules-based alerts keep working when the power and the internet go out together.

### 3. ColdGuard AI Emergency Triage
Raw telemetry ("battery at 31%, fridge at 7.8°C and climbing, solar at zero") is useless to a nurse at 2 a.m. ColdGuard runs those numbers through a TypeScript rules engine and sends the structured result to **Gemini 2.5 Flash**. What comes back is a short, step-by-step protocol in plain language: how to split the remaining power across all four loads, which stock to move, who to call.

The rules engine decides *what's happening*. Gemini decides *how to say it* to a person under stress. The model never invents the numbers.

---

## How It Works / User Flow

1. **Open the dashboard.** Normal state: solar is charging the battery, the grid is on, all four loads are green.
2. **Check the baseline.** Battery level, load breakdown, fridge temperature, and the stored batches with their printed expiry dates.
3. **Trigger a blackout.** One click kills the grid. If it's night or cloudy, solar is gone too.
4. **Watch the battery drop.** Discharge curves update live for ICU/oxygen, refrigeration, lighting, and comms.
5. **Cross a threshold.** When the battery or fridge temperature hits a risk level, the rules engine flags it.
6. **Get the ColdGuard protocol.** The flagged state goes to Gemini and a step-by-step action list streams into the panel.
7. **Act on it.** Shed a load, or let it run, and watch the curves change.
8. **Restore power.** Open the inventory. Batches now show a heat-adjusted expiry, re-ordered by FEFO.

---

## System Architecture

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
          │  structured, validated context (no raw guesses)
          ▼
┌────────────────────┐
│  Gemini 2.5 Flash  │   Server-side API route.
│  (ColdGuard AI)    │   Turns the context into a localized,
│                    │   step-by-step clinical action protocol
│                    │   (streamed via Vercel AI SDK)
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

**Design rule:** all the math lives in the rules engine. The LLM only explains and prioritizes what the engine already calculated. If Gemini is slow or unavailable, the dashboard and the rules-based alerts still work.

---

## Tech Stack & Deployment

| Layer | Technology | What it does here |
|---|---|---|
| Framework | **Next.js 15** (App Router, TypeScript) | Server Actions and Edge runtime for the dashboard and API routes |
| UI & animation | **Tailwind CSS + shadcn/ui + Framer Motion** | High-contrast clinical UI, state transitions, pulsing alerts |
| Icons | **Lucide** | Icon set |
| Data viz | **Tremor + Chart.js** | Metric cards, battery discharge timelines, load distribution curves |
| Simulation state | **Zustand** | Tick-based store for power drain and thermal decay |
| AI triage | **Vercel AI SDK + Gemini 2.5 Flash** | Streams the emergency protocol word by word during a blackout |
| Persistence | **localStorage** (Zustand `persist`) | Clinic profiles and batch logs stay in the browser. No backend database |
| PWA | **Web app manifest + service worker** (`@serwist/next`) | Home-screen install and offline app shell. Gemini calls stay network-only with a rules-based fallback |
| Auth & multi-tenancy | **Clerk** | Organization switching (e.g. `PHC Hoskote` vs. `District Hospital`) |
| Validation | **Zod** | Runtime validation of weather payloads and simulation inputs |
| Telemetry | **Open-Meteo REST API** | Keyless live ambient temperature and weather risk by clinic coordinates |
| Deployment | **Vercel + GitHub** | Free hosting, auto-deploy on every push |

**Run it locally**

```bash
git clone https://github.com/<your-username>/surge.git
cd surge
npm install
```

Create a `.env.local` file in the project root:

```bash
# Gemini
GEMINI_API_KEY=your_key_here

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

Open-Meteo needs no key.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Keep `GEMINI_API_KEY` and `CLERK_SECRET_KEY` server-side only. Never prefix them with `NEXT_PUBLIC_`.

**Deploy (free, on Vercel)**
1. Push the repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add every variable from `.env.local` under *Project Settings → Environment Variables*.
4. Deploy. Every push to `main` triggers a new production build, and every PR gets its own preview URL.

**Install as an app (PWA)**

Open the deployed site in Chrome, Edge or Safari and use *Install app* / *Add to Home Screen*. Updates arrive automatically on the next load after each deploy.

---

## Contributing

Issues and PRs are welcome. Good places to start:
- Real PHC load profiles and battery specs to replace the demo defaults
- Vaccine-specific heat-stability data (different vaccines tolerate heat very differently)
- Regional language output for the ColdGuard protocol
- Tests for the rules engine

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

Built in a hackathon, for the people who keep the cold chain alive.

</div>
