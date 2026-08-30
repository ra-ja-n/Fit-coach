package com.fitcoach.payment;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Idempotency ledger. The provider's event id is the primary key, so a
 * redelivery is a duplicate-key insert that we swallow — activation can never
 * run twice for the same event.
 */
@Entity
@Table(name = "webhook_events")
@Getter @Setter @NoArgsConstructor
public class WebhookEvent {

    @Id
    @Column(name = "event_id", length = 120)
    private String eventId;

    @Column(name = "payment_id", nullable = false)
    private UUID paymentId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    @PrePersist
    void onCreate() { processedAt = Instant.now(); }
}
