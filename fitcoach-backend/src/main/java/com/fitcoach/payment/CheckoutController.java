package com.fitcoach.payment;

import com.fitcoach.user.User;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/checkout")
@PreAuthorize("hasRole('CLIENT')")
public class CheckoutController {

    private final CheckoutService checkout;

    public CheckoutController(CheckoutService checkout) {
        this.checkout = checkout;
    }

    public record CreateCheckoutRequest(UUID packageId) {}
    public record PayRequest(String mode) {}

    /** Records intent. Does NOT activate anything. */
    @PostMapping
    public Map<String, UUID> create(@AuthenticationPrincipal User client,
                                    @RequestBody CreateCheckoutRequest req) {
        return Map.of("paymentId", checkout.create(client, req.packageId()));
    }

    @GetMapping("/{paymentId}/status")
    public CheckoutService.CheckoutStatusDto status(@AuthenticationPrincipal User client,
                                                    @PathVariable UUID paymentId) {
        return checkout.status(client, paymentId);
    }

    /** Dev/demo stand-in for the provider redirect; 404 when disabled. */
    @PostMapping("/{paymentId}/pay")
    public Map<String, Object> pay(@AuthenticationPrincipal User client,
                                   @PathVariable UUID paymentId,
                                   @RequestBody(required = false) PayRequest req) {
        checkout.simulateProviderCallback(client, paymentId,
                req != null && "decline".equalsIgnoreCase(req.mode()));
        return Map.of("processing", true);
    }
}
