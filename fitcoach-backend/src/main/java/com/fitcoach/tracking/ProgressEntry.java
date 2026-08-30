package com.fitcoach.tracking;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One check-in per client per coach per day: UNIQUE(client_id, coach_id, entry_date). */
@Entity
@Table(name = "progress_entries")
@Getter @Setter @NoArgsConstructor
public class ProgressEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    /** Denormalized so the coach's view is a single indexed lookup. */
    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "measurements", nullable = false, columnDefinition = "jsonb")
    private Map<String, Double> measurements = new HashMap<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Array(length = 12)
    @Column(name = "photo_urls", nullable = false, columnDefinition = "text[]")
    private List<String> photoUrls = new ArrayList<>();

    @Column(nullable = false)
    private String notes = "";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
