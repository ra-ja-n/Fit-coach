# FitCoach

A coach-business / client-coaching MVP: coaches sell packages, publish workout and
nutrition plans, chat with clients and track their progress; clients subscribe,
follow plans, check work off and log progress.

The repository holds **two independent sibling projects**. Neither references the
other's files or assumes anything about where it is checked out — they talk over
HTTP and WebSocket only.

| Directory          | What it is                                              |
| -------------------- | ------------------------------------------------------- |
| `fitcoach-mobile/` | Expo / React Native app (client, coach and admin roles) |
| `fitcoach-backend/`| Spring Boot 3 + PostgreSQL API                          |

---

## Running the backend

Requirements: **JDK 17**, **Maven 3.8+**, **PostgreSQL 14+**.

There is **no Maven wrapper** in this repo (`mvnw` does not exist), so use a
locally installed `mvn`.

```bash
cd fitcoach-backend

export JWT_SECRET="change-me-to-a-256-bit-or-longer-secret"
export DATABASE_URL="jdbc:postgresql://localhost:5432/fitcoach"
export DATABASE_USER="fitcoach"
export DATABASE_PASSWORD="fitcoach"

# Plain:
mvn spring-boot:run

# Or with the dev profile (payment-provider simulation on, CORS open for the
# Expo dev servers, and demo data seeded when DEV_SEED_PASSWORD is set):
DEV_SEED_PASSWORD="dev-seed-password" SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

mvn test          # unit tests (cross-pair denial, webhook idempotency, …)
```

The schema is owned by **Flyway** (`src/main/resources/db/migration`). Hibernate
runs with `ddl-auto: validate`, so it never creates or alters tables. `V1__init.sql`
is frozen — new tables go in new numbered migrations.

`fitcoach-backend/README.md` documents the domain layout, every route, the
ownership rules and the payment flow.

---

## Running the mobile app

Requirements: **Node 20+**, `npm`.

```bash
cd fitcoach-mobile
npm install
cp .env.example .env      # then set the two URLs
npm start                 # Expo dev server (scan the QR with Expo Go)
npm run web               # or open it in a browser
```

`.env` needs:

```
EXPO_PUBLIC_API_URL=http://localhost:8080
EXPO_PUBLIC_WS_URL=http://localhost:8080/ws
```

From an **Android emulator** `localhost` is the device itself — use
`http://10.0.2.2:8080`. From an **iOS simulator** `localhost` works.

There is deliberately **no offline or mock fallback**: if the backend is down the
app shows a real network error. That is the point — a silent mock would hide
broken wiring.

### App icons

`app.json` declares no `icon`, `favicon` or `android.adaptiveIcon` — the repo
ships without an `assets/` directory, so Expo falls back to its defaults. That is
fine for `expo start` and for web, but **add real icons before a native build**
(`eas build` / `expo prebuild` will otherwise use Expo's placeholder art):

```jsonc
"icon": "./assets/icon.png",                 // 1024x1024
"web": { "favicon": "./assets/favicon.png" },
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#0E7C5A",            // theme/tokens.ts -> C.primary
    "foregroundImage": "./assets/android-icon-foreground.png"
  }
}
```

---

## How the two sides fit together

- **Auth** — email + password → short-lived access token + long-lived refresh
  token (BCrypt and lockout live in the backend). The mobile app never hashes a
  password and stores no credentials.
- **Token storage** — `lib/secure.ts` is the only place tokens are written, and it
  uses **`expo-secure-store`** on device (AsyncStorage is used only on web, where
  there is no secure enclave). `lib/api/tokenStore.ts` is its only caller.
- **Authorisation** — every endpoint that touches a coach–client pair goes through
  `OwnershipGuard`. A coach asking about someone else's client gets a **404**, not
  a 403: the resource is treated as non-existent rather than forbidden.
- **Realtime** — chat uses STOMP over WebSocket (`/ws`). The client authenticates
  on the CONNECT frame; messages are delivered to a per-pair queue. REST history
  and the WebSocket share the same `ChatService.send`, so no write path can skip
  the subscription guard.
- **Payments** — a subscription is activated **only** by the payment webhook,
  which is HMAC-verified and idempotent on `eventId`. The client polls for status;
  it can never grant itself access.
- **Expired subscriptions** — plans, progress and chat history stay **readable**;
  messaging, plan edits and check-offs are refused. The UI reflects that with the
  same locked-state treatment everywhere.

---

## Mobile layout

```
fitcoach-mobile/
  App.tsx              role-based navigation + session bootstrap
  navigation/          native-stack + tab navigators, param-list types
  screens/             one file per screen — data fetching and layout only
  components/
    ui/                design-system primitives (Button, Card, Field, TopBar, …)
    plan/              plan building and client-side plan rendering
    progress/          progress chart, photos, check-in sheet, history rows
    coach/             coach-side client cards, profile and package editors
    chat/              message bubbles, input bar, locked-state bar
    subscription/      renew notice, coach summary card, checkout pieces
  lib/api/             the only network layer — endpoints, transport, realtime
  lib/secure.ts        SecureStore wrapper (tokens only)
  state/               zustand stores (auth session, toasts)
  theme/tokens.ts      colours, radii, spacing, shadows, typography
```

Conventions that are enforced by review, not tooling:

- Screens fetch data and compose components. Reusable UI lives in `components/`.
- No screen should grow past roughly 150 lines — if it does, the repeated block is
  a component waiting to be extracted.
- Colours, radii and spacing come from `theme/tokens.ts`. No raw hex values in
  screens or components.
- No `any`. Use the real type from `lib/api/types.ts`, or leave a comment
  explaining why a type cannot be expressed.
- Every request goes through `request(op, payload)` in `lib/api/api.ts`, and every
  `op` is declared in `lib/api/endpoints.ts`. There is no `fetch` call anywhere
  else in the app.

## Backend layout

```
fitcoach-backend/src/main/java/com/fitcoach/
  auth/ user/ subscription/      accounts, JWT, the coach–client pair
  coach/                         coach profile, packages, public discovery
  workout/ diet/ plan/           plan templates, plan content, check-offs
  tracking/                      progress entries
  chat/                          threads, REST history, STOMP handler
  payment/                       checkout + signature-verified webhook
  admin/                         approvals, suspension (read-only otherwise)
  security/                      OwnershipGuard, JWT filter, STOMP principal
  common/ config/ scheduled/     error envelope, security config, jobs
```

Money is stored as **integer cents**, never floats. Plan content is stored as
PostgreSQL `jsonb`; the API flattens it into typed DTOs.

---

## Continuous integration

There is **no CI on this repository yet**. A ready-to-enable workflow lives at
[`docs/github-actions-ci.yml`](docs/github-actions-ci.yml) — it runs
`mvn -B test` for the backend and `tsc --noEmit` + `expo export` for the app.

It is parked outside `.github/workflows/` because the branch it was written on
runs under a GitHub App token without the `workflows` scope, and GitHub rejects
workflow changes from such a token. To turn it on:

```bash
mkdir -p .github/workflows
git mv docs/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "Enable CI"
git push
```

Until that happens, `mvn test` is the check that has never been run against the
backend — please run it locally before merging.
