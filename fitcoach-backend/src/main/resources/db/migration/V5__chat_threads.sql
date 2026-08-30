-- Per-pair read cursors. Unread counts are derived from these two timestamps
-- rather than a stored counter, so they can never drift out of sync with the
-- message log.

CREATE TABLE chat_threads (
    coach_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_by_coach  TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
    last_read_by_client TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (coach_id, client_id)
);
CREATE INDEX idx_chat_threads_client ON chat_threads(client_id);
