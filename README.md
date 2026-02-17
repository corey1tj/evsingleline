# EV Single Line

Capture electrical one-line information in preparation for EV charger installation.

## Features

- Site information capture (customer, address, technician)
- Service entrance details (utility, voltage, phase, amperage)
- Main panel documentation (make, model, breaker ratings, available spaces)
- Existing load inventory with common load presets
- Proposed EV charger specification (level, amps, wire sizing, conduit)
- Automatic load calculation summary with capacity warnings
- Export to text or JSON
- Data persists locally in the browser

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

Configured for Netlify. Connect the repository and it will auto-deploy using the settings in `netlify.toml`.
