# SURGE

**When energy becomes a clinical decision.**

![SDG 7](https://img.shields.io/badge/SDG%207-Affordable%20%26%20Clean%20Energy-FCC30B?style=flat-square)
![SDG 3](https://img.shields.io/badge/SDG%203-Good%20Health%20%26%20Well--being-4C9F38?style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)

SURGE is a hackathon project about one ugly moment: the grid goes down at a rural clinic, the battery is draining, and a health worker has to decide what stays on.

---

## Why SURGE?

Vaccines are medicine, but they're also a power problem.

- **Over $35B** worth of vaccines and biologics are ruined every year because the cold chain breaks, and a lot of those breaks are power failures.
- India has **27,000+ Primary Health Centres (PHCs)**. In rural ones, daily outages can hit up to **70% of vaccine fridges**.
- A PHC doesn't run on one load. It runs refrigeration, oxygen/ICU equipment, emergency lighting, and communications off the same limited supply.

When the power drops, the battery has to be split between those four things, and there isn't enough for all of them. Someone has to make that call fast, usually without a spreadsheet, an engineer, or a supervisor on the phone.

That's the idea behind the name. Power isn't a utility bill at that point. It's a medical supply, and it gets triaged like one.

SURGE doesn't try to fix the grid. It helps the person standing in the clinic make a better decision in the first few minutes of an outage, and a smarter one about the vaccines afterward.

---

## Core Features

### 1. Digital Twin Power Allocation

A simulated rural clinic running on solar, battery, and grid. Hit the blackout button and watch what happens.

You get live battery discharge curves across four vital loads:

| Load | Why it matters |
| --- | --- |
| Refrigeration | Vaccines and biologics spoil without it |
| Oxygen / ICU | Patients are literally breathing on it |
| Emergency lighting | Night deliveries, procedures, safety |
| Comms | Calling for help, a referral, or a repair crew |

Shift power between loads and see how many hours of battery you actually have left. It's a sandbox for the tradeoffs, so you can see the cost of a choice before making it.

### 2. ColdGuard AI Emergency Triage

Raw telemetry ("battery at 38%, fridge draw 220W, grid down 40 minutes") isn't something a health worker can act on at 2 a.m.

ColdGuard takes that telemetry, runs it through a TypeScript rules engine first, then asks **Gemini 2.5 Flash** to turn the result into a plain, step-by-step protocol for the person on shift:

- what to shed first, and what to protect
- what to check and when
- when to escalate or move stock

The rules engine does the math and sets the guardrails. Gemini does the language. We didn't want an LLM guessing at battery numbers, so it never gets to.

### 3. Dynamic Thermal Expiration (Heat-Adjusted FEFO)

A printed expiry date assumes the vial stayed cold the whole time. After an outage, that's not true.

SURGE tracks how much heat exposure each batch actually took during outages and adjusts its effective shelf life. The stock list then re-sorts using **FEFO (First-Expired, First-Out)** on the adjusted date, not the printed one. A vial that sat warm for three hours moves up the queue, and the batch that stayed cold doesn't get used first just because it was delivered earlier.

---

## How It Works / User Flow

This is the demo walk-through.

1. **Start normal.** The clinic is running on solar, with the battery topped up and the grid connected. All four loads are green.
2. **Trigger a blackout.** Hit the button. The grid drops and the battery starts carrying everything.
3. **Watch the curves.** The discharge chart shows each of the four loads eating into the battery in real time.
4. **Telemetry crosses a threshold.** The rules engine flags that the battery won't last, and ranks what's at risk.
5. **ColdGuard responds.** Gemini turns that into a short, ordered action list written for a health worker, not an engineer.
6. **Reallocate power.** Follow (or ignore) the advice and see how the discharge curves change.
7. **Power returns. Check the stock.** Heat exposure from the outage is applied to every batch, and the inventory re-sorts by adjusted expiry so the most compromised stock gets used first.

---

## System Architecture

```
  ┌──────────────────────┐
  │  Telemetry / Input   │   simulated solar, battery, grid,
  │  (Digital Twin)      │   4 load draws, outage events
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ TypeScript Rules     │   discharge math, load priorities,
  │ Engine               │   thermal exposure, FEFO re-sort
  └──────────┬───────────┘
             │  structured state + flagged risks
             ▼
  ┌──────────────────────┐
  │ Gemini 2.5 Flash API │   ColdGuard: telemetry -> step-by-step
  │ (ColdGuard Triage)   │   clinical action protocol
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ Next.js UI           │   Tailwind + Lucide: curves, alerts,
  │                      │   protocols, inventory
  └──────────────────────┘
```

The rules engine runs before the model on purpose. Numbers come from deterministic code, and Gemini only explains and sequences what the engine already worked out.

---

## Tech Stack & Deployment

- **Next.js** for the app and API routes
- **TypeScript** for the app and the rules engine
- **Tailwind CSS** for styling
- **Lucide Icons** for iconography
- **Gemini 2.5 Flash API** for ColdGuard triage protocols
- **Vercel** for hosting, free tier

**Deployment:** the repo is connected to Vercel, so every push to GitHub triggers an automatic build and deploy. Pushes to `main` go to production, and other branches get preview URLs. To deploy your own copy, import the repo in Vercel and add `GEMINI_API_KEY` under *Project Settings → Environment Variables*.

---

## Quick Start / Local Setup

You'll need Node.js 18+ and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

**1. Clone the repo**

```bash
git clone https://github.com/vihanlikescode/SURGE.git
cd SURGE
```

**2. Install dependencies**

```bash
npm install
```

**3. Add your environment variables**

Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY=your_api_key_here
```

**4. Run it**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and trigger a blackout.

---

## Contributing

PRs and issues are welcome. If you've worked in a PHC, a cold-chain program, or off-grid energy and something here doesn't match reality, please open an issue. That feedback is worth more than a feature.

## License

MIT. See [LICENSE](LICENSE).
