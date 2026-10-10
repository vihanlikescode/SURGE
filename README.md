# SURGE

SURGE is an offline-ready power-outage planning prototype for hospitals and clinics. It estimates how long a facility's generator and battery can support its ranked services, helps staff plan what to keep powered, and gives clinics a priority view of medicines that need refrigeration.

This folder contains a plain HTML, CSS, and JavaScript app. It does not use Next.js, TypeScript, a database, or a remote login service.

## What it does

- **Facility setup:** Enter a hospital or clinic, location, generator and battery details, and the power needs and priority order of its services.
- **Outage simulation:** Choose which services receive power, then see projected battery and generator-fuel levels and estimated backup runtime.
- **Current status:** Mark grid power off to see which ranked services the available backup can support, how much power remains, and the estimated time remaining. You can set a minimum runtime target.
- **Clinic medicine planning:** Choose a medicine-fridge service and list medicines. SURGE ranks cold-chain medicines using the dataset and assumptions in the app, then estimates exposure after an outage.
- **Optional weather estimate:** With a WeatherAPI.com key, the dashboard shows a weather-based estimate of outage risk for the next hour. This is not a utility outage forecast.
- **Local saving and offline use:** Facility plans are saved in the browser on that device. The installable progressive web app caches its files when served from localhost or HTTPS; the optional weather lookup requires internet access.

## Run SURGE
 You can directly access it at https://surge-ten-xi.vercel.app/
### OR Open the page directly

Double-click `index.html`. This works without installing Node.js. Browser restrictions mean the service worker and app installation are unavailable when opened this way.

### Start the local server

Install [Node.js 18 or newer](https://nodejs.org/), then either double-click `start-surge.bat` on Windows or run:

```sh
node server.js
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Keep the server window open while using the app. The server only listens on the local computer and has no package dependencies.

To try the sample plan, choose a facility type at sign-in, enter demo-only username and password details, then select **Just looking? Fill in sample data**. The sign-in form is a local demo gate, not account security; do not use a real password.

## Optional weather setup

The app runs without a weather key. To enable location suggestions and the weather-based outage-risk estimate:

1. Get a key from [WeatherAPI.com](https://www.weatherapi.com/).
2. Copy `config.example.js` to `config.js` if `config.js` is not already present.
3. Put the key in `config.js` as the value of `weatherApiKey`.

`config.js` is ignored by Git. The key is still visible to anyone who can open the running website, so use only a free key suitable for public browser use. The facility location is sent to WeatherAPI.com for its search and forecast requests.

## How the estimates work

The calculations are in `core.js` and the interface is in `app.js`.

- Backup runtime is projected in 15-minute steps from the entered generator, fuel, battery, and selected service loads. The model does not recharge the battery.
- The current-status plan follows the facility's priority ranks and available backup. A runtime target can limit which services are kept on.
- Clinic medicine priority uses storage and shelf-life information in `medicines.js`, along with price. Unknown storage information is treated cautiously. Fridge hold time is an editable assumption, not a measured reading.
- The optional outage-risk estimate scores forecast weather conditions. It does not have access to utility-grid data and does not predict an actual outage.

## Project files

```text
index.html              App page
app.js                  Interface, local state, and browser storage
core.js                 Outage, runtime, medicine, and weather-score calculations
medicines.js            Medicine data used by clinic planning
styles.css              App styling
manifest.webmanifest    Installable app metadata
sw.js                   Offline cache for the hosted/local-server app
config.example.js       Template for the optional weather key
server.js               Dependency-free local web server
start-surge.bat         Windows launcher
icons/                  App icons
tests/                  Node.js test files
docs/                   Code explanation and presentation materials
AI_LOG.md               AI-use notes
CREDITS.md              Data and third-party credits
LICENSE                 MIT license
```

## Tests

With Node.js 18 or newer, run the project tests with:

```sh
node --test
```

## Safety and limits

SURGE is a planning prototype, not a medical device, electrical controller, or validated engineering tool. Its output depends on user-entered values and model assumptions. Medicine estimates do not determine whether a medicine is safe to use; follow manufacturer guidance and local clinical procedures. Qualified staff must review any equipment shutdown plan, and life-support equipment must not be switched off based on this app. The local sign-in screen does not protect data on a shared device.

## Credits and license

See [CREDITS.md](CREDITS.md) for data and third-party credits, [AI_LOG.md](AI_LOG.md) for AI-use notes, and [LICENSE](LICENSE) for the MIT license.
