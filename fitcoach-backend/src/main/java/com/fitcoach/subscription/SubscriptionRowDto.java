package com.fitcoach.subscription;

import java.time.Instant;
import java.util.UUID;

/** One row in a client's "my coaching" list. */
public record SubscriptionRowDto(
        UUID id, UUID clientId, UUID coachId, String coachName, String packageTitle,
        SubscriptionStatus status, Instant startDate, Instant endDate, long priceCents) {}
