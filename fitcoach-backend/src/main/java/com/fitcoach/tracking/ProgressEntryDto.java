package com.fitcoach.tracking;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ProgressEntryDto(
        UUID id, UUID clientId, UUID coachId, LocalDate date,
        BigDecimal weightKg, Map<String, Double> measurements,
        List<String> photoUrls, String notes, Instant createdAt) {

    public static ProgressEntryDto from(ProgressEntry e) {
        return new ProgressEntryDto(e.getId(), e.getClientId(), e.getCoachId(), e.getEntryDate(),
                e.getWeightKg(), Map.copyOf(e.getMeasurements()),
                List.copyOf(e.getPhotoUrls()), e.getNotes(), e.getCreatedAt());
    }
}
