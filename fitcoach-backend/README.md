# fitcoach-backend

FitCoach backend — Spring Boot 3.3, Java 17, PostgreSQL.

Sibling of `fitcoach-mobile/`. Runs standalone; nothing here depends on the mobile
app existing, and the mobile app talks to this service only over HTTP + STOMP.

## Run

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/fitcoach
export DATABASE_USER=fitcoach
export DATABASE_PASSWORD=fitcoach
export JWT_SECRET=$(openssl rand -hex 32)          # >= 32 bytes
export CORS_ORIGINS=http://localhost:8081
export STRIPE_WEBHOOK_SECRET=$(openssl rand -hex 32)
mvn spring-boot:run
```

Local development with demo data:

```bash
export SPRING_PROFILES_ACTIVE=dev
export DEV_SEED_PASSWORD='pick-a-local-password'   # blank => nothing is seeded
export SIMULATE_PROVIDER=true                      # dev profile sets this already
mvn spring-boot:run
```

Flyway applies `db/migration/V1__init.sql` … `V5__chat_threads.sql` on boot.
Hibernate runs in `validate` mode — the schema is owned by Flyway, so **every
schema change is a new migration file**. Never edit an applied migration.

## Tests

```bash
mvn test
```

The priority suite is the tenancy set. Each domain has a test proving that a
coach or client cannot reach another pair's data:

| Test | What it pins down |
| --- | --- |
| `security/OwnershipGuardTest` | The rules themselves: cross-tenant reads are 404, writes need an active subscription, lapsed pairs are read-only, admins can never write. |
| `security/AuthSecurityTest` | Generic credential errors, lockout after 5 failures, refresh typing, tampered refresh tokens. |
| `coach/CoachServiceTest` | A coach cannot edit or delete another coach's package; pending coaches are not discoverable. |
| `plan/PlanServiceTest` | No one outside the pair reads plans; a coach cannot write to a non-subscriber; expiry is read-only. |
| `plan/PlanTemplateServiceTest` | Coach B cannot read, edit or assign coach A's templates. |
| `tracking/ProgressServiceTest` | A guessed coach id yields an empty history, not someone else's; lapsed clients get a renewal error naming the coach. |
| `chat/ChatServiceTest` | Outsiders cannot read or post into a pair; a lapsed pair can read but not send. |
| `payment/PaymentWebhookServiceTest` | Forged/tampered/missing signatures rejected; a redelivered `eventId` never activates twice; renewal extends instead of duplicating. |
| `subscription/SubscriptionServiceTest` | A client cannot cancel another client's subscription (404, not 403). |
| `admin/AdminServiceTest` | Admins read any pair and write none; nobody else gets in. |

## Domains

| Package | Endpoints |
| --- | --- |
| `auth/` | `POST /api/auth/{register,login,refresh,logout}` |
| `user/` | `GET /api/users/me` |
| `coach/` | `GET /api/coaches`, `GET /api/coaches/{id}` (public) · `GET/PUT /api/coach/profile` · `GET/POST /api/coach/packages`, `DELETE /api/coach/packages/{id}` · `GET /api/packages/{id}` · `GET /api/coach/clients`, `GET /api/coach/clients/{id}`, `GET /api/coach/revenue` |
| `subscription/` | `GET /api/subscriptions`, `POST /api/subscriptions/{id}/cancel` |
| `workout/` + `diet/` | `GET /api/plans`, `PUT /api/plans/workout`, `PUT /api/plans/diet`, `POST /api/plans/{workout,diet}/check` |
| `plan/` | `GET/POST /api/plan-templates`, `DELETE /api/plan-templates/{id}`, `POST /api/plan-templates/{id}/assign` |
| `tracking/` | `GET /api/progress?coachId=`, `GET /api/progress/client/{clientId}`, `POST /api/progress` |
| `chat/` | `GET /api/chat`, `GET /api/chat/context`, `POST /api/chat`, `POST /api/chat/read`, `GET /api/chat/threads`, `GET /api/chat/summary` · STOMP `@MessageMapping("/chat.send")` |
| `payment/` | `POST /api/checkout`, `GET /api/checkout/{id}/status`, `POST /api/checkout/{id}/pay` (dev only) · `POST /api/webhooks/payment` |
| `admin/` | `GET /api/admin/overview`, coach approve/reject, user suspend/reinstate/force-logout, `GET /api/admin/pairs/{coachId}/{clientId}` |

`plan/` is a shared layer rather than one of the PRD's domains: a `PlanTemplate`
holds either workout or diet content, and `GET /api/plans` bundles both kinds
plus their check-offs, so it sits above `workout/` and `diet/` rather than in
either.

## Security model

- `security/OwnershipGuard.java` is the single source of truth for coach/client
  scoping. Every private controller or service calls it before returning data.
- Every private table denormalizes `coach_id` + `client_id`; an ownership check
  is one indexed lookup, never a multi-table join.
- Cross-tenant access is answered **404 `NOT_FOUND`**, identical to a missing
  resource, so a guessed id leaks nothing. Blocked attempts are security-logged.
- Reads need pair access; writes additionally need an **active subscription**.
  A lapsed pair keeps read access and loses writes — surfaced as
  `SUBSCRIBE_REQUIRED` / `SUBSCRIPTION_EXPIRED`, i.e. a renewal prompt.
- Admins may read everything for support and can never write private data.
- JWT: ~15 min access + ~30 days rotating refresh, rows in `refresh_tokens`;
  logout, suspension and admin force-logout revoke server-side.
- BCrypt hashing; generic "incorrect email or password"; lockout after 5 failed
  attempts. No credentials are committed — dev seeding reads `DEV_SEED_PASSWORD`.
- Payments activate subscriptions **only** via the signature-verified,
  idempotent webhook (`webhook_events` dedupe table). `POST /api/checkout/{id}/pay`
  is a dev-profile stand-in for the provider callback; it is off by default and
  returns 404 when disabled.

## Realtime

STOMP endpoint `/ws`. The access token arrives on the **CONNECT frame**, not the
HTTP handshake, because React Native cannot set headers on a WebSocket upgrade
request — `config/StompAuthChannelInterceptor` maps it to a principal.

Destinations, both delivered per user after an ownership check:

- `/user/queue/events` — `{type, coachId, clientId}` cache invalidation
  (`chat` | `progress` | `plan` | `subscription`)
- `/user/queue/chat.{coachId}.{clientId}` — new chat messages
