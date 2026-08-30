package com.fitcoach.security;

import com.fitcoach.common.ApiException;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * OwnershipGuard — THE single source of truth for coach_id/client_id scoping.
 *
 * Rules:
 *  1. Every private record belongs to exactly one coach-client pair.
 *  2. Read access: requester is the pair's coach, the pair's client, or admin.
 *     Anything else is rejected as NOT_FOUND — identical to a missing resource,
 *     so guessed IDs leak nothing.
 *  3. Write access additionally requires an ACTIVE subscription for the pair.
 *     (Expiry rule: lapsed clients keep READ access — plans/history — but lose
 *     messaging and plan updates. Re-subscribing to the same coach restores
 *     access; a different coach never exposes this pair's data.)
 *  4. Admins may read everything for support, but never WRITE private data.
 */
@Component
public class OwnershipGuard {

    private static final Logger secLog = LoggerFactory.getLogger(OwnershipGuard.class);

    private final SubscriptionRepository subscriptions;

    public OwnershipGuard(SubscriptionRepository subscriptions) {
        this.subscriptions = subscriptions;
    }

    /** Read scope. Cross-tenant attempts are logged and surfaced as 404. */
    public void requirePairAccess(User requester, UUID coachId, UUID clientId) {
        if (requester.getRole() == UserRole.admin) return;
        if (requester.getRole() == UserRole.coach && requester.getId().equals(coachId)) return;
        if (requester.getRole() == UserRole.client && requester.getId().equals(clientId)) return;
        secLog.warn("cross-tenant access blocked: user={} role={} attempted pair coach={} client={}",
                requester.getId(), requester.getRole(), coachId, clientId);
        throw ApiException.notFound();
    }

    /** Coach-scoped resources (profile, packages, revenue). */
    public void requireCoachOwns(User requester, UUID coachId) {
        if (requester.getRole() == UserRole.admin) return;
        if (requester.getRole() == UserRole.coach && requester.getId().equals(coachId)) return;
        secLog.warn("coach-scope access blocked: user={} attempted coach={}", requester.getId(), coachId);
        throw ApiException.notFound();
    }

    /** @return the active subscription, or 403 SUBSCRIBE_REQUIRED ("subscribe to unlock"). */
    public Subscription requireActiveSubscription(UUID coachId, UUID clientId) {
        return subscriptions.findActive(coachId, clientId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "SUBSCRIBE_REQUIRED",
                        "Subscribe to unlock this."));
    }

    /**
     * Write scope: pair access + active subscription. Admins are deliberately
     * excluded from writes — support can view, never edit plans or impersonate.
     */
    public Subscription requireWriteAccess(User requester, UUID coachId, UUID clientId) {
        requirePairAccess(requester, coachId, clientId);
        if (requester.getRole() == UserRole.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Admins cannot modify private data.");
        }
        return requireActiveSubscription(coachId, clientId);
    }

    /**
     * Coach-side writes (plans, messages) for a client: must be an active
     * subscriber. Attempts against non-subscribed clients are security events.
     */
    public Subscription requireCoachWriteAccess(User coach, UUID clientId) {
        if (coach.getRole() != UserRole.coach) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only coaches can do this.");
        }
        var sub = subscriptions.findActive(coach.getId(), clientId).orElseThrow(() -> {
            secLog.warn("write attempted for non-subscribed client: coach={} client={} — security-relevant",
                    coach.getId(), clientId);
            return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found");
        });
        return sub;
    }
}
