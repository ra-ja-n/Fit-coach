-- Reusable "buffer" plans a coach keeps in their library and assigns to any
-- client. Coach-scoped only (never pair-scoped): a template is the coach's own
-- content until it is copied into a client's live plan, at which point the copy
-- is governed by the usual pair + active-subscription rules.

CREATE TABLE plan_templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       VARCHAR(8)   NOT NULL CHECK (kind IN ('workout','diet')),
    title      VARCHAR(160) NOT NULL,
    note       TEXT         NOT NULL DEFAULT '',
    days       JSONB,                        -- workout templates: [{name, focus, exercises[]}]
    diet       JSONB,                        -- diet templates:    {targetKcal, meals[], notes}
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Coaches list their library filtered by kind, newest first.
CREATE INDEX idx_plan_templates_coach ON plan_templates(coach_id, kind, updated_at DESC);
