package com.fitcoach.admin;

import com.fitcoach.user.User;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Admin console. View-only over private data: approvals and moderation act on
 * accounts, and OwnershipGuard still rejects any attempt to write plans,
 * progress or messages through an admin session.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/overview")
    public AdminDtos.AdminOverview overview() {
        return admin.overview();
    }

    @PostMapping("/coaches/{userId}/approve")
    public Map<String, Boolean> approve(@PathVariable UUID userId) {
        admin.decideCoach(userId, true);
        return Map.of("ok", true);
    }

    @PostMapping("/coaches/{userId}/reject")
    public Map<String, Boolean> reject(@PathVariable UUID userId) {
        admin.decideCoach(userId, false);
        return Map.of("ok", true);
    }

    @PostMapping("/users/{userId}/suspend")
    public Map<String, Boolean> suspend(@PathVariable UUID userId) {
        admin.setSuspended(userId, true);
        return Map.of("ok", true);
    }

    @PostMapping("/users/{userId}/reinstate")
    public Map<String, Boolean> reinstate(@PathVariable UUID userId) {
        admin.setSuspended(userId, false);
        return Map.of("ok", true);
    }

    @PostMapping("/users/{userId}/force-logout")
    public Map<String, Boolean> forceLogout(@PathVariable UUID userId) {
        admin.forceLogout(userId);
        return Map.of("ok", true);
    }

    @GetMapping("/pairs/{coachId}/{clientId}")
    public AdminDtos.PairView pairView(@AuthenticationPrincipal User admin,
                                       @PathVariable UUID coachId,
                                       @PathVariable UUID clientId) {
        return admin.pairView(admin, coachId, clientId);
    }
}
