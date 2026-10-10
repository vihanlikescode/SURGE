# AI log

This file records how AI was used on Surge and how the result was checked. TEAM: the two tables marked "fill in" need your own honest numbers. The facts below come from how this repository was actually built.

## Tools

- Claude Code (Claude Sonnet 5.5) in the Claude desktop app. It wrote and edited code and documents in this folder, ran the tests, and checked the app in a browser.
- The Humanizer skill (https://github.com/blader/humanizer, MIT licence), used to edit the wording of the README and other documents so they read plainly.

## What the team did

The team decided what Surge is and what it does. These decisions came from the team, mostly as hand-drawn sketches and short instructions:

- The problem, the two kinds of user (hospital and clinic) and the two SDGs. TEAM: confirm the SDGs.
- The screens: the split login page with a Hospital/Clinic dropdown and no email; the setup page questions (name, location, generator capacity, facilities); the dashboard layout with the left bar, graph, runtime panel and tick-boxes; the Current status tab that says what to shut off.
- Product decisions: unique ranks from 1 downwards, because two facilities at priority 1 caused confusion; no stock-sheet image for clinics, a typed medicine list instead; clinics and hospitals each see only their own questions and dashboard; no solar.
- The medicine priority system and its data (`priority.py`, `clinic_medicines_dataset.csv`, `data.json`). TEAM: say who wrote these and where the data came from.
- Running the app, trying each screen and deciding what to change next.

## What the AI did

The AI wrote nearly all of the application code and tests from those instructions, and the documents in this repository.

| File | Lines | First draft by | Edited or checked by the team |
|---|---|---|---|
| `app.js` | 509 | AI | TEAM: fill in |
| `core.js` | 143 | AI | TEAM: fill in |
| `styles.css` | 138 | AI | TEAM: fill in |
| `tests/core.test.js` | 125 | AI | TEAM: fill in |
| `server.js`, `start-surge.bat` | 61 | AI | TEAM: fill in |
| `medicines.js` | data | Generated from the team's `data.json` | n/a |
| README, CREDITS, docs | n/a | AI, from the team's facts | TEAM: fill in |

Estimated share of the work. TEAM: fill in honestly. If the AI wrote most of the code, say so here and be ready to explain it. `docs/EXPLAIN_THE_CODE.md` walks through every file for that purpose.

| Part | Human share | AI share |
|---|---|---|
| Idea, requirements, screens, product decisions | TEAM: fill in | TEAM: fill in |
| Code | TEAM: fill in | TEAM: fill in |
| Testing and verification | TEAM: fill in | TEAM: fill in |
| Documentation and slides | TEAM: fill in | TEAM: fill in |

## How the output was checked

- 17 automated tests (`node --test`) cover the calculations and the local server, including that the manifest, icons and service worker are served. They all pass.
- A final script drove both facility types through real Chrome (login, setup, sample data, simulation, Current status). It found no console errors, no unlabelled fields or buttons, and no sideways scrolling on a 390 px phone screen. It also caught a sample plan that did not demonstrate shedding, which was fixed.
- Offline mode was tested in real Chrome with a throwaway profile: the service worker cached all 11 app files, the server was shut down, and the app still reloaded and ran the sample clinic.
- The medicine ranking was compared with the team's own `data.json`. All 103 cold-chain medicines appear in the same order.
- Backup runtimes were worked out by hand for small cases (for example a 10 kWh battery at 2 kW lasts 5 hours) and written as tests.
- The app was driven through a browser for both facility types: login, setup, sample data, simulation, and Current status. A plan saved for one facility type is never shown to the other.
- Bugs found and fixed this way include a battery that dropped below its reserve at under 100% efficiency, freezer temperatures below 0 °C being read as 0, click handlers stacking up on every redraw, and a default selection that showed "0h 00m" on the hospital sample.

## Not checked

- Opening `index.html` directly from the disk (the preview pane used here can't run scripts from a file).
- The deployed Vercel link, which does not exist yet.
- The weather card with a real WeatherAPI key. It was tested with a mocked response and with a rejected key.
- The medicine source data, the fridge hold time (4 hours is the team's `dashboard.html` assumption) and the power-cut risk weights. None of these has been validated with a clinician or an engineer.

## Main instructions given to the AI

In order: build the login page from a sketch with username, password and a hospital/clinic dropdown; add a setup page per facility type; rank facilities from 1 downwards; build the clinic dashboard from a sketch with a falling battery and fuel graph, a time-it-can-last panel and tick-boxes; add the medicine priority system from the `SURGE` folder; add a power-cut chance from a free weather API; give hospitals a matching simulation page; add Simulation and Current status tabs; keep each facility type's data and screens separate; make the project score well on the audit rubric; install the Humanizer skill; and make slides.
