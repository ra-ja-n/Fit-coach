package com.fitcoach.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitcoach.coach.CoachingPackage;
import com.fitcoach.coach.CoachingPackageRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * THE ONLY place a subscription becomes active.
 *
 * Nothing else in the codebase flips a payment to captured or creates/extends
 * a subscription. The checkout endpoint only records intent; a client saying
 * "I paid" changes nothing until the provider's signed webhook arrives.
 *
 * Idempotent on the provider's eventId: a redelivery is a no-op, so retries and
 * duplicate deliveries can never double-activate or double-extend a plan.
 */
@Service
public class PaymentWebhookService {

    private static final Logger secLog = LoggerFactory.getLogger(PaymentWebhookService.class);

    private final WebhookSignatureVerifier verifier;
    private final WebhookEventRepository events;
    private final PaymentRepository payments;
    private final CoachingPackageRepository packages;
    private final SubscriptionRepository subscriptions;
    private final RealtimePublisher realtime;
    private final ObjectMapper mapper;

    public PaymentWebhookService(WebhookSignatureVerifier verifier, WebhookEventRepository events,
                                 PaymentRepository payments, CoachingPackageRepository packages,
                                 SubscriptionRepository subscriptions, RealtimePublisher realtime,
                                 ObjectMapper mapper) {
        this.verifier = verifier;
        this.events = events;
        this.payments = payments;
        this.packages = packages;
        this.subscriptions = subscriptions;
        this.realtime = realtime;
        this.mapper = mapper;
    }

    /** Wire shape sent by the provider. */
    public record WebhookPayload(String eventId, UUID paymentId, String status) {}

    @Transactional
    public void handle(String rawBody, String signature) {
        WebhookPayload payload;
        try {
            payload = mapper.readValue(rawBody, WebhookPayload.class);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAYLOAD", "Malformed webhook body");
        }
        if (payload.eventId() == null || payload.paymentId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PAYLOAD", "Malformed webhook body");
        }

        // Signature first: an unsigned or forged delivery is rejected before it
        // touches any state, and the rejection is a security event in the logs.
        if (!verifier.isValid(payload.eventId(), rawBody, signature)) {
            secLog.warn("webhook rejected: bad signature for event {}", payload.eventId());
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_SIGNATURE", "Invalid webhook signature");
        }

        // Idempotency: eventId is the PK of webhook_events, so a redelivery is
        // a duplicate key. Swallow it — the first delivery already did the work.
        if (events.existsById(payload.eventId())) {
            return;
        }

        Payment payment = payments.findById(payload.paymentId()).orElseThrow(ApiException::notFound);

        WebhookEvent row = new WebhookEvent();
        row.setEventId(payload.eventId());
        row.setPaymentId(payment.getId());
        events.save(row);

        if ("failed".equalsIgnoreCase(payload.status())) {
            payment.setStatus(PaymentStatus.failed);
            payments.save(payment);
            return;
        }

        if (payment.getStatus() == PaymentStatus.captured) {
            // Already activated by an earlier event — nothing left to do.
            return;
        }

        payment.setStatus(PaymentStatus.captured);
        payments.save(payment);
        activate(payment);
        realtime.publishToPair("subscription", payment.getCoachId(), payment.getClientId());
    }

    /**
     * Extends the pair's active subscription if there is one, otherwise starts
     * a new one. Extending is required by the partial unique index
     * uniq_one_active_sub_per_pair — a second 'active' row for the same pair
     * would be a constraint violation.
     */
    private void activate(Payment payment) {
        CoachingPackage pkg = packages.findById(payment.getPackageId())
                .orElseThrow(ApiException::notFound);
        Instant now = Instant.now();
        Instant end = now.plus(pkg.getDurationDays(), ChronoUnit.DAYS);

        Subscription sub = subscriptions.findActive(payment.getCoachId(), payment.getClientId())
                .orElseGet(() -> {
                    Subscription s = new Subscription();
                    s.setCoachId(payment.getCoachId());
                    s.setClientId(payment.getClientId());
                    s.setStatus(SubscriptionStatus.active);
                    s.setStartDate(now);
                    return s;
                });
        sub.setPackageId(pkg.getId());
        sub.setPaymentId(payment.getId());
        sub.setEndDate(end);
        subscriptions.save(sub);
    }
}
