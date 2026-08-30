-- Gamified adherence: a client ticks an exercise off inside their live workout
-- plan. Denormalized coach_id + client_id so the coach's adherence view and the
-- ownership check are both a single indexed lookup.

CREATE TABLE workout_checkoffs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day        INT  NOT NULL CHECK (day >= 0),
    exercise   INT  NOT NULL CHECK (exercise >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One tick per (plan position, pair); re-ticking is an un-tick, not a dupe.
    UNIQUE (coach_id, client_id, day, exercise)
);
CREATE INDEX idx_workout_checkoffs_pair ON workout_checkoffs(coach_id, client_id);
