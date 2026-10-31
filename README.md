# Tamil Nadu Gas Safety Monitor
Run: `npm install && npm start` → http://localhost:3000  (Node 18+). No internet needed after `npm install` (no CDN/map libraries).
Env: ADMIN_TOKEN, DEVICE_KEY, SIMULATE=false, STALE_MS, RECOVERY_COUNT, PORT.

## How it works
1. Click **Start monitoring** once (browsers need a click before sound can play).
2. Pick a district → real companies there are listed → click one for details, gas readings and source link.
3. **Live alerts** panel (top) automatically lists every Warning / Critical / Danger with district, company, location and reading, and plays a sound (Warning 2 soft beeps, Critical 3 beeps, Danger siren repeating every 6 s while active; Silence mutes until the next escalation). 🧪 Test alert triggers a simulated Danger.

## What is real vs simulated (important)
- **Company names are real**, in `data/companies.json`, each with a `source` URL (government/press/company documents) and a `note` where the exact address or operating status is unconfirmed. Nothing is invented: districts without a verified record show an empty list. Currently **13 of 38 districts** have records; extend the file (restart to load) or `POST /api/companies`.
- **Gas readings and alert levels are SIMULATED.** No company publishes live gas-sensor data, so true real-time status is only possible with sensors installed at that site and the operator's consent. Simulated alerts are tagged SIMULATED in the UI. Set `SIMULATE=false` and companies show NO SENSOR until real devices report.
- Thresholds in `data.js` are illustrative; set them per applicable standards via `PUT /api/thresholds/:gas`.

## Adding real data
- Company record fields: name, category, district, location, activity, source, note (see existing entries).
- Register sensor: `POST /api/sensors` (x-admin-token) `{companyId,gas,deviceId}`; send reading: `POST /api/readings` (x-device-key) `{deviceId,gas,value}`. `esp32/gas_node.ino` is an example node.
- Production DB schema: `db/schema.sql` (demo server keeps data in memory).
