# FitCoach — go-live checklist

Status at time of writing: all five refactor steps are complete and on
`arena/01a051d5-fit-coach` (PR #1, 4 commits, `mergeState=CLEAN`, not merged).
`main` is still at `9101930`.

The app side is verified (`tsc --noEmit` exit 0, `expo export --platform web`
exit 0, 1694 modules bundling). **The backend has never been compiled** — the
sandbox that produced this branch had no `java`, `javac`, `mvn`, `docker` or
`psql`, and no Maven wrapper. That single gap is why this is not live.

---

## The prompt

Paste this into a session that has JDK 17, Maven, Docker and Postgres.

```
You are finishing the FitCoach MVP for production. The refactor is done and
reviewed; do NOT rewrite anything. Work in this order and stop to report if a
step fails.

HARD CONSTRAINTS — these are correct, preserve them:
  - security/OwnershipGuard.java, the JWT design, and the mobile app's
    expo-secure-store token handling (lib/secure.ts -> lib/api/tokenStore.ts).
  - src/main/resources/db/migration/V1__init.sql is applied and frozen.
    Schema changes go in new numbered migrations only.
  - The mobile app has no mock or offline fallback by design. Do not add one.
  - Money is integer cents. Never floats.

Repo layout: fitcoach-backend/ (Spring Boot 3.3.5, Java 17) and
fitcoach-mobile/ (Expo SDK 57) are independent siblings. There is no Maven
wrapper — use a local mvn.

TASK 1 — Prove the backend builds.
  cd fitcoach-backend && mvn -B --no-transfer-progress test
  All 10 test classes are @ExtendWith(MockitoExtension.class), so no Spring
  context and no database are needed. Fix any compile or test failure. This
  is the first time this code has been compiled; expect real breakage.

TASK 2 — Enable CI.
  mkdir -p .github/workflows
  git mv docs/github-actions-ci.yml .github/workflows/ci.yml
  Commit and push. The workflow was written and YAML-validated but has never
  executed. Confirm both jobs go green.

TASK 3 — Prove the schema and the tenancy boundary.
  Start Postgres 14+. Run the app so Flyway applies V1__init.sql through
  V5__chat_threads.sql. Confirm `flyway info` shows all five applied and that
  Hibernate's ddl-auto: validate passes against the real schema.
  Then, with two coaches A and B and a client of A:
    - B calls GET /api/progress/client/{clientOfA}  -> must be 404
    - B calls GET /api/chat?coachId=A&clientId=...   -> must be 404
    - B calls GET /api/plans?coachId=A&clientId=...  -> must be 404
    - a client with an EXPIRED subscription sends a chat message -> 403
      SUBSCRIPTION_EXPIRED, and the JSON body carries `data`.
  Report the actual status codes, not the expected ones.

TASK 4 — Payments. This is the only real engineering task.
  There is no payment provider SDK in pom.xml. The webhook is hand-rolled
  HMAC-SHA256 over "eventId + '.' + rawBody" (payment/WebhookSignatureVerifier),
  verified with MessageDigest.isEqual, idempotent on eventId.
  Keep that shape. Add a real provider (Stripe is the natural fit given the
  existing naming): SDK dependency, a checkout-session creation path, and a
  webhook that verifies the provider's own signature scheme before delegating
  to the existing idempotent activation path. Activation must still happen
  ONLY in the webhook — the client polls status and never grants itself access.
  Set fitcoach.payments.simulate-provider=false and confirm
  POST /api/checkout/{id}/pay returns 404.

TASK 5 — Production configuration.
  JWT_SECRET has no default (`secret: ${JWT_SECRET}`) — supply a 256-bit+ value
  from a secrets manager, not a repo file.
  CORS_ORIGINS defaults to http://localhost:3000 — set the real origin(s).
  DATABASE_PASSWORD defaults to "fitcoach" — override it.
  Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_WS_URL to the deployed URLs (wss://).

TASK 6 — Ship artifacts.
  There is no Dockerfile, compose file or IaC in the repo. Add a multi-stage
  Dockerfile for the backend (JRE 17 runtime) and a docker-compose.yml with
  Postgres + the service for local parity.
  fitcoach-mobile/app.json declares no icon and no android.adaptiveIcon, and
  there is no assets/ directory. Add a 1024x1024 icon, a favicon, and adaptive
  icon layers before any eas build.

Definition of done: mvn test green in CI; the four tenancy/subscription checks
in TASK 3 return the stated codes against a running instance; a real payment
provider activates a subscription end to end in test mode; the app boots with
production secrets and serves a signed-in client over HTTPS.
```

---

## The checklist

### Blocker — nothing else matters until this passes

- [ ] **`mvn -B test` passes.** ~140 Java files and 10 test classes have never
      been compiled. `java`, `javac`, `mvn`, `docker`, `psql` and `mvnw` are all
      absent from the sandbox that wrote this code.

### High — required before any public deployment

- [ ] **CI enabled.** `git mv docs/github-actions-ci.yml .github/workflows/ci.yml`
      and push. The file is written and YAML-validated but has never run; the
      branch's GitHub App token lacks the `workflows` scope, so this needs a
      normal push.
- [ ] **Flyway applies cleanly to a real Postgres.** `V1` through `V5`, and
      `ddl-auto: validate` passes against the resulting schema.
- [ ] **Cross-tenant access returns 404.** Confirmed by hand, not just by
      `OwnershipGuardTest`. Coach B reading coach A's client must get 404, not
      403.
- [ ] **Expired subscription returns 403 `SUBSCRIPTION_EXPIRED` with `data`**
      on the response body, for chat send and progress log.
- [ ] **A real payment provider is wired.** Zero Stripe/Razorpay/PayPal
      dependencies in `pom.xml` today. `STRIPE_WEBHOOK_SECRET` defaults to
      empty; `simulate-provider` defaults to false. Webhook-only, idempotent
      activation must be preserved.
- [ ] **`JWT_SECRET` supplied** — 256-bit+, from a secrets manager. No default
      exists, so the service will not boot without it.
- [ ] **`CORS_ORIGINS` set** to the real origin(s); default is
      `http://localhost:3000`.
- [ ] **`DATABASE_PASSWORD` overridden**; default is `fitcoach`.

### Medium — needed to ship the mobile app

- [ ] **App icons.** `app.json` has no `icon` and no `android.adaptiveIcon`;
      there is no `assets/` directory. `eas.json` is present, so a build today
      would ship Expo placeholder art.
- [ ] **`EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL`** pointed at production
      (`https://` and `wss://`). These are inlined at bundle time — rebuild
      after changing them.
- [ ] **Store listing metadata** — `app.json` name is now `FitCoach` and slug
      `fitcoach`, but there is no splash screen, no description, no privacy
      policy URL.

### Low — operational hardening

- [ ] **Deployment artifacts.** No Dockerfile, no docker-compose, no Terraform
      anywhere in the repo.
- [ ] **Merged to `main`.** PR #1 is `MERGEABLE` / `CLEAN` but `main` is still
      at `9101930`.
- [ ] **Rate limiting and lockout review** on the auth endpoints.
- [ ] **Backups and monitoring** for Postgres; structured logging is already
      configured at `com.fitcoach.security: INFO`.
- [ ] **Cosmetic debt carried in the PR:** `components/subscription/` could fold
      into `components/coach/`; `ProgressScreen` is 160 lines against a ~150
      target (every other screen is under it).

### Verified already — do not redo

- `npx tsc --noEmit` → exit 0
- `npx expo export --platform web` → exit 0, 3.1 MB, 1694 modules
- `expo-doctor` 19/21 (the 2 failures need the Expo API / RN Directory, which
  the sandbox could not reach)
- Dead backend → `NetworkError | status=0 | code=NETWORK_ERROR`; no mock fallback
- All 38 `ROUTES` ops resolve to a real method + path
- Exactly one `fetch()` call site (`lib/api/http.ts:63`), one `new WebSocket`
  (`lib/api/realtime.ts:71`)
- Zero `: any` / `as any` in the mobile app; no screen over 160 lines
- Zero references to the deleted `lib/api/server.ts` and `lib/api/db.ts`
- Token writes go through `expo-secure-store` only:
  `lib/secure.ts` → `lib/api/tokenStore.ts` → `api.ts` + `authStore.ts`
