package com.fitcoach.subscription;

import com.fitcoach.user.User;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/subscriptions")
@PreAuthorize("hasRole('CLIENT')")
public class SubscriptionController {

    private final SubscriptionService subscriptions;

    public SubscriptionController(SubscriptionService subscriptions) {
        this.subscriptions = subscriptions;
    }

    @GetMapping
    public List<SubscriptionRowDto> mine(@AuthenticationPrincipal User client) {
        return subscriptions.mine(client);
    }

    @PostMapping("/{subscriptionId}/cancel")
    public Map<String, Boolean> cancel(@AuthenticationPrincipal User client,
                                       @PathVariable UUID subscriptionId) {
        subscriptions.cancel(client, subscriptionId);
        return Map.of("ok", true);
    }
}
