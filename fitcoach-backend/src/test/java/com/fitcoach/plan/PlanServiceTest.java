package com.fitcoach.plan;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.diet.DietCheckoffRepository;
import com.fitcoach.diet.DietContent;
import com.fitcoach.diet.DietItem;
import com.fitcoach.diet.DietMeal;
import com.fitcoach.diet.DietPlan;
import com.fitcoach.diet.DietPlanRepository;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.user.User;
import com.fitcoach.workout.WorkoutCheckoffRepository;
import com.fitcoach.workout.WorkoutDay;
import com.fitcoach.workout.WorkoutExercise;
import com.fitcoach.workout.WorkoutPlan;
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

/**
 * Plans are the highest-value private data in the app, so these tests focus on
 * one question: can anyone outside the pair see or change them?
 *
 * A REAL OwnershipGuard is used (over a mocked SubscriptionRepository) so the
 * tenancy rules under test are the shipped ones, not a re-implementation.
 */
@ExtendWith(MockitoExtension.class)
class PlanServiceTest {

    @Mock WorkoutPlanRepository workoutPlans;
    @Mock DietPlanRepository dietPlans;
    @Mock WorkoutCheckoffRepository workoutChecks;
    @Mock DietCheckoffRepository dietChecks;
    @Mock SubscriptionRepository subscriptions;
    @Mock RealtimePublisher realtime;

    PlanService service;

    final UUID coachId = UUID.randomUUID();
    final UUID clientId = UUID.randomUUID();

    User coach, client, otherCoach, otherClient, admin;

    @BeforeEach
    void setUp() {
        service = new PlanService(workoutPlans, dietPlans, workoutChecks, dietChecks,
                new OwnershipGuard(subscriptions), realtime);
        coach = TestUsers.user(coachId, com.fitcoach.user.UserRole.coach);
        client = TestUsers.user(clientId, com.fitcoach.user.UserRole.client);
        otherCoach = TestUsers.coach();
        otherClient = TestUsers.client();
        admin = TestUsers.admin();
    }

    private Subscription activeSub() {
        Subscription s = new Subscription();
        s.setCoachId(coachId);
        s.setClientId(clientId);
        return s;
    }

    private WorkoutPlan workoutPlan() {
        WorkoutExercise e = new WorkoutExercise();
        e.setName("Squat");
        e.setSets(3);
        e.setReps("8");
        WorkoutDay d = new WorkoutDay();
        d.setName("Day 1");
        d.setExercises(List.of(e));
        WorkoutPlan p = new WorkoutPlan();
        p.setId(UUID.randomUUID());
        p.setCoachId(coachId);
        p.setClientId(clientId);
        p.setTitle("Block 1");
        p.setContent(List.of(d));
        return p;
    }

    // ------------------------------------------------------- cross-tenant ---

    @Test
    @DisplayName("CROSS-TENANT: another coach cannot read this pair's plans (404, not a partial view)")
    void otherCoachCannotReadBundle() {
        assertThatThrownBy(() -> service.bundle(otherCoach, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("NOT_FOUND");
                });
        verify(workoutPlans, never()).findByCoachIdAndClientId(any(), any());
    }

