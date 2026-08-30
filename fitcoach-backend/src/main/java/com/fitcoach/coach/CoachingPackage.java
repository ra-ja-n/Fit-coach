package com.fitcoach.coach;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A purchasable coaching offer. Money is cents (BIGINT) — never float. */
@Entity
@Table(name = "packages")
@Getter @Setter @NoArgsConstructor
public class CoachingPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "price_cents", nullable = false)
    private long priceCents;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Array(length = 20)
    @Column(name = "features", nullable = false, columnDefinition = "text[]")
    private List<String> features = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
