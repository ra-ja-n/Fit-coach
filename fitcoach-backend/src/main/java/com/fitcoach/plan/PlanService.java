package com.fitcoach.plan;

import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.diet.DietCheckoff;
import com.fitcoach.diet.DietCheckoffRepository;
import com.fitcoach.diet.DietContent;
import com.fitcoach.diet.DietMeal;
import com.fitcoach.diet.DietPlan;
import com.fitcoach.diet.DietPlanDto;
import com.fitcoach.diet.DietPlanRepository;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import com.fitcoach.workout.WorkoutCheckoff;
import com.fitcoach.workout.WorkoutCheckoffRepository;
import com.fitcoach.workout.WorkoutDay;
import com.fitcoach.workout.WorkoutPlan;
import com.fitcoach.workout.WorkoutPlanDto;
import com.fitcoach.workout.WorkoutPlanRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Plan reads and writes for one coach-client pair.
 *
 * Reads  -> OwnershipGuard.requirePairAccess   (lapsed pairs stay read-only)
 * Writes -> OwnershipGuard.requireWriteAccess  (needs an ACTIVE subscription)
 */
@Service
public class PlanService {

    private final WorkoutPlanRepository workoutPlans;
    private final DietPlanRepository dietPlans;
    private final WorkoutCheckoffRepository workoutChecks;
    private final DietCheckoffRepository dietChecks;
    private final OwnershipGuard guard;
    private final RealtimePublisher realtime;

    public PlanService(WorkoutPlanRepository workoutPlans, DietPlanRepository dietPlans,
                       WorkoutCheckoffRepository workoutChecks, DietCheckoffRepository dietChecks,
                       OwnershipGuard guard, RealtimePublisher realtime) {
        this.workoutPlans = workoutPlans;
        this.dietPlans = dietPlans;
        this.workoutChecks = workoutChecks;
        this.dietChecks = dietChecks;
        this.guard = guard;
        this.realtime = realtime;
    }

    // ------------------------------------------------------------- reads ---

    @Transactional(readOnly = true)
    public PlansBundleDto bundle(User actor, UUID coachId, UUID clientId) {
        guard.requirePairAccess(actor, coachId, clientId);
        WorkoutPlanDto workout = workoutPlans.findByCoachIdAndClientId(coachId, clientId)
                .map(WorkoutPlanDto::from).orElse(null);
        DietPlanDto diet = dietPlans.findByCoachIdAndClientId(coachId, clientId)
                .map(DietPlanDto::from).orElse(null);
        List<PlansBundleDto.CheckRef> wChecks = workoutChecks.findByCoachIdAndClientId(coachId, clientId)
                .stream().map(c -> PlansBundleDto.CheckRef.workout(c.getDay(), c.getExercise())).toList();
        List<PlansBundleDto.CheckRef> dChecks = dietChecks.findByCoachIdAndClientId(coachId, clientId)
                .stream().map(c -> PlansBundleDto.CheckRef.diet(c.getMeal(), c.getItem())).toList();
        return new PlansBundleDto(workout, diet, wChecks, dChecks);
    }

    // ------------------------------------------------------------ writes ---

    public record SaveWorkoutRequest(String title, List<WorkoutDay> days) {}
    public record SaveDietRequest(String title, Integer targetKcal, List<DietMeal> meals, String notes) {}

    /** Coach publishes/updates the pair's live workout plan. */
    @Transactional
    public WorkoutPlanDto saveWorkout(User coach, UUID clientId, SaveWorkoutRequest req) {
        requireCoach(coach);
        guard.requireCoachWriteAccess(coach, clientId);
        if (req.title() == null || req.title().trim().length() < 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Give the plan a title");
        }
        if (req.days() == null || req.days().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Add at least one training day");
        }
        WorkoutPlan plan = workoutPlans.findByCoachIdAndClientId(coach.getId(), clientId)
                .orElseGet(() -> {
                    WorkoutPlan p = new WorkoutPlan();
                    p.setCoachId(coach.getId());
                    p.setClientId(clientId);
                    return p;
                });
        plan.setTitle(req.title().trim());
        plan.setContent(req.days());
        WorkoutPlan saved = workoutPlans.save(plan);
        // A new plan invalidates the old tick positions.
        workoutChecks.deleteForPair(coach.getId(), clientId);
        realtime.publishToPair("plan", coach.getId(), clientId);
        return WorkoutPlanDto.from(saved);
    }

