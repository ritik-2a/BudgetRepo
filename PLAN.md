# Clayfin (Budget & Expense Tracker) — Project Plan

> Status: **v4 — Phases 0–4 built, cloud sync + OTA updates live on Vercel** (2026-11-22). Store builds deferred. Built from the original notes in `Plan`.

## 0. Decisions

| Topic | Decision |
|---|---|
| Framework | React Native + Expo (latest SDK), TypeScript |
| Platforms | Android + iOS |
| Data | Local-first (SQLite on device). Cloud backup/sync to **MongoDB Atlas** via a small backend API (Phase 4) |
| Currency | INR only (₹, Indian digit grouping, e.g. 1,25,000) |
| Mutual funds | Track **amount invested** only. No units, no daily NAV, no API. Optional manual "current value" you update whenever you like |
| Credit cards | Multiple cards, each with its own **billing cycle** (statement day → due day) |

### Important: MongoDB Atlas connection string
The connection string must **never** go inside the mobile app. Anyone can extract it from the APK/IPA and get full read/write access to your database. Atlas's old direct-from-app options (Data API, Device Sync) have also been retired. So:

```
Phone (SQLite) ──HTTPS + JWT──▶ Backend API (Node + Express/Fastify) ──▶ MongoDB Atlas
                                  └─ holds the connection string in an env var
```

- Backend: Node.js + TypeScript + Fastify + official `mongodb` driver, deployed to a free tier (Render / Railway / Fly.io).
- Auth: email + password (bcrypt) issuing JWTs. Only needed once sync is on.
- Sync: each record has `id (UUID)`, `updated_at` and `deleted` (soft delete). The app pushes local changes and pulls server changes since the last sync. Last-write-wins.
- Give me the connection string only when we reach Phase 4. Put it in the backend's `.env` file, never in chat logs or git.

---

## 1. Goal

A personal finance app for Android and iOS that answers four questions every month:

1. How much did I **earn** (salary)?
2. How much did I **spend**, and on what (credit card, travel, bills, food…)?
3. How much did I **invest** (mutual funds), and what is it worth now?
4. Am I **within budget** and **on track for my goals**?

Primary user: you (salary → SIPs + credit card spending + daily commute). Build it for one person first and keep it generic enough to share later.

---

## 2. Review of the original plan

### What's good
- The feature list covers the essentials: expenses, budgets, reports, reminders.
- Section 3 is the most useful part. It describes real needs (credit card, mutual funds, auto/metro) rather than generic features.
- Asking for mainstream libraries and support for current OS versions is the right constraint.

### Problems and gaps

| # | Issue | Why it matters | Fix in this plan |
|---|-------|----------------|------------------|
| 1 | **Credit card double-counting** isn't addressed | If you log a ₹2,000 purchase on the card and later log the ₹2,000 bill payment, you've "spent" ₹4,000 | An **Accounts** model: paying the card bill is a *transfer* (Bank → Card), not an expense (§4) |
| 2 | **Investments mixed with expenses** | A SIP is not money lost. Counting it as spending makes the savings rate look wrong | Separate transaction types: `expense`, `income`, `investment`, `transfer` |
| 3 | **No income / salary tracking** | Without income you can't compute savings rate or "money left this month" | `income` type plus a monthly salary entry (can be recurring) |
| 4 | **"Investment growth" needs live prices** | Growth = current NAV × units − amount invested. The plan doesn't say where NAV comes from | Decided: track amount invested only, with an optional manual current value (§0) |
| 5 | **No recurring transactions** | SIPs, bills, rent and subscriptions repeat every month. Typing them in each time is tedious | Recurring rules that auto-create or remind (§3, Phase 2) |
| 6 | **Login + cloud sync for a single-user app** | Adds a backend, cost and privacy risk on day one | **Local-first** (on-device database). Add MongoDB Atlas sync through a backend in Phase 4 (§0) |
| 7 | **Platform, currency and tech stack not stated** | Every implementation choice depends on them | Decided: Android + iOS, INR, React Native/Expo (§0) |
| 8 | **Claymorphism risks** | Soft pastel shadows often have low text contrast and look odd in dark mode | Clay style for cards and buttons only, WCAG-AA text contrast, dark-mode variant |
| 9 | **No security / privacy** | It's financial data | Biometric/PIN app lock; data stays on device by default |
| 10 | **No MVP / phasing** | "All features" at once is how side projects stall | Four phases, each one usable on its own (§7) |
| 11 | The file opens with pasted chatbot text ("Here is a detailed plan for your project") | Cosmetic | This document replaces it |

