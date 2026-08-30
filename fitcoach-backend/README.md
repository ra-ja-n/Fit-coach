# fitcoach-backend

FitCoach backend — Spring Boot 3, Java 17. Step 1 (Auth & roles + OwnershipGuard) is implemented end-to-end; remaining MVP domains plug into the same guard.

## Run

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/fitcoach
export DATABASE_USER=fitcoach
export DATABASE_PASSWORD=fitcoach
export JWT_SECRET=$(openssl rand -hex 32)          # >= 32 bytes
export CORS_ORIGINS=http://localhost:8081
export STRIPE_WEBHOOK_SECRET=whsec_xxx
mvn spring-boot:run
```

Flyway applies `db/migration/V1__init.sql` on boot. Hibernate runs in `validate` mode — every schema change is a NEW migration file.

## Tests

```bash
mvn test
```

Top priority: `security/OwnershipGuardTest` — cross-tenant reads return 404 identical to missing resources, writes require an active subscription, lapsed pairs are read-only, admins can never write.

## Security model

- `security/OwnershipGuard.java` is the single source of truth for coach/client scoping. Every private controller calls it before returning data.
- Every private table denormalizes `coach_id` + `client_id`; ownership checks are one indexed lookup, never a multi-table join.
- JWT: ~15 min access + ~30 days rotating refresh. Refresh rows live in `refresh_tokens`; logout / admin force-logout revoke server-side.
- BCrypt hashing; generic "incorrect email or password"; lockout after 5 failed attempts (security-logged).
- Payments (step 3) activate subscriptions ONLY via signature-verified, idempotent webhook (`webhook_events` dedupe table).