    /** Coach publishes/updates the pair's live diet plan. */
    @Transactional
    public DietPlanDto saveDiet(User coach, UUID clientId, SaveDietRequest req) {
        requireCoach(coach);
        guard.requireCoachWriteAccess(coach, clientId);
        if (req.title() == null || req.title().trim().length() < 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Give the plan a title");
        }
        if (req.meals() == null || req.meals().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Add at least one meal");
        }
        DietPlan plan = dietPlans.findByCoachIdAndClientId(coach.getId(), clientId)
                .orElseGet(() -> {
                    DietPlan p = new DietPlan();
                    p.setCoachId(coach.getId());
                    p.setClientId(clientId);
                    return p;
                });
        DietContent content = new DietContent();
        content.setTargetKcal(req.targetKcal() == null ? 0 : req.targetKcal());
        content.setMeals(req.meals());
        content.setNotes(req.notes() == null ? "" : req.notes());
        plan.setTitle(req.title().trim());
        plan.setContent(content);
        DietPlan saved = dietPlans.save(plan);
        dietChecks.deleteForPair(coach.getId(), clientId);
        realtime.publishToPair("plan", coach.getId(), clientId);
        return DietPlanDto.from(saved);
    }

    // ----------------------------------------------- gamified check-offs ---

    public record ToggleResult(boolean done, boolean dayComplete, Boolean planComplete) {}

    /** Client ticks an exercise. Requires an active subscription (it's a write). */
    @Transactional
    public ToggleResult toggleWorkout(User client, UUID coachId, int day, int exercise) {
        requireClient(client);
        guard.requireWriteAccess(client, coachId, client.getId());
        WorkoutPlan plan = workoutPlans.findByCoachIdAndClientId(coachId, client.getId())
                .orElseThrow(ApiException::notFound);
        if (day < 0 || day >= plan.getContent().size()
                || exercise < 0 || exercise >= plan.getContent().get(day).getExercises().size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Invalid exercise");
        }
        var existing = workoutChecks
                .findByCoachIdAndClientIdAndDayAndExercise(coachId, client.getId(), day, exercise);
        boolean done = existing.isEmpty();
        if (done) {
            WorkoutCheckoff c = new WorkoutCheckoff();
            c.setCoachId(coachId);
            c.setClientId(client.getId());
            c.setDay(day);
            c.setExercise(exercise);
            workoutChecks.save(c);
        } else {
            workoutChecks.delete(existing.get());
        }
        List<WorkoutCheckoff> all = workoutChecks.findByCoachIdAndClientId(coachId, client.getId());
        long dayDone = all.stream().filter(c -> c.getDay() == day).count();
        int dayTotal = plan.getContent().get(day).getExercises().size();
        int planTotal = plan.getContent().stream().mapToInt(d -> d.getExercises().size()).sum();
        realtime.publishToPair("plan", coachId, client.getId());
        return new ToggleResult(done, done && dayDone == dayTotal, done && all.size() == planTotal);
    }

    /** Client ticks a food item. {@code dayComplete} = the whole day's plan is done. */
    @Transactional
    public ToggleResult toggleDiet(User client, UUID coachId, int meal, int item) {
        requireClient(client);
        guard.requireWriteAccess(client, coachId, client.getId());
        DietPlan plan = dietPlans.findByCoachIdAndClientId(coachId, client.getId())
                .orElseThrow(ApiException::notFound);
        List<DietMeal> meals = plan.getContent().getMeals();
        if (meal < 0 || meal >= meals.size() || item < 0 || item >= meals.get(meal).getItems().size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Invalid item");
        }
        var existing = dietChecks.findByCoachIdAndClientIdAndMealAndItem(coachId, client.getId(), meal, item);
        boolean done = existing.isEmpty();
        if (done) {
            DietCheckoff c = new DietCheckoff();
            c.setCoachId(coachId);
            c.setClientId(client.getId());
            c.setMeal(meal);
            c.setItem(item);
            dietChecks.save(c);
        } else {
            dietChecks.delete(existing.get());
        }
        int total = meals.stream().mapToInt(m -> m.getItems().size()).sum();
        long checked = dietChecks.countByCoachIdAndClientId(coachId, client.getId());
        realtime.publishToPair("plan", coachId, client.getId());
        return new ToggleResult(done, done && checked == total, null);
    }

    private void requireCoach(User u) {
        if (u.getRole() != UserRole.coach) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only coaches can do this.");
        }
    }

    private void requireClient(User u) {
        if (u.getRole() != UserRole.client) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only clients can do this.");
        }
    }
}
