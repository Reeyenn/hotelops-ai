# HotelOps AI — Choice Advantage Scraper

Playwright script that logs into Choice Advantage every 15 minutes and writes live room status data to Firebase Firestore.

## Setup

```bash
cd scraper
npm install
npx playwright install chromium
cp .env.example .env
# Fill in .env with real values
```

## Environment Variables

| Variable | Value |
|---|---|
| `CA_USERNAME` | `bcobbs.txa32` |
| `CA_PASSWORD` | (get from hotel) |
| `FIREBASE_PROJECT_ID` | From Firebase Console |
| `FIREBASE_CLIENT_EMAIL` | From Service Account |
| `FIREBASE_PRIVATE_KEY` | From Service Account |
| `HOTELOPS_USER_ID` | Firebase UID of the hotel owner account |
| `HOTELOPS_PROPERTY_ID` | Firestore property doc ID for Comfort Suites |

## Getting Firebase Credentials

1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Copy `project_id`, `client_email`, `private_key` into `.env`

## Getting HOTELOPS_USER_ID and PROPERTY_ID

1. Log into HotelOps AI as the hotel owner
2. Firebase Console → Firestore → users → (find the doc) → properties → (find Comfort Suites doc)
3. Copy both IDs into `.env`

## Run locally

```bash
node scraper.js
# or with headed browser for debugging:
HEADED=true node scraper.js
```

## Deploy to Railway

1. Create new Railway project
2. Point to this `/scraper` directory (or push as separate repo)
3. Add all env variables in Railway dashboard
4. Railway uses `railway.toml` for build/start commands automatically

## What it writes to Firestore

Path: `users/{uid}/properties/{pid}/rooms/{YYYY-MM-DD}_{roomNumber}`

Each room document:
```json
{
  "number": "101",
  "type": "checkout",        // checkout | stayover | vacant
  "status": "dirty",         // dirty | clean
  "priority": "standard",
  "assignedTo": null,
  "assignedName": null,
  "date": "2026-03-25",
  "propertyId": "...",
  "isDnd": false,
  "_caRoomType": "SNQQ",
  "_caRoomStatus": "Vacant",
  "_caService": "Check Out",
  "_lastSyncedAt": "..."
}
```

## Error handling

- Session expires → auto re-login
- 0 rooms scraped → logs warning, does not crash
- Any error → logged, process continues to next interval
- Outside 6am–10pm → skips silently