    @Test
    @DisplayName("CROSS-TENANT: another client of the SAME coach cannot read this pair's plans")
    void otherClientOfSameCoachCannotReadBundle() {
        assertThatThrownBy(() -> service.bundle(otherClient, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("CROSS-TENANT: a client of coach B cannot read coach A's plan for them")
    void clientOfDifferentCoachCannotReadBundle() {
        assertThatThrownBy(() -> service.bundle(client, otherCoach.getId(), clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("CROSS-TENANT: a coach cannot write a plan for a client who never subscribed")
    void coachCannotWriteToNonSubscriber() {
        when(subscriptions.findActive(coachId, otherClient.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.saveWorkout(coach, otherClient.getId(),
                new PlanService.SaveWorkoutRequest("Sneaky", List.of(new WorkoutDay()))))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(workoutPlans, never()).save(any());
    }

    // ---------------------------------------------------------- own pair ---

    @Test
    @DisplayName("the pair's coach and client can both read the bundle")
    void pairMembersCanReadBundle() {
        when(workoutPlans.findByCoachIdAndClientId(coachId, clientId))
                .thenReturn(Optional.of(workoutPlan()));
        when(dietPlans.findByCoachIdAndClientId(coachId, clientId)).thenReturn(Optional.empty());
        when(workoutChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of());
        when(dietChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of());

        PlansBundleDto coachView = service.bundle(coach, coachId, clientId);
        PlansBundleDto clientView = service.bundle(client, coachId, clientId);
        assertThat(coachView.workout().title()).isEqualTo("Block 1");
        assertThat(clientView.workout().title()).isEqualTo("Block 1");
        assertThat(coachView.diet()).isNull();
    }

    @Test
    @DisplayName("admin can read any pair but is blocked from writing")
    void adminReadsButCannotWrite() {
        when(workoutPlans.findByCoachIdAndClientId(coachId, clientId)).thenReturn(Optional.empty());
        when(dietPlans.findByCoachIdAndClientId(coachId, clientId)).thenReturn(Optional.empty());
        when(workoutChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of());
        when(dietChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of());
        assertThatCode(() -> service.bundle(admin, coachId, clientId)).doesNotThrowAnyException();

        assertThatThrownBy(() -> service.saveWorkout(admin, clientId,
                new PlanService.SaveWorkoutRequest("Nope", List.of(new WorkoutDay()))))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("EXPIRY RULE: a lapsed pair keeps read access but loses write access")
    void lapsedPairIsReadOnly() {
        when(workoutPlans.findByCoachIdAndClientId(coachId, clientId))
                .thenReturn(Optional.of(workoutPlan()));
        when(dietPlans.findByCoachIdAndClientId(coachId, clientId)).thenReturn(Optional.empty());
        when(workoutChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of());
        when(dietChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of());
        assertThatCode(() -> service.bundle(client, coachId, clientId)).doesNotThrowAnyException();

        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.empty());
        ApiException e = catchThrowableOfType(ApiException.class,
                () -> service.toggleWorkout(client, coachId, 0, 0));
        assertThat(e.getCode()).isEqualTo("SUBSCRIBE_REQUIRED");
        assertThat(e.getMessage()).contains("Subscribe");
    }

    @Test
    @DisplayName("ticking an exercise on an active plan reports day/plan completion")
    void tickingExerciseReportsCompletion() {
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.of(activeSub()));
        when(workoutPlans.findByCoachIdAndClientId(coachId, clientId))
                .thenReturn(Optional.of(workoutPlan()));
        when(workoutChecks.findByCoachIdAndClientIdAndDayAndExercise(coachId, clientId, 0, 0))
                .thenReturn(Optional.empty());
        var tick = new com.fitcoach.workout.WorkoutCheckoff();
        tick.setDay(0);
        tick.setExercise(0);
        when(workoutChecks.findByCoachIdAndClientId(coachId, clientId)).thenReturn(List.of(tick));

        PlanService.ToggleResult r = service.toggleWorkout(client, coachId, 0, 0);
        assertThat(r.done()).isTrue();
        assertThat(r.dayComplete()).isTrue();     // the only exercise of the only day
        assertThat(r.planComplete()).isTrue();
        verify(realtime).publishToPair("plan", coachId, clientId);
    }

    @Test
    @DisplayName("a diet tick on an index outside the plan is rejected")
    void invalidDietIndexRejected() {
        DietItem item = new DietItem();
        DietMeal meal = new DietMeal();
        meal.setItems(List.of(item));
        DietContent content = new DietContent();
        content.setMeals(List.of(meal));
        DietPlan plan = new DietPlan();
        plan.setCoachId(coachId);
        plan.setClientId(clientId);
        plan.setContent(content);

        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.of(activeSub()));
        when(dietPlans.findByCoachIdAndClientId(coachId, clientId)).thenReturn(Optional.of(plan));

        assertThatThrownBy(() -> service.toggleDiet(client, coachId, 5, 0))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("VALIDATION"));
    }
}
