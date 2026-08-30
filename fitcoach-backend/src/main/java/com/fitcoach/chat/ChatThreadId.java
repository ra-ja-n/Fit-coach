package com.fitcoach.chat;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Composite key for {@link ChatThread} — a thread *is* a coach-client pair. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ChatThreadId implements Serializable {
    private UUID coachId;
    private UUID clientId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ChatThreadId other)) return false;
        return Objects.equals(coachId, other.coachId) && Objects.equals(clientId, other.clientId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(coachId, clientId);
    }
}
