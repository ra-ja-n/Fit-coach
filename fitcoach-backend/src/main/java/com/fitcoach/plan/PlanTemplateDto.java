package com.fitcoach.plan;

import com.fitcoach.diet.DietContent;
import com.fitcoach.workout.WorkoutDay;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PlanTemplateDto(
        UUID id, UUID coachId, PlanKind kind, String title, String note,
        List<WorkoutDay> days, DietContent diet, Instant updatedAt) {

    public static PlanTemplateDto from(PlanTemplate t) {
        return new PlanTemplateDto(t.getId(), t.getCoachId(), t.getKind(), t.getTitle(),
                t.getNote(), t.getDays(), t.getDiet(), t.getUpdatedAt());
    }
}
