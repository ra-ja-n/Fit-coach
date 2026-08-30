package com.fitcoach.payment;

import com.fitcoach.coach.CoachingPackage;
import com.fitcoach.coach.CoachingPackageRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checkout initiation. Creating a payment records *intent* only — it never
 * activates anything. Activation is exclusively PaymentWebhookService's job.
 */
@Service
public class CheckoutService {

    private final PaymentRepository payments;
    private final CoachingPackageRepository packages;
    private final SubscriptionRepository subscriptions;
    private final PaymentWebhookService webhook;
    private final WebhookSignatureVerifier verifier;
    private final ObjectMapper mapper;
    private final boolean simulateProvider;

    public CheckoutService(PaymentRepository payments, CoachingPackageRepository packages,
                           SubscriptionRepository subscriptions, PaymentWebhookService webhook,
                           WebhookSignatureVerifier verifier, ObjectMapper mapper,
                           @Value("${fitcoach.payments.simulate-provider:false}") boolean simulateProvider) {
        this.payments = payments;
        this.packages = packages;
        this.subscriptions = subscriptions;
        this.webhook = webhook;
        this.verifier = verifier;
        this.mapper = mapper;
        this.simulateProvider = simulateProvider;
    }

    public record CheckoutStatusDto(PaymentStatus status, Boolean declined) {}

    @Transactional
    public UUID create(User client, UUID packageId) {
        requireClient(client);
        CoachingPackage pkg = packages.findById(packageId).orElseThrow(ApiException::notFound);

        var active = subscriptions.findActiveByClient(client.getId());
        if (active.isPresent() && !active.get().getCoachId().equals(pkg.getCoachId())) {
            throw new ApiException(HttpStatus.CONFLICT, "ONE_COACH",
                    "You already have an active coaching plan. Cancel it before starting with a new coach.");
        }
        if (subscriptions.findActive(pkg.getCoachId(), client.getId()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_ACTIVE",
                    "You already have an active plan with this coach.");
        }

        Payment payment = new Payment();
        payment.setClientId(client.getId());
        payment.setCoachId(pkg.getCoachId());
        payment.setPackageId(pkg.getId());
        payment.setAmountCents(pkg.getPriceCents());
        payment.setStatus(PaymentStatus.pending);
        return payments.save(payment).getId();
    }

    /** Polling endpoint the checkout screen uses while waiting for the webhook. */
    @Transactional(readOnly = true)
    public CheckoutStatusDto status(User client, UUID paymentId) {
        requireClient(client);
        Payment p = payments.findByIdAndClientId(paymentId, client.getId())
                .orElseThrow(ApiException::notFound);
        return new CheckoutStatusDto(p.getStatus(),
                p.getStatus() == PaymentStatus.failed ? Boolean.TRUE : null);
    }

    /**
     * Stands in for the payment provider's redirect in dev/demo only: it builds
     * a correctly signed webhook payload and hands it to the real webhook
     * handler, so signature verification and idempotency are genuinely on the
     * activation path even without Stripe.
     *
     * Disabled by default ({@code fitcoach.payments.simulate-provider=false})
     * and answered with 404 rather than 403, so a production deployment neither
     * exposes nor advertises it.
     */
    @Transactional
    public void simulateProviderCallback(User client, UUID paymentId, boolean decline) {
        requireClient(client);
        if (!simulateProvider) {
            throw ApiException.notFound();
        }
        Payment p = payments.findByIdAndClientId(paymentId, client.getId())
                .orElseThrow(ApiException::notFound);
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("eventId", "evt_" + p.getId() + (decline ? "_failed" : "_captured"));
            payload.put("paymentId", String.valueOf(p.getId()));
            payload.put("status", decline ? "failed" : "captured");
            String rawBody = mapper.writeValueAsString(payload);
            // Reach into the verifier through the same service the real HTTP
            // webhook uses, so the signature check is not bypassed here.
            webhook.handle(rawBody, signatureFor(payload, rawBody));
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL",
                    "Could not process the payment callback.");
        }
    }

    private String signatureFor(Map<String, Object> payload, String rawBody) {
        return verifier.sign(String.valueOf(payload.get("eventId")), rawBody);
    }

    private void requireClient(User u) {
        if (u.getRole() != UserRole.client) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only clients can do this.");
        }
    }
}
