package com.fitcoach.admin;

import com.fitcoach.user.UserRole;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminDtos {

    private AdminDtos() {}

    public record AdminOverview(Stats stats, List<PendingCoach> pendingCoaches,
                                List<UserRow> users, List<PaymentRow> payments) {}

    public record Stats(long users, long coaches, long activeSubs, long revenueCents) {}

    public record PendingCoach(UUID userId, String name, String email,
                               String bio, List<String> specialties) {}

    public record UserRow(UUID id, String name, String email, UserRole role, boolean suspended) {}

    public record PaymentRow(UUID id, String clientName, String coachName,
                             long amountCents, String status, Instant createdAt) {}

    /**
     * Support view of any pair. Deliberately read-only: OwnershipGuard lets
     * admins READ everything and blocks every write path, so this endpoint can
     * only ever return data, never change it.
     */
    public record PairView(UUID coachId, UUID clientId, String coachName, String clientName,
                           boolean activeSubscription, long progressEntries, long chatMessages) {}
}
