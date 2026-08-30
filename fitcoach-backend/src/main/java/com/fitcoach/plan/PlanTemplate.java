package com.fitcoach.plan;

import com.fitcoach.diet.DietContent;
import com.fitcoach.workout.WorkoutDay;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A coach's reusable "buffer" plan. Coach-scoped, not pair-scoped: it is the
 * coach's own library until it is copied into a client's live plan, and that
 * copy is what OwnershipGuard then governs.
 */
@Entity
@Table(name = "plan_templates")
@Getter @Setter @NoArgsConstructor
public class PlanTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private PlanKind kind;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false)
    private String note = "";

    /** Workout templates only. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "days", columnDefinition = "jsonb")
    private List<WorkoutDay> days;

    /** Diet templates only. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "diet", columnDefinition = "jsonb")
    private DietContent diet;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
