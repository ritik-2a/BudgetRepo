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

## Deploying (later)

Any Node 20+ host works (Render, Railway, Fly.io). Set the same env vars, use HTTPS, and
in Atlas → Network Access allow the host's outbound IP. Once on HTTPS, remove
`usesCleartextTraffic` from `mobile/app.json`.
