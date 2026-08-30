package com.fitcoach.coach;

import com.fitcoach.chat.ChatService;
import com.fitcoach.common.ApiException;
import com.fitcoach.diet.DietPlan;
import com.fitcoach.diet.DietPlanRepository;
import com.fitcoach.diet.DietCheckoffRepository;
import com.fitcoach.payment.Payment;
import com.fitcoach.payment.PaymentRepository;
import com.fitcoach.payment.PaymentStatus;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.tracking.ProgressEntry;
import com.fitcoach.tracking.ProgressEntryRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import com.fitcoach.workout.WorkoutPlan;
import com.fitcoach.workout.WorkoutPlanRepository;
import com.fitcoach.workout.WorkoutCheckoffRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The coach's dashboard: their client roster, one client's detail view, and
 * their revenue. Every read is scoped to the signed-in coach's own id, and the
 * per-client reads go through OwnershipGuard as well — a coach asking about a
 * client who never subscribed to them gets a 404, not an empty page.
 */
@Service
public class CoachConsoleService {

    private static final long DAY_MS = 86_400_000L;

    private final SubscriptionRepository subscriptions;
    private final CoachingPackageRepository packages;
    private final UserRepository users;
    private final WorkoutPlanRepository workoutPlans;
    private final DietPlanRepository dietPlans;
    private final WorkoutCheckoffRepository workoutChecks;
    private final DietCheckoffRepository dietChecks;
    private final ProgressEntryRepository progress;
    private final PaymentRepository payments;
    private final ChatService chat;
    private final OwnershipGuard guard;

    public CoachConsoleService(SubscriptionRepository subscriptions, CoachingPackageRepository packages,
                               UserRepository users, WorkoutPlanRepository workoutPlans,
                               DietPlanRepository dietPlans, WorkoutCheckoffRepository workoutChecks,
                               DietCheckoffRepository dietChecks, ProgressEntryRepository progress,
                               PaymentRepository payments, ChatService chat, OwnershipGuard guard) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.users = users;
        this.workoutPlans = workoutPlans;
        this.dietPlans = dietPlans;
        this.workoutChecks = workoutChecks;
        this.dietChecks = dietChecks;
        this.progress = progress;
        this.payments = payments;
        this.chat = chat;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public List<CoachConsoleDtos.CoachClientRow> clients(User coach) {
        requireCoach(coach);
        return com.fitcoach.chat.ChatService.bestSubPerClient(
                        subscriptions.findAllForCoach(coach.getId())).stream()
                .map(s -> toRow(coach.getId(), s))
                .toList();
    }

    @Transactional(readOnly = true)
    public CoachConsoleDtos.ClientDetailBundle clientDetail(User coach, UUID clientId) {
        requireCoach(coach);
        guard.requirePairAccess(coach, coach.getId(), clientId);
        Subscription s = subscriptions
                .findFirstByCoachIdAndClientIdOrderByEndDateDesc(coach.getId(), clientId)
                .orElseThrow(ApiException::notFound);

        Optional<WorkoutPlan> workout = workoutPlans.findByCoachIdAndClientId(coach.getId(), clientId);
        Optional<DietPlan> diet = dietPlans.findByCoachIdAndClientId(coach.getId(), clientId);

        return new CoachConsoleDtos.ClientDetailBundle(
                clientId,
                users.findById(clientId).map(User::getName).orElse(""),
                users.findById(clientId).map(User::getEmail).orElse(""),
                s.getStatus(),
                packages.findById(s.getPackageId()).map(CoachingPackage::getTitle).orElse("Coaching plan"),
                s.getStartDate(), s.getEndDate(),
                workout.isPresent(), diet.isPresent(),
                workoutChecks.countByCoachIdAndClientId(coach.getId(), clientId),
                workout.map(p -> (long) p.getContent().stream()
                        .mapToInt(d -> d.getExercises().size()).sum()).orElse(0L),
                dietChecks.countByCoachIdAndClientId(coach.getId(), clientId),
                diet.map(p -> (long) p.getContent().getMeals().stream()
                        .mapToInt(m -> m.getItems().size()).sum()).orElse(0L));
    }

    @Transactional(readOnly = true)
    public CoachConsoleDtos.RevenueSummary revenue(User coach) {
        requireCoach(coach);
        Instant monthStart = LocalDate.now().withDayOfMonth(1)
                .atStartOfDay(ZoneId.systemDefault()).toInstant();
        List<Payment> captured = payments
                .findByCoachIdAndStatusOrderByCreatedAtDesc(coach.getId(), PaymentStatus.captured);
        List<CoachConsoleDtos.RevenueRow> recent = captured.stream().limit(5)
                .map(p -> new CoachConsoleDtos.RevenueRow(
                        p.getId(),
                        users.findById(p.getClientId()).map(User::getName).orElse(""),
                        packages.findById(p.getPackageId()).map(CoachingPackage::getTitle).orElse(""),
                        p.getAmountCents(), p.getCreatedAt()))
                .toList();
        return new CoachConsoleDtos.RevenueSummary(
                payments.sumCapturedForCoach(coach.getId()),
                payments.sumCapturedForCoachSince(coach.getId(), monthStart),
                subscriptions.countByCoachIdAndStatus(coach.getId(), SubscriptionStatus.active),
                recent);
    }

    private CoachConsoleDtos.CoachClientRow toRow(UUID coachId, Subscription s) {
        UUID clientId = s.getClientId();
        Optional<User> client = users.findById(clientId);
        Optional<ProgressEntry> lastProgress = progress.latestFirst(coachId, clientId).stream().findFirst();
        long daysLeft = (s.getEndDate().toEpochMilli() - Instant.now().toEpochMilli() + DAY_MS - 1) / DAY_MS;
        return new CoachConsoleDtos.CoachClientRow(
                clientId,
                client.map(User::getName).orElse(""),
                client.map(User::getEmail).orElse(""),
                s.getStatus(),
                packages.findById(s.getPackageId()).map(CoachingPackage::getTitle).orElse("Coaching plan"),
                s.getStartDate(), s.getEndDate(), daysLeft,
                workoutPlans.existsByCoachIdAndClientId(coachId, clientId),
                dietPlans.existsByCoachIdAndClientId(coachId, clientId),
                lastProgress.map(ProgressEntry::getCreatedAt).orElse(null),
                chat.unreadForCoach(coachId, clientId),
                chat.lastMessageAt(coachId, clientId));
    }

    private void requireCoach(User u) {
        if (u.getRole() != UserRole.coach) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only coaches can do this.");
        }
    }
}
