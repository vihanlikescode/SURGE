# SURGE - Smart Utility Resource Grid for Emergency healthcare

### Keeping care running when power or cooling falters.

**A hackathon prototype for hospital power management and clinic storage temperatures.**

A blackout can quickly turn into hard choices: which equipment can keep running, how long the battery will last, and whether medicines stay within their safe temperature range. SURGE brings those two challenges into one simple, offline-ready dashboard.

## What SURGE does

### Helps teams see their power options

SURGE simulates a hospital running on solar, batteries, and the grid. When the grid goes down, the dashboard shows how power is being used by:

- Oxygen and ICU equipment
- Medicine and vaccine refrigeration
- Emergency lighting
- Communications

See each load's discharge curve, estimate how long the battery may last, and try different load allocations to understand the trade-offs. The dashboard helps make the situation clearer; the decision stays with the people caring for patients.

### Helps clinics keep an eye on storage temperatures

SURGE models clinic conditions and medicine and vaccine storage temperatures. It tracks how long each batch spends outside its safe temperature range, so staff can spot a storage excursion and decide what to do next.

## Try the demo

1. Open the dashboard and check the power and storage temperature status.
2. Trigger a grid outage and watch the battery drain across the four loads.
3. Adjust a load and see how the estimated battery runtime changes.
4. Follow the storage temperature and batch exposure as conditions change.
5. Go offline and reload the installed app to see the simulation and saved data continue to work.

## Built for unreliable connectivity

SURGE is an installable progressive web app. Open it once while online to cache the app; after that, the dashboard, simulation, alerts, and saved clinic data are available without a connection.

## How it works

A local simulation models grid, batteries, facility loads, and storage temperatures.
A TypeScript rules engine calculates battery runtime and raises temperature alerts.
The dashboard saves facility data in the browser with `localStorage`.
Open-Meteo ambient temperature data can inform the storage simulation when a connection is available.

## Built with

Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Tremor, Chart.js, Zod, and `@serwist/next`.

## How to use

Download all files,Extract into single folder, run bat file saved as start.surge,update info and make sure no input box is left out for most accurate info, login is in beta stage no authentication yet and username with any password works

## License

MIT. See [LICENSE](LICENSE).
