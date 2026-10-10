# Credits

## Data

`medicines.js` holds the 500-medicine power-outage priority list. It is generated from the team's `priority.py` ranking of `clinic_medicines_dataset.csv`, which has each medicine's storage class, the days its label allows outside the fridge, and a price. The label text and prices look like they come from US drug labels and public price data.

TEAM: before submitting, write the exact original sources and their licences here (for example openFDA or DailyMed for labels, and CMS NADAC for prices, if that is where they came from). Prices are in USD per the unit shown and cannot be compared across different units.

The sample plan behind the "Fill in sample data" button uses invented numbers. It does not describe any real facility.

## Services

WeatherAPI.com provides the optional forecast behind the power-cut chance, under its free plan. Powered by WeatherAPI.com.

The Sustainable Development Goals are a United Nations initiative: https://sdgs.un.org/goals

## Software

Surge uses plain HTML, CSS and JavaScript and bundles no third-party libraries. Node.js runs the optional local server and the tests. Claude Code (Anthropic) helped develop it, as described in `AI_LOG.md`.

Surge's own code is released under the MIT licence, see `LICENSE`.
