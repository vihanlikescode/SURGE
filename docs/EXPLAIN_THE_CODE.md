# Explain the code

A guide for the team, for the code spot-check and the Q&A. Read it with the files open. Each section says what a file is for, how the important parts work, and what a judge is likely to ask.

## The big picture

Surge is three layers.

1. `core.js` holds the maths. It has no access to the page, so it can be tested on its own with `node --test`.
2. `app.js` holds the screens and the saved data. It calls `core.js` and draws the result.
3. `index.html` loads `config.js`, `medicines.js`, `core.js` and `app.js`, in that order, and `styles.css` for the look.

There is no framework and no build step. `app.js` keeps one object, `state`, and a function `render()` that redraws the page from it. Anything the user does changes `state`, saves it to the browser's local storage, and calls `render()` again.

## core.js

`backupProjection(state, selectedIds, horizonHours)` is the heart of the app. It steps through time in 15-minute slices. At each step the generator supplies its rated kW if it is switched on and still has fuel. The battery supplies up to its capacity in kW (a 1C assumption, used when no discharge limit is entered), and takes it from its stored energy. The core can also hold back a reserve and apply an efficiency, but the setup page no longer asks for them, so by default there is no reserve and efficiency is 100%. If the two together cannot cover the selected rooms, that step is when power ends, and the function records why: sources too small, fuel out, battery at reserve, or both.

`pickByRank` starts with nothing selected and adds rooms in rank order until the next room no longer fits what the sources can deliver at the start. It stops there so a lower-ranked room can never jump the queue. `pickForDuration` does the same but also requires the backup to last a target number of hours with each added room.

`withCommonNames` puts everyday names such as Insulin and Paracetamol in front of the clinical list. When one name covers several rows it takes the cautious values: cold if any row is cold, the shortest known time outside the fridge, and the highest urgency. `rankMedicines` finds each medicine in the list by everyday, generic or brand name and scores cold-chain ones as `(1 - w) × urgency + w × price score`, where `w` is the price weight. Cold-chain medicines come first, then medicines not in the list (storage unknown), then room-temperature ones. `medicineOutcome` compares the time the fridge is unpowered, minus the hold time, with the days the label allows outside the fridge.

`outageRisk` adds points for thunderstorm codes, gusts, heavy rain, snow and active alerts, and caps the total at 95%. The weights are our own judgement.

Likely questions: Why 15-minute steps? (Fine enough for a few hours of backup, cheap to compute.) Why no recharging? (We have no charger data, so it would be a guess.) Where do the risk weights come from? (They are an estimate from our own judgement and are not validated.)

## app.js

State and saving. `blank()` defines the shape of a plan. `loadPlan(type)` reads the plan saved for that facility type (`surge-standalone-v1-hospital` or `-clinic`) and fills any missing fields. `save()` writes it back. Keeping a key per type is how a clinic never sees hospital data.

Login. `renderLogin()` draws the split page and checks the form with `validateDemoLogin`. It stores the username and type in session storage only. It is a demo gate and does not authenticate anyone.

Setup. `renderSetup()` draws the questions for the signed-in type. Only clinics get the fridge picker and the medicine list. `placeRank` keeps ranks unique by inserting a room at the chosen rank and renumbering the others.

Simulation. `renderDashboard()` draws the left bar and either the Simulation tab or `statusView()`. `clinicRun()` asks the core for a projection of the ticked rooms. `clinicChart()` turns the projection into an SVG with the battery and fuel lines. Pressing Run starts a timer (`simTick`) that moves a playhead along the same curve. Nothing is recalculated during playback.

Current status. `statusView()` calls `pickByRank` or `pickForDuration`, splits the rooms into keep and shut off, and reads the battery and fuel at the elapsed time from the same projection. "Power is off" stores the start time. A 30-second timer redraws the page while power is marked off.

Weather. `loadWeather()` calls WeatherAPI.com with the key from `config.js` and gives the next forecast hour to `outageRisk`. With no key it does not call anything.

Events. One click handler is attached to the page once and reads `data-action` attributes. Form inputs are wired in `bind()` after every redraw. Redrawing replaces the page, so `render()` remembers which field had focus and restores it.

Likely questions: Why no framework? (Fewer moving parts and nothing to install, so it runs on any laptop.) How is data kept between visits? (Browser local storage, per facility type, on that device only.) What stops a clinic seeing hospital data? (Each facility type saves under its own storage key, so the other type never loads it.)

## styles.css

One dark theme, written with plain CSS. The dashboard is a two-column grid (left bar and content) that collapses to one column on phones. The graph is an inline SVG, so it scales with the screen.

## medicines.js

Generated from the team's `data.json`. Each row has `drug`, `brand` (several brands separated by `;`), `storage`, `days` (safe days outside the fridge, `null` if the label does not say), `price`, `urgency`, `pscore` and `cold`.

## Tests

`tests/core.test.js` checks the maths with small cases whose answers can be worked out by hand. `tests/server.test.js` starts the local server on a free port and checks that it serves the app files and returns 404 for missing files.

## Things we know are simplified

- Backup energy is not recharged, and the generator burns fuel at a fixed rate whatever the load.
- The fridge hold time is a single number we assume.
- The power-cut chance is an estimate from the weather. It does not know about the grid.
- The login is a demo and protects nothing.
