package com.fitcoach.plan;

import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.diet.DietCheckoffRepository;
import com.fitcoach.diet.DietContent;
import com.fitcoach.diet.DietPlan;
import com.fitcoach.diet.DietPlanRepository;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import com.fitcoach.workout.WorkoutCheckoffRepository;
import com.fitcoach.workout.WorkoutPlan;
import com.fitcoach.workout.WorkoutPlanRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A coach's template library, and the assign operation that copies a template
 * into a client's live plan.
 *
 * Library CRUD is coach-scoped (a template is the coach's own content).
 * {@link #assign} crosses into a client's data, so it goes through
 * OwnershipGuard.requireCoachWriteAccess — no active subscription, no assign.
 */
@Service
public class PlanTemplateService {

    private final PlanTemplateRepository templates;
    private final WorkoutPlanRepository workoutPlans;
    private final DietPlanRepository dietPlans;
    private final WorkoutCheckoffRepository workoutChecks;
    private final DietCheckoffRepository dietChecks;
    private final OwnershipGuard guard;
    private final RealtimePublisher realtime;

    public PlanTemplateService(PlanTemplateRepository templates, WorkoutPlanRepository workoutPlans,
                               DietPlanRepository dietPlans, WorkoutCheckoffRepository workoutChecks,
                               DietCheckoffRepository dietChecks, OwnershipGuard guard,
                               RealtimePublisher realtime) {
        this.templates = templates;
        this.workoutPlans = workoutPlans;
        this.dietPlans = dietPlans;
        this.workoutChecks = workoutChecks;
        this.dietChecks = dietChecks;
        this.guard = guard;
        this.realtime = realtime;
    }

    public record SaveTemplateRequest(
            UUID id, PlanKind kind, String title, String note,
            List<com.fitcoach.workout.WorkoutDay> days, DietContent diet) {}

    @Transactional(readOnly = true)
    public List<PlanTemplateDto> list(User coach) {
        requireCoach(coach);
        return templates.findByCoachIdOrderByUpdatedAtDesc(coach.getId())
                .stream().map(PlanTemplateDto::from).toList();
    }

    @Transactional
    public PlanTemplateDto save(User coach, SaveTemplateRequest req) {
        requireCoach(coach);
        if (req.title() == null || req.title().trim().length() < 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Give the template a title");
        }
        PlanTemplate t;
        if (req.id() != null) {
            t = templates.findByIdAndCoachId(req.id(), coach.getId()).orElseThrow(ApiException::notFound);
        } else {
            t = new PlanTemplate();
            t.setCoachId(coach.getId());
            if (req.kind() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "kind is required");
            }
            t.setKind(req.kind());
        }
        t.setTitle(req.title().trim());
        t.setNote(req.note() == null ? "" : req.note());
        if (req.days() != null) t.setDays(req.days());
        if (req.diet() != null) t.setDiet(req.diet());
        return PlanTemplateDto.from(templates.save(t));
    }

    @Transactional
    public void delete(User coach, UUID templateId) {
        requireCoach(coach);
        templates.delete(templates.findByIdAndCoachId(templateId, coach.getId())
                .orElseThrow(ApiException::notFound));
    }

    /**
     * Copies the template into the client's live plan. This is a write into the
     * pair, so it requires an ACTIVE subscription even though the template
     * itself belongs to the coach.
     */
    @Transactional
    public void assign(User coach, UUID templateId, UUID clientId) {
        requireCoach(coach);
        PlanTemplate t = templates.findByIdAndCoachId(templateId, coach.getId())
                .orElseThrow(ApiException::notFound);
        guard.requireCoachWriteAccess(coach, clientId);

        if (t.getKind() == PlanKind.workout && t.getDays() != null && !t.getDays().isEmpty()) {
            WorkoutPlan plan = workoutPlans.findByCoachIdAndClientId(coach.getId(), clientId)
                    .orElseGet(() -> {
                        WorkoutPlan p = new WorkoutPlan();
                        p.setCoachId(coach.getId());
                        p.setClientId(clientId);
                        return p;
                    });
            plan.setTitle(t.getTitle());
            plan.setContent(t.getDays());
            workoutPlans.save(plan);
            workoutChecks.deleteForPair(coach.getId(), clientId);
        } else if (t.getKind() == PlanKind.diet && t.getDiet() != null) {
            DietPlan plan = dietPlans.findByCoachIdAndClientId(coach.getId(), clientId)
                    .orElseGet(() -> {
                        DietPlan p = new DietPlan();
                        p.setCoachId(coach.getId());
                        p.setClientId(clientId);
                        return p;
                    });
            plan.setTitle(t.getTitle());
            plan.setContent(t.getDiet());
            dietPlans.save(plan);
            dietChecks.deleteForPair(coach.getId(), clientId);
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Template has no content");
        }
        realtime.publishToPair("plan", coach.getId(), clientId);
    }

    private void requireCoach(User u) {
        if (u.getRole() != UserRole.coach) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only coaches can do this.");
        }
    }
}
