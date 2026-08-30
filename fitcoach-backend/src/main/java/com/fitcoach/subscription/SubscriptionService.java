package com.fitcoach.subscription;

import com.fitcoach.coach.CoachingPackageRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptions;
    private final CoachingPackageRepository packages;
    private final UserRepository users;
    private final RealtimePublisher realtime;

    public SubscriptionService(SubscriptionRepository subscriptions, CoachingPackageRepository packages,
                               UserRepository users, RealtimePublisher realtime) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.users = users;
        this.realtime = realtime;
    }

    /** A client's own subscriptions, active first then most recent. */
    @Transactional(readOnly = true)
    public List<SubscriptionRowDto> mine(User client) {
        if (client.getRole() != UserRole.client) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only clients can do this.");
        }
        return subscriptions.findAllForClient(client.getId()).stream()
                .map(this::toRow)
                .sorted(Comparator
                        .comparing((SubscriptionRowDto r) -> r.status() == SubscriptionStatus.active ? 0 : 1)
                        .thenComparing(SubscriptionRowDto::endDate, Comparator.reverseOrder()))
                .toList();
    }

    /** Cancelling ends the plan now; the client keeps read access to history. */
    @Transactional
    public void cancel(User client, UUID subscriptionId) {
        if (client.getRole() != UserRole.client) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only clients can do this.");
        }
        // Scoped by clientId in the lookup: someone else's subscription id is a
        // plain 404, never a 403 that would confirm the row exists.
        Subscription s = subscriptions.findById(subscriptionId)
                .filter(x -> x.getClientId().equals(client.getId()))
                .filter(x -> x.getStatus() == SubscriptionStatus.active)
                .orElseThrow(ApiException::notFound);
        s.setStatus(SubscriptionStatus.cancelled);
        s.setEndDate(Instant.now());
        subscriptions.save(s);
        realtime.publishToPair("subscription", s.getCoachId(), s.getClientId());
    }

    private SubscriptionRowDto toRow(Subscription s) {
        return new SubscriptionRowDto(
                s.getId(), s.getClientId(), s.getCoachId(),
                users.findById(s.getCoachId()).map(User::getName).orElse(""),
                packages.findById(s.getPackageId()).map(p -> p.getTitle()).orElse("Coaching plan"),
                s.getStatus(), s.getStartDate(), s.getEndDate(),
                packages.findById(s.getPackageId()).map(p -> p.getPriceCents()).orElse(0L));
    }
}
