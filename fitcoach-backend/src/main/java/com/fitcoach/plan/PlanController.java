package com.fitcoach.plan;

import com.fitcoach.diet.DietMeal;
import com.fitcoach.diet.DietPlanDto;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import com.fitcoach.workout.WorkoutDay;
import com.fitcoach.workout.WorkoutPlanDto;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Live plans for a pair, plus the client's gamified check-offs. */
@RestController
@RequestMapping("/api/plans")
public class PlanController {

    private final PlanService plans;

    public PlanController(PlanService plans) {
        this.plans = plans;
    }

    public record SaveWorkoutBody(UUID clientId, String title, List<WorkoutDay> days) {}

    public record SaveDietBody(UUID clientId, String title, Integer targetKcal,
                               List<DietMeal> meals, String notes) {}

    public record WorkoutCheckBody(UUID coachId, Integer day, Integer exercise) {}

    public record DietCheckBody(UUID coachId, Integer meal, Integer item) {}

    /**
     * A coach reads a chosen client's plans; anyone else can only ever read
     * their own. OwnershipGuard re-checks the resulting pair regardless, so
     * this shortcut can't be abused by passing someone else's id.
     */
    @GetMapping
    public PlansBundleDto bundle(@AuthenticationPrincipal User actor,
                                 @RequestParam UUID coachId,
                                 @RequestParam(required = false) UUID clientId) {
        UUID target = actor.getRole() == UserRole.coach ? clientId : actor.getId();
        return plans.bundle(actor, coachId, target);
    }

    @PutMapping("/workout")
    @PreAuthorize("hasRole('COACH')")
    public WorkoutPlanDto saveWorkout(@AuthenticationPrincipal User coach,
                                      @RequestBody SaveWorkoutBody body) {
        return plans.saveWorkout(coach, body.clientId(),
                new PlanService.SaveWorkoutRequest(body.title(), body.days()));
    }

    @PutMapping("/diet")
    @PreAuthorize("hasRole('COACH')")
    public DietPlanDto saveDiet(@AuthenticationPrincipal User coach,
                                @RequestBody SaveDietBody body) {
        return plans.saveDiet(coach, body.clientId(),
                new PlanService.SaveDietRequest(body.title(), body.targetKcal(), body.meals(), body.notes()));
    }

    @PostMapping("/workout/check")
    @PreAuthorize("hasRole('CLIENT')")
    public PlanService.ToggleResult toggleWorkout(@AuthenticationPrincipal User client,
                                                  @RequestBody WorkoutCheckBody body) {
        return plans.toggleWorkout(client, body.coachId(), body.day(), body.exercise());
    }

    @PostMapping("/diet/check")
    @PreAuthorize("hasRole('CLIENT')")
    public PlanService.ToggleResult toggleDiet(@AuthenticationPrincipal User client,
                                               @RequestBody DietCheckBody body) {
        return plans.toggleDiet(client, body.coachId(), body.meal(), body.item());
    }
}
