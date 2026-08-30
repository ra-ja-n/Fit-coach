package com.fitcoach.coach;

import com.fitcoach.subscription.SubscriptionStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Coach-console aggregates. Each row is one coach-client pair. */
public final class CoachConsoleDtos {

    private CoachConsoleDtos() {}

    public record CoachClientRow(
            UUID clientId, String clientName, String clientEmail,
            SubscriptionStatus status, String packageTitle,
            Instant startDate, Instant endDate, long daysLeft,
            boolean hasWorkout, boolean hasDiet,
            Instant lastProgressAt, long unread, Instant lastMessageAt) {}

    public record ClientDetailBundle(
            UUID clientId, String clientName, String clientEmail,
            SubscriptionStatus status, String packageTitle,
            Instant startDate, Instant endDate,
            boolean hasWorkout, boolean hasDiet,
            long workoutChecked, long workoutTotal,
            long dietChecked, long dietTotal) {}

    public record RevenueSummary(
            long totalCents, long thisMonthCents, long activeClients,
            List<RevenueRow> recent) {}

    public record RevenueRow(
            UUID id, String clientName, String packageTitle,
            long amountCents, Instant createdAt) {}
}
