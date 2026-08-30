package com.fitcoach.plan;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.diet.DietCheckoffRepository;
import com.fitcoach.diet.DietPlanRepository;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.user.User;
import com.fitcoach.workout.WorkoutCheckoffRepository;
import com.fitcoach.workout.WorkoutDay;
import com.fitcoach.workout.WorkoutPlanRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Template library tenancy: coach A's library is invisible to coach B. */
@ExtendWith(MockitoExtension.class)
class PlanTemplateServiceTest {

    @Mock PlanTemplateRepository templates;
    @Mock WorkoutPlanRepository workoutPlans;
    @Mock DietPlanRepository dietPlans;
    @Mock WorkoutCheckoffRepository workoutChecks;
    @Mock DietCheckoffRepository dietChecks;
    @Mock SubscriptionRepository subscriptions;
    @Mock RealtimePublisher realtime;

    PlanTemplateService service;
    User coach = TestUsers.coach();
    User otherCoach = TestUsers.coach();
    User client = TestUsers.client();

    @BeforeEach
    void setUp() {
        service = new PlanTemplateService(templates, workoutPlans, dietPlans, workoutChecks,
                dietChecks, new OwnershipGuard(subscriptions), realtime);
    }

    private PlanTemplate template(UUID ownerId) {
        PlanTemplate t = new PlanTemplate();
        t.setId(UUID.randomUUID());
        t.setCoachId(ownerId);
        t.setKind(PlanKind.workout);
        t.setTitle("Foundation");
        t.setDays(List.of(new WorkoutDay()));
        return t;
    }

    @Test
    @DisplayName("CROSS-TENANT: coach B cannot assign coach A's template to anyone")
    void cannotAssignAnotherCoachesTemplate() {
        PlanTemplate theirs = template(coach.getId());
        // Scoped lookup by (id, coachId) — the row does not exist for this coach.
        when(templates.findByIdAndCoachId(theirs.getId(), otherCoach.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assign(otherCoach, theirs.getId(), client.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(workoutPlans, never()).save(any());
    }

    @Test
    @DisplayName("CROSS-TENANT: coach B cannot edit coach A's template")
    void cannotEditAnotherCoachesTemplate() {
        when(templates.findByIdAndCoachId(any(UUID.class), eq(otherCoach.getId())))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.save(otherCoach,
                new PlanTemplateService.SaveTemplateRequest(UUID.randomUUID(), PlanKind.workout,
                        "Stolen", "", null, null)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("a client role cannot use the template library at all")
    void clientsCannotUseTemplates() {
        assertThatThrownBy(() -> service.list(client))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("assigning to a non-subscribed client is rejected before any plan is written")
    void assignRequiresActiveSubscription() {
        PlanTemplate mine = template(coach.getId());
        when(templates.findByIdAndCoachId(mine.getId(), coach.getId())).thenReturn(Optional.of(mine));
        when(subscriptions.findActive(coach.getId(), client.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assign(coach, mine.getId(), client.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(workoutPlans, never()).save(any());
    }

    @Test
    @DisplayName("assigning to an active subscriber copies the template into their live plan")
    void assignCopiesIntoLivePlan() {
        PlanTemplate mine = template(coach.getId());
        Subscription sub = new Subscription();
        when(templates.findByIdAndCoachId(mine.getId(), coach.getId())).thenReturn(Optional.of(mine));
        when(subscriptions.findActive(coach.getId(), client.getId())).thenReturn(Optional.of(sub));
        when(workoutPlans.findByCoachIdAndClientId(coach.getId(), client.getId()))
                .thenReturn(Optional.empty());

        service.assign(coach, mine.getId(), client.getId());

        verify(workoutPlans).save(argThat(p ->
                p.getClientId().equals(client.getId()) && "Foundation".equals(p.getTitle())));
        verify(workoutChecks).deleteForPair(coach.getId(), client.getId());
        verify(realtime).publishToPair("plan", coach.getId(), client.getId());
    }
}
