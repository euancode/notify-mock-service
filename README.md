# GOV.UK Notify — mock service

A mock implementation of the [GOV.UK Notify REST API](https://docs.notifications.service.gov.uk/rest-api.html)
for local development and testing: send SMS/email notifications via a Notify-shaped API, watch them
arrive on a live dashboard (with an animated phone for incoming SMS), and read the full API reference
on the docs page. Nothing is really sent — delivery is simulated in memory.

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/euancode/notify-mock-service)

Render's free tier needs no configuration beyond clicking the button — it reads `render.yaml` and
deploys the app automatically. (Free-tier services sleep after inactivity and take a few seconds to
wake back up on the next request.)

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
