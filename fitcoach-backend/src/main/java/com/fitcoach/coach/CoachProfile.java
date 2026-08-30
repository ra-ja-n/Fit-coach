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

/**
 * 1:1 with {@code users} — the PK *is* the user id, never generated.
 * A coach is only discoverable once {@code status == approved}.
 */
@Entity
@Table(name = "coach_profiles")
@Getter @Setter @NoArgsConstructor
public class CoachProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private String bio = "";

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Array(length = 20)
    @Column(name = "specialties", nullable = false, columnDefinition = "text[]")
    private List<String> specialties = new ArrayList<>();

    @Column(name = "experience_years", nullable = false)
    private int experienceYears;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CoachStatus status = CoachStatus.pending;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
