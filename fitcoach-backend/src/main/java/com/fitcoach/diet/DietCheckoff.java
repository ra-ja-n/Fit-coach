package com.fitcoach.diet;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A client's tick on one food item of their live diet plan. */
@Entity
@Table(name = "diet_checkoffs")
@Getter @Setter @NoArgsConstructor
public class DietCheckoff {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(nullable = false)
    private int meal;

    @Column(nullable = false)
    private int item;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }
}