---

## 3. Features (final scope)

### Core (MVP)
- **Transactions**: add, edit and delete with amount, type, category, account, date and note. A **Quick Add** sheet takes 2 taps.
- **Types**: Expense · Income · Investment · Transfer.
- **Accounts**: Bank (salary account), Credit Card(s), Cash, UPI wallet, Metro card.
- **Categories** (editable, with icons): Food, Groceries, Bills & Utilities, Shopping, Entertainment, Health, **Travel → Auto / Metro / Cab / Fuel**, Rent, Subscriptions, Other.
- **Quick-travel buttons**: one-tap "Auto ₹__" / "Metro ₹__" that remember the last fare.
- **Monthly budgets** per category plus an overall budget.

### Dashboards
1. **Overall Summary** (home): income, spent, invested and remaining this month; savings rate; budget bars; recent transactions.
2. **Credit Card**: spend this billing cycle per card, outstanding vs limit, due date countdown, category split.
3. **Mutual Funds**: invested this month, total invested (all time), per-fund breakdown, SIPs due/done this month, monthly investment trend. Gain/loss is shown only if you enter a current value manually.
4. **Travel**: auto vs metro vs other this month, daily/weekly trend, average cost per trip.
5. **Goals**: progress bars plus a projected completion date based on your current savings pace.

### Alerts & reminders (local notifications, no server needed)
- Daily "log today's expenses?" reminder at a time you choose.
- Credit card bill due: 5 days, 2 days and on the due date.
- SIP date reminder.
- Budget alerts at 80% and 100% of a category limit.

### Reports & charts
- Pie/donut: spend by category.
- Bar: month-over-month spending.
- Line: cumulative amount invested in mutual funds over time.
- Budget adherence: progress bars and a red/amber/green state.
- Filter by month and custom date range.

### Later / nice-to-have
- Cloud backup & multi-device sync.
- CSV/Excel export and import.
- Home-screen widget for quick add.
- Auto-reading bank SMS: Android only, and Play Store policy restricts SMS permission, so not planned.

---

## 4. Data model (the most important design decision)

All amounts are stored as **integers in paise** (₹1 = 100), never as floats, to avoid rounding errors.

```
accounts        id, name, type(bank|credit_card|cash|wallet|metro_card),
                opening_balance, credit_limit?, statement_day?, due_day?, archived

categories      id, name, icon, color, kind(expense|income|investment), parent_id?

transactions    id, type(expense|income|investment|transfer), amount,
                account_id, to_account_id? (transfers), category_id?,
                fund_id? (investments), date, note, recurring_rule_id?, created_at

budgets         id, category_id? (null = overall), month(YYYY-MM), limit_amount

goals           id, name, target_amount, target_date, linked_account_or_fund?, saved_amount

funds           id, name, sip_amount?, sip_day?, current_value? (manual), current_value_date?

-- every table also has: updated_at, deleted (for later cloud sync); ids are UUIDs

recurring_rules id, template(transaction fields), frequency(monthly|weekly),
                day, next_run, mode(auto_create|remind_only)

reminders       id, kind(daily_log|bill_due|sip|custom), time, account_id?, enabled
```

**How the credit card case works:**
- A purchase on the card is an `expense` with `account = HDFC Card`. It counts toward spending.
- Paying the bill is a `transfer` from Bank to HDFC Card. It does **not** count as spending.
- Card outstanding = sum of card expenses − sum of transfers into the card.
- **Billing cycle**: with `statement_day = 15` and `due_day = 5`, the cycle 16 Oct–15 Nov produces a bill due 5 Dec. The Card dashboard shows the current cycle's spend, the last statement amount, how much of it is paid, and days left until it's due.

**How a SIP works:**
- An `investment` transaction from Bank, linked to `fund_id`. It counts toward "invested", not "spent".
- Total invested in a fund = sum of its investment transactions. No units or NAV.

---

## 5. Tech stack (recommended)

Selection rule from your point 4: well-maintained, widely used libraries with official support for current Android/iOS.

