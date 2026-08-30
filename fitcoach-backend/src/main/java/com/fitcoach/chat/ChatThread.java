package com.fitcoach.chat;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-pair read cursors. Unread counts are *derived* from these two timestamps,
 * never stored, so they can't drift away from the message log.
 */
@Entity
@Table(name = "chat_threads")
@IdClass(ChatThreadId.class)
@Getter @Setter @NoArgsConstructor
public class ChatThread {

    @Id
    @Column(name = "coach_id")
    private UUID coachId;

    @Id
    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "last_read_by_coach", nullable = false)
    private Instant lastReadByCoach;

    @Column(name = "last_read_by_client", nullable = false)
    private Instant lastReadByClient;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant epoch = Instant.EPOCH;
        if (lastReadByCoach == null) lastReadByCoach = epoch;
        if (lastReadByClient == null) lastReadByClient = epoch;
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
