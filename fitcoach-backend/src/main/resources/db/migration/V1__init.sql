-- FitCoach MVP schema. UUID PKs + timestamps everywhere.
-- Every private table denormalizes coach_id + client_id so ownership checks
-- are a single indexed lookup on the security-critical path.

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role           VARCHAR(16)  NOT NULL CHECK (role IN ('admin','coach','client')),
    name           VARCHAR(120) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(120) NOT NULL,               -- BCrypt, never logged
    suspended      BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_attempts INT         NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE coach_profiles (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio              TEXT         NOT NULL DEFAULT '',
    specialties      TEXT[]       NOT NULL DEFAULT '{}',
    experience_years INT          NOT NULL DEFAULT 0,
    status           VARCHAR(16)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE packages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(120) NOT NULL,
    price_cents   BIGINT       NOT NULL CHECK (price_cents >= 0),  -- smallest unit, never float
    duration_days INT          NOT NULL CHECK (duration_days > 0),
    features      TEXT[]       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_coach ON packages(coach_id);

CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id      UUID NOT NULL REFERENCES users(id),
    coach_id       UUID NOT NULL REFERENCES users(id),
    package_id     UUID NOT NULL REFERENCES packages(id),
    amount_cents   BIGINT NOT NULL,
    status         VARCHAR(16) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','captured','failed','refunded')),
    provider_ref   VARCHAR(120),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES users(id),
    coach_id    UUID NOT NULL REFERENCES users(id),
    package_id  UUID NOT NULL REFERENCES packages(id),
    status      VARCHAR(16) NOT NULL CHECK (status IN ('active','expired','cancelled')),
    start_date  TIMESTAMPTZ NOT NULL,
    end_date    TIMESTAMPTZ NOT NULL,
    payment_id  UUID REFERENCES payments(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ground truth for access control: one active subscription per pair.
CREATE UNIQUE INDEX uniq_one_active_sub_per_pair
    ON subscriptions (client_id, coach_id) WHERE status = 'active';
CREATE INDEX idx_subs_coach_status ON subscriptions(coach_id, status);
CREATE INDEX idx_subs_client_status ON subscriptions(client_id, status);
CREATE INDEX idx_subs_end_date ON subscriptions(end_date) WHERE status = 'active';

CREATE TABLE workout_plans (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES users(id),
    client_id  UUID NOT NULL REFERENCES users(id),
    title      VARCHAR(160) NOT NULL,
    content    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id)
);
CREATE INDEX idx_workout_plans_pair ON workout_plans(coach_id, client_id);

CREATE TABLE diet_plans (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES users(id),
    client_id  UUID NOT NULL REFERENCES users(id),
    title      VARCHAR(160) NOT NULL,
    content    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id)
);
CREATE INDEX idx_diet_plans_pair ON diet_plans(coach_id, client_id);

CREATE TABLE progress_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID NOT NULL REFERENCES users(id),
    coach_id     UUID NOT NULL REFERENCES users(id),   -- denormalized: single indexed lookup
    entry_date   DATE NOT NULL,
    weight_kg    NUMERIC(5,2),
    measurements JSONB NOT NULL DEFAULT '{}',
    photo_urls   TEXT[] NOT NULL DEFAULT '{}',
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, coach_id, entry_date)
);
CREATE INDEX idx_progress_pair_date ON progress_entries(coach_id, client_id, entry_date DESC);

CREATE TABLE chat_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES users(id),
    client_id  UUID NOT NULL REFERENCES users(id),
    sender_id  UUID NOT NULL REFERENCES users(id),
    body       TEXT NOT NULL CHECK (char_length(body) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_pair_time ON chat_messages(coach_id, client_id, created_at);

CREATE TABLE refresh_tokens (
    jti        VARCHAR(64) PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE webhook_events (
    event_id   VARCHAR(120) PRIMARY KEY,   -- idempotency key from the provider
    payment_id UUID NOT NULL REFERENCES payments(id),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post-MVP: schema only, for forward compatibility.
CREATE TABLE courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id    UUID NOT NULL REFERENCES users(id),
    title       VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE course_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID NOT NULL REFERENCES courses(id),
    coach_id    UUID NOT NULL REFERENCES users(id),
    client_id   UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id    UUID NOT NULL REFERENCES users(id),
    client_id   UUID NOT NULL REFERENCES users(id),
    starts_at   TIMESTAMPTZ NOT NULL,
    duration_min INT NOT NULL DEFAULT 30,
    status      VARCHAR(16) NOT NULL DEFAULT 'scheduled',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