| Concern | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo (latest SDK), TypeScript** | One codebase for Android and iOS, current OS support kept up by Expo, test on your phone instantly with Expo Go |
| Navigation | **expo-router** | File-based tabs and stacks; the Expo standard |
| Local DB | **expo-sqlite + Drizzle ORM** | Real relational DB (needed for the model above), typed queries, migrations |
| State | **Zustand** (+ TanStack Query later for sync calls) | Small, fast, little boilerplate |
| Charts | **victory-native** (Skia-based) or **react-native-gifted-charts** | Smooth, actively maintained |
| Styling (claymorphism) | StyleSheet + shared theme tokens; **expo-linear-gradient** for clay highlights | Clay = rounded corners, soft outer shadow + inner highlight, pastel palette |
| Notifications | **expo-notifications** (local, scheduled) | No backend needed |
| App lock | **expo-local-authentication** | Fingerprint / Face ID / PIN |
| Forms | **react-hook-form + zod** | Validation for amounts and dates |
| Testing | **Jest + React Native Testing Library** | Unit tests for calculations (budgets, card outstanding, MF gains) |
| Build/Release | **EAS Build** | APK/AAB and iOS builds without a Mac for Android |
| Cloud sync (Phase 4) | **Node + Fastify API → MongoDB Atlas** | Keeps the connection string off the phone. See §0 |

### Performance guidelines
- Use FlashList for transaction lists. Paginate by month.
- Compute dashboard totals with SQL aggregates (`SUM … GROUP BY`), not in JavaScript loops.
- Index `transactions(date)`, `(account_id, date)` and `(category_id, date)`.
- Memoise chart data. Keep clay shadows to a small number of surfaces, because heavy shadows are expensive on Android.

---

## 6. App structure

The app lives in `mobile/` (the Phase 4 backend will be `server/`). Routes are under `mobile/src/app/`.

```
src/app/                 # expo-router screens
  (tabs)/
    index.tsx            # Overall Summary dashboard
    transactions.tsx     # list + filters
    add.tsx              # Quick Add (center tab button)
    insights.tsx         # dashboards switcher: Card | MF | Travel | Goals
    settings.tsx
  transaction/[id].tsx
  account/[id].tsx
  fund/[id].tsx
  goal/[id].tsx
src/
  db/          schema.ts, migrations/, queries/
  features/    transactions/, accounts/, budgets/, funds/, goals/, reminders/
  components/  clay/ (ClayCard, ClayButton, ClayInput), charts/
  theme/       tokens.ts (colors, radius, shadows, light/dark)
  lib/         money.ts (paise helpers, ₹ formatting), dates.ts, billing-cycle.ts
  notifications/
  sync/        (Phase 4) push/pull client
tests/
server/        (Phase 4) Fastify API + MongoDB Atlas — separate package
```

---

## 7. Phased roadmap

| Phase | Deliverable | Contents |
|---|---|---|
| **0. Setup** ✅ done 2026-11-21 | App runs on your phone | Expo + TS project, lint/format, theme tokens, clay components, tab navigation, SQLite + migrations |
| **1. MVP** ✅ done | Daily use starts here | Accounts, categories, add/edit/delete transactions, Quick Add with travel buttons, transaction list with filters, Overall Summary dashboard, app lock |
| **2. Money control** ✅ done | Budgets & card | Monthly budgets + 80/100% alerts, Credit Card dashboard (cycle spend, outstanding, due date), bill and daily reminders, recurring transactions |
| **3. Investments & goals** ✅ done | Full picture | Funds, MF dashboard (invested per fund and per month, optional manual current value), SIP reminders, Goals with progress and projections, Travel dashboard |
| **4. Polish** ✅ done | Ready to use | Charts across all dashboards, dark mode, CSV export |
| **5a. Cloud sync** ✅ done | Backup & multi-device | Fastify server on Vercel + MongoDB Atlas, email/password accounts, two-way last-write-wins sync, auto-sync |
| **5b. OTA updates** ✅ done | No reinstalling | expo-updates served by the Vercel server from MongoDB Atlas (GridFS); `npm run publish-update`. GitHub `main` auto-deploys the server |
| **5c. Store builds** ⏸ deferred | Later | Play Store / App Store release builds (signing key, Expo + Apple developer accounts) |

Each phase ends with: working build on device, unit tests for the money calculations, and a short checklist review.

---

## 8. Prerequisites for Phase 0

- Node.js LTS (20 or newer) installed on this PC.
- **Expo Go** app installed on your phone (Android/iOS), with the phone on the same Wi-Fi as the PC.
- iOS App Store release later needs an Apple Developer account ($99/yr). Testing on an iPhone via Expo Go is free.
