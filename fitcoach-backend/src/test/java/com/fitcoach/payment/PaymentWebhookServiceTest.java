package com.fitcoach.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitcoach.coach.CoachingPackage;
import com.fitcoach.coach.CoachingPackageRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
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
 * Activation is the one irreversible money-adjacent action in the system, so:
 * no valid signature -> nothing happens; a repeated eventId -> nothing happens
 * twice; and only the webhook ever creates or extends a subscription.
 */
@ExtendWith(MockitoExtension.class)
class PaymentWebhookServiceTest {

    private static final String SECRET = "unit-test-webhook-secret";

    @Mock WebhookEventRepository events;
    @Mock PaymentRepository payments;
    @Mock CoachingPackageRepository packages;
    @Mock SubscriptionRepository subscriptions;
    @Mock RealtimePublisher realtime;

    PaymentWebhookService service;
    WebhookSignatureVerifier verifier;
    final ObjectMapper mapper = new ObjectMapper();

    final UUID paymentId = UUID.randomUUID();
    final UUID coachId = UUID.randomUUID();
    final UUID clientId = UUID.randomUUID();
    final UUID packageId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        verifier = new WebhookSignatureVerifier(SECRET);
        service = new PaymentWebhookService(verifier, events, payments, packages,
                subscriptions, realtime, mapper);
    }

    private String body(String eventId, String status) {
        return "{\"eventId\":\"" + eventId + "\",\"paymentId\":\"" + paymentId
                + "\",\"status\":\"" + status + "\"}";
    }

    private Payment pendingPayment() {
        Payment p = new Payment();
        p.setId(paymentId);
        p.setCoachId(coachId);
        p.setClientId(clientId);
        p.setPackageId(packageId);
        p.setAmountCents(14900);
        p.setStatus(PaymentStatus.pending);
        return p;
    }

    private CoachingPackage pkg() {
        CoachingPackage p = new CoachingPackage();
        p.setId(packageId);
        p.setCoachId(coachId);
        p.setPriceCents(14900);
        p.setDurationDays(84);
        return p;
    }

    @Test
    @DisplayName("a forged signature is rejected and changes nothing")
    void badSignatureRejected() {
        String raw = body("evt_1", "captured");
        ApiException e = catchThrowableOfType(ApiException.class,
                () -> service.handle(raw, "deadbeef"));
        assertThat(e.getCode()).isEqualTo("BAD_SIGNATURE");
        assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(payments, never()).save(any());
        verify(subscriptions, never()).save(any());
    }

    @Test
    @DisplayName("a missing signature is rejected too")
    void missingSignatureRejected() {
        assertThatThrownBy(() -> service.handle(body("evt_1", "captured"), null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("BAD_SIGNATURE"));
    }

    @Test
    @DisplayName("tampering with the body invalidates an otherwise real signature")
    void tamperedBodyRejected() {
        String signed = body("evt_1", "captured");
        String signature = verifier.sign("evt_1", signed);
        // Still valid JSON, so parsing succeeds and the signature is what fails.
        String tampered = signed.replace("captured", "refunded");
        assertThatThrownBy(() -> service.handle(tampered, signature))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("BAD_SIGNATURE"));
    }

    @Test
    @DisplayName("a redelivered eventId is a no-op — the plan is never extended twice")
    void duplicateDeliveryIsIdempotent() {
        String raw = body("evt_dup", "captured");
        when(events.existsById("evt_dup")).thenReturn(true);

        service.handle(raw, verifier.sign("evt_dup", raw));

        verify(payments, never()).save(any());
        verify(subscriptions, never()).save(any());
        verifyNoInteractions(realtime);
    }

    @Test
    @DisplayName("a valid first delivery captures the payment and activates the subscription")
    void validDeliveryActivates() {
        String raw = body("evt_ok", "captured");
        when(events.existsById("evt_ok")).thenReturn(false);
        when(payments.findById(paymentId)).thenReturn(Optional.of(pendingPayment()));
        when(packages.findById(packageId)).thenReturn(Optional.of(pkg()));
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.empty());
        when(subscriptions.save(any(Subscription.class))).thenAnswer(i -> i.getArgument(0));

        service.handle(raw, verifier.sign("evt_ok", raw));

        verify(payments).save(argThat(p -> p.getStatus() == PaymentStatus.captured));
        verify(subscriptions).save(argThat(s ->
                s.getStatus() == SubscriptionStatus.active
                        && s.getCoachId().equals(coachId)
                        && s.getClientId().equals(clientId)
                        && s.getEndDate().isAfter(s.getStartDate())));
        verify(events).save(argThat(e -> "evt_ok".equals(e.getEventId())));
        verify(realtime).publishToPair("subscription", coachId, clientId);
    }

    @Test
    @DisplayName("renewing an existing active subscription EXTENDS it (one active row per pair)")
    void renewalExtendsExistingActiveSubscription() {
        String raw = body("evt_renew", "captured");
        Subscription existing = new Subscription();
        existing.setCoachId(coachId);
        existing.setClientId(clientId);
        existing.setStatus(SubscriptionStatus.active);
        existing.setStartDate(java.time.Instant.now().minusSeconds(86400 * 30L));
        existing.setEndDate(java.time.Instant.now().plusSeconds(86400 * 5L));

        when(events.existsById("evt_renew")).thenReturn(false);
        when(payments.findById(paymentId)).thenReturn(Optional.of(pendingPayment()));
        when(packages.findById(packageId)).thenReturn(Optional.of(pkg()));
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.of(existing));
        when(subscriptions.save(any(Subscription.class))).thenAnswer(i -> i.getArgument(0));

        service.handle(raw, verifier.sign("evt_renew", raw));

        verify(subscriptions, times(1)).save(argThat(s -> s == existing));
        // 84-day package on top of "now", so well past the old 5-day expiry.
        assertThat(existing.getEndDate())
                .isAfter(java.time.Instant.now().plusSeconds(86400 * 80L));
    }

    @Test
    @DisplayName("a 'failed' delivery marks the payment failed and activates nothing")
    void failedDeliveryDoesNotActivate() {
        String raw = body("evt_fail", "failed");
        when(events.existsById("evt_fail")).thenReturn(false);
        when(payments.findById(paymentId)).thenReturn(Optional.of(pendingPayment()));

        service.handle(raw, verifier.sign("evt_fail", raw));

        verify(payments).save(argThat(p -> p.getStatus() == PaymentStatus.failed));
        verify(subscriptions, never()).save(any());
    }

    @Test
    @DisplayName("a malformed body is rejected before any signature work")
    void malformedBodyRejected() {
        assertThatThrownBy(() -> service.handle("not json", "whatever"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("BAD_PAYLOAD"));
    }
}
