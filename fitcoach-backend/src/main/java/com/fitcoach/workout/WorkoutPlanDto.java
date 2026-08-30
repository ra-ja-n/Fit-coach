package com.fitcoach.workout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Flattens the JSONB body into the shape the mobile app consumes. */
public record WorkoutPlanDto(
        UUID id, UUID coachId, UUID clientId, String title,
        List<WorkoutDay> days, Instant updatedAt) {

    public static WorkoutPlanDto from(WorkoutPlan p) {
        return new WorkoutPlanDto(p.getId(), p.getCoachId(), p.getClientId(),
                p.getTitle(), List.copyOf(p.getContent()), p.getUpdatedAt());
    }
}
