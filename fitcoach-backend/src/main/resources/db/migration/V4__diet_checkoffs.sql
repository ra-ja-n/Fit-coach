-- Diet counterpart of workout_checkoffs — one tick per (meal, item) per pair.

CREATE TABLE diet_checkoffs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal       INT  NOT NULL CHECK (meal >= 0),
    item       INT  NOT NULL CHECK (item >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id, meal, item)
);
CREATE INDEX idx_diet_checkoffs_pair ON diet_checkoffs(coach_id, client_id);
