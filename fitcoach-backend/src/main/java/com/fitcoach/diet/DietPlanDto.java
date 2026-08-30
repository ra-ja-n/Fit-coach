package com.fitcoach.diet;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Flattens the JSONB body into the shape the mobile app consumes. */
public record DietPlanDto(
        UUID id, UUID coachId, UUID clientId, String title,
        int targetKcal, List<DietMeal> meals, String notes, Instant updatedAt) {

    public static DietPlanDto from(DietPlan p) {
        DietContent c = p.getContent();
        return new DietPlanDto(p.getId(), p.getCoachId(), p.getClientId(), p.getTitle(),
                c.getTargetKcal(), List.copyOf(c.getMeals()),
                c.getNotes() == null ? "" : c.getNotes(), p.getUpdatedAt());
    }
}
