# Budget Tracker sync server

Small Fastify API that stores the app's data in MongoDB Atlas. The phone never sees the
database password; it only talks to this server with an email/password account.

## Run locally (testing on home Wi-Fi)

```bash
cd server
npm install
cp .env.example .env      # fill in MONGODB_URI and JWT_SECRET
npm start                 # listens on 0.0.0.0:4000
```

In the app: **Settings → Cloud sync**, server address `http://<PC Wi-Fi IP>:4000`
(e.g. `192.168.1.9:4000`), then create an account. If the phone can't connect, allow Node.js
through Windows Firewall on private networks.

## Test

```bash
npm test   # runs against MONGODB_URI using a temporary database that is dropped afterwards
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | – | `{ ok }` |
| POST | `/auth/register` | `{ email, password }` | `{ token, email }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, email }` |
| POST | `/sync` (Bearer) | `{ cursor, changes[] }` | `{ cursor, more, applied, changes[] }` |

Conflicts: last write wins on each row's `updatedAt`. Pull uses a per-user sequence cursor.

## Production (Vercel)

Live at **https://budget-tracker-ritik.vercel.app** (project `budget-tracker-ritik`).
`api/index.js` wraps the Fastify app as a serverless function; `vercel.json` routes every
path to it except `/ota/*`, which is served as static files.

Secrets are Vercel environment variables (`MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`), never
uploaded files (`.vercelignore` excludes `.env`). To change one:

```bash
npx vercel env rm MONGODB_URI production
npx vercel env add MONGODB_URI production   # paste the new value when asked
npm run deploy
```

## OTA app updates

The app uses `expo-updates` pointed at `/updates/manifest` on this server. To ship a JS/UI
change without a new APK:

```bash
cd server
npm run publish-update -- --message "What changed"
```

This bundles `mobile/`, writes the manifest into `updates/<runtime>/android.json`, copies
the bundle to `public/ota/...` (keeps the 3 newest), and deploys to Vercel. Phones download
it the next time the app opens and show **Restart** to apply it.

Build a new APK instead (and bump `version` in `mobile/app.json`) when you add or upgrade a
native module; phones only accept updates built for their runtime version.
