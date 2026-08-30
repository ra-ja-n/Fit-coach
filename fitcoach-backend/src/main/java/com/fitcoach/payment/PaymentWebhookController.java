package com.fitcoach.payment;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

/**
 * Provider webhook. Unauthenticated by design (see SecurityConfig:
 * /api/webhooks/** is permitAll) because the provider cannot hold a user
 * session — the HMAC signature over the raw body is the authentication, and it
 * is verified before any state changes.
 */
@RestController
@RequestMapping("/api/webhooks")
public class PaymentWebhookController {

    private final PaymentWebhookService webhook;

    public PaymentWebhookController(PaymentWebhookService webhook) {
        this.webhook = webhook;
    }

    @PostMapping("/payment")
    public Map<String, Boolean> payment(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-FitCoach-Signature", required = false) String signature) {
        webhook.handle(rawBody, signature);
        return Map.of("ok", true);
    }
}
