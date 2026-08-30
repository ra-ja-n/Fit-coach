package com.fitcoach.tracking;

import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Progress check-ins.
 *
 * Reads are pair-scoped (a lapsed client keeps their history). Logging is a
 * write, so it needs an ACTIVE subscription — and when there isn't one the
 * error names the coach to renew with, so the app can offer a renewal rather
 * than showing a dead end.
 */
@Service
public class ProgressService {

    private static final int MAX_PHOTOS = 12;

    private final ProgressEntryRepository entries;
    private final SubscriptionRepository subscriptions;
    private final UserRepository users;
    private final OwnershipGuard guard;
    private final RealtimePublisher realtime;

    public ProgressService(ProgressEntryRepository entries, SubscriptionRepository subscriptions,
                           UserRepository users, OwnershipGuard guard, RealtimePublisher realtime) {
        this.entries = entries;
        this.subscriptions = subscriptions;
        this.users = users;
        this.guard = guard;
        this.realtime = realtime;
    }

    public record LogRequest(BigDecimal weightKg, Map<String, Double> measurements,
                             String notes, String photoUrl) {}

    // ------------------------------------------------------------- reads ---

    /** A client's own history with one coach. */
    @Transactional(readOnly = true)
    public List<ProgressEntryDto> mine(User client, UUID coachId) {
        requireClient(client);
        guard.requirePairAccess(client, coachId, client.getId());
        // A guessed coachId yields an empty history, identical to a real pair
        // with no check-ins yet — it must not leak whether the pair exists.
        if (!subscriptions.existsByCoachIdAndClientId(coachId, client.getId())) {
            return List.of();
        }
        return entries.findByCoachIdAndClientIdOrderByEntryDateDesc(coachId, client.getId())
                .stream().map(ProgressEntryDto::from).toList();
    }

    /** A coach's view of one client's history. */
    @Transactional(readOnly = true)
    public List<ProgressEntryDto> forClient(User coach, UUID clientId) {
        requireCoach(coach);
        guard.requirePairAccess(coach, coach.getId(), clientId);
        if (!subscriptions.existsByCoachIdAndClientId(coach.getId(), clientId)) {
            throw ApiException.notFound();
        }
        return entries.findByCoachIdAndClientIdOrderByEntryDateDesc(coach.getId(), clientId)
                .stream().map(ProgressEntryDto::from).toList();
    }

    // ------------------------------------------------------------ writes ---

    /** Upserts today's entry for the client's active coach. */
    @Transactional
    public ProgressEntryDto log(User client, LogRequest req) {
        requireClient(client);
        Subscription sub = subscriptions.findActiveByClient(client.getId())
                .orElseThrow(() -> renewalRequired(client.getId()));

        LocalDate today = LocalDate.now();
        ProgressEntry entry = entries
                .findByClientIdAndCoachIdAndEntryDate(client.getId(), sub.getCoachId(), today)
                .orElseGet(() -> {
                    ProgressEntry e = new ProgressEntry();
                    e.setClientId(client.getId());
                    e.setCoachId(sub.getCoachId());
                    e.setEntryDate(today);
                    return e;
                });

        if (req.weightKg() != null) entry.setWeightKg(req.weightKg());
        if (req.measurements() != null && !req.measurements().isEmpty()) {
            Map<String, Double> merged = new HashMap<>(entry.getMeasurements());
            merged.putAll(req.measurements());
            entry.setMeasurements(merged);
        }
        if (req.notes() != null) entry.setNotes(req.notes());
        if (req.photoUrl() != null && !req.photoUrl().isBlank()) {
            List<String> photos = new ArrayList<>(entry.getPhotoUrls());
            photos.add(req.photoUrl());
            // Keep the most recent window only — photo payloads get large fast.
            entry.setPhotoUrls(photos.subList(Math.max(0, photos.size() - MAX_PHOTOS), photos.size()));
        }
        ProgressEntry saved = entries.save(entry);
        realtime.publishToPair("progress", sub.getCoachId(), client.getId());
        return ProgressEntryDto.from(saved);
    }

    /**
     * No active subscription -> a renewal prompt, not a technical failure.
     * SUBSCRIPTION_EXPIRED when the pair lapsed, SUBSCRIBE_REQUIRED when the
     * client has never subscribed at all.
     */
    private ApiException renewalRequired(UUID clientId) {
        List<Subscription> past = subscriptions.findAllForClient(clientId);
        boolean lapsed = past.stream().anyMatch(s -> s.getStatus() != SubscriptionStatus.active);
        UUID coachId = past.isEmpty() ? null : past.get(0).getCoachId();
        String coachName = coachId == null ? "a coach"
                : users.findById(coachId).map(User::getName).orElse("your coach");
        Map<String, Object> data = new HashMap<>();
        if (coachId != null) data.put("coachId", String.valueOf(coachId));
        data.put("coachName", coachName);
        return lapsed
                ? new ApiException(HttpStatus.FORBIDDEN, "SUBSCRIPTION_EXPIRED",
                        "Your coaching plan has ended. Renew to keep logging progress.", data)
                : new ApiException(HttpStatus.FORBIDDEN, "SUBSCRIBE_REQUIRED",
                        "Subscribe to a coach to start tracking.", data);
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
