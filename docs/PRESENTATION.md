# Presentation plan

Three minutes of presenting, then two minutes of questions. The slides are in `docs/Surge-presentation.pptx` (import it into Google Slides: slides.new, then File > Import slides). TEAM: put the speaker names in the table and practise with a timer.

Slides link: `[paste the Google Slides link here]`

## Timing

| Time | Slide | Who | What to say and show |
|---|---|---|---|
| 0:00 | 1. Title | Speaker 1 | Name, team, one sentence: "Surge tells a hospital or clinic what to keep powered when the grid fails." |
| 0:15 | 2. The problem | Speaker 1 | About 1 billion people are served by health facilities with unreliable electricity (WHO, 2023). Vaccines and insulin spoil, and the ICU and the waiting room share one generator. |
| 0:40 | 3. SDGs and users | Speaker 2 | SDG 3 (target 3.8, medicines and vaccines) and SDG 7 (target 7.1, reliable energy). Users: the manager or senior nurse of a hospital or clinic. |
| 1:00 | 4. Live demo | Speaker 3 | Switch to the app. Sign in as a clinic, press "Fill in sample data", point at the graph and the "time it can last", untick a room and show the time go up. Press Run. |
| 2:00 | 5. Current status | Speaker 3 | Open Current status, press "Power is off", read out the keep and shut-off lists, then show the medicines at risk. |
| 2:25 | 6. How it works | Speaker 4 | Ranks, backup runtime in 15-minute steps, the medicine priority score from our dataset, the weather-based power-cut chance. |
| 2:45 | 7. Impact and next steps | Speaker 4 | What it changes for a facility, what is still an estimate, what we would do next (real meter data, clinician review). |
| 3:00 | Stop | | Questions begin. |

## Demo script (60 seconds)

1. Open the live link. If it does not load, open `index.html` from the folder, or play the screen recording.
2. Pick Clinic, any username, any password, Sign in.
3. Press "Just looking? Fill in sample data". The dashboard opens.
4. Say what the graph shows: the battery and the generator fuel running down, and where power ends.
5. Untick the Laboratory. The time it can last goes up. Say why: less load, longer backup.
6. Press Run and let the graph play for a few seconds.
7. Click Current status, then "Power is off". Read the keep list and the shut-off list. Tick one shut-off item as done.
8. Scroll to the medicines: the highest-priority medicine and whether the fridge is protected.

Record this on screen once as a backup and keep the video next to the slides.

## Likely questions and honest answers

Who is it for? Facility managers, engineers and senior nurses in hospitals and clinics that already have a generator and a battery.

How do you know the numbers are right? The runtime is plain arithmetic from the figures the user enters, and tests check it on cases we worked out by hand. The inputs are only as good as what the facility types in. We have not validated it with real meter data.

Where does the medicine ranking come from? From our own dataset and script. Cold-chain medicines are scored 30% on how little time the label allows outside the fridge and 70% on price, and the weights can be changed. TEAM: state the data source.

Is the power-cut chance real? It is an estimate from the weather forecast. No free service publishes real outage probabilities, so we say so on screen.

Can it tell me a medicine is still safe? No. It says whether the medicine is within the label's limits under our assumptions and tells you to check the label. A clinician or pharmacist decides.

Why not a mobile app or a database? The target is a facility with poor connectivity. Plain files that run offline work on any laptop and keep data on the device.

How much did AI write? See `AI_LOG.md`. TEAM: answer with the real numbers and be ready to explain any file using `docs/EXPLAIN_THE_CODE.md`.

What is the main limitation? The battery is never recharged in the model, the fridge hold time is an assumption, and a single fixed fuel burn rate is used. Those are the first things we would replace with measured values.

What would you build next? Import of real meter readings, a check of the medicine data with a pharmacist, and alerts that reach staff.
