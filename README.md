# GOV.UK Notify — mock service

A mock implementation of the [GOV.UK Notify REST API](https://docs.notifications.service.gov.uk/rest-api.html)
for local development and testing: send SMS/email notifications via a Notify-shaped API, watch them
arrive on a live dashboard (with an animated phone for incoming SMS), and read the full API reference
on the docs page. Nothing is really sent — delivery is simulated in memory.

## Deploy

Deploy to Render from the command line:

```bash
RENDER_API_KEY=rnd_xxx npm run deploy:render
```

Get an API key from https://dashboard.render.com/u/settings#api-keys, then run the command above.
It creates a free-tier web service pointed at this repo/branch (or triggers a redeploy if the
service already exists) via the Render API — no dashboard clicking required. Optional env vars:

- `RENDER_OWNER_ID` — only needed if your Render account has more than one workspace
- `RENDER_REPO_URL` / `RENDER_BRANCH` — override the auto-detected git remote/branch

Prefer a GUI? Use the [Render Blueprint button](https://render.com/deploy?repo=https://github.com/euancode/notify-mock-service)
instead — it reads the same `render.yaml`.

Free-tier services sleep after inactivity and take a few seconds to wake back up on the next request.

## Run locally

```bash
npm install
npm start
```

Then open:

- `http://localhost:3000` — the live dashboard
- `http://localhost:3000/docs.html` — API documentation

## Quick test

```bash
curl -X POST http://localhost:3000/v2/notifications/sms \
  -H "Authorization: Bearer test_key" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+447700900000",
    "template_id": "8a5e1b3a-0000-4000-8000-000000000001",
    "personalisation": { "code": "482913" }
  }'
```

Watch the dashboard — the message will pop up on the mock phone within a second or two, and its
status will progress from `created` → `sending` → `delivered` (or a simulated failure) automatically.

See `/docs.html` for the full endpoint reference, request/response shapes, and the seeded template IDs.

## Notes

- Data is in-memory only and resets on restart.
- `Authorization` header is required but not cryptographically verified, so the official Notify
  client libraries work against this server unchanged — just point them at its base URL.
- Letters and inbound SMS are not implemented.
