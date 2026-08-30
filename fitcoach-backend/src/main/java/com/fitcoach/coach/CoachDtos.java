package com.fitcoach.coach;

import java.util.List;
import java.util.UUID;

/** Wire shapes — these mirror fitcoach-mobile/lib/api/types.ts 1:1. */
public final class CoachDtos {

    private CoachDtos() {}

    /** Public discovery row. Never carries email or any private field. */
    public record CoachProfileDto(
            UUID userId, String name, String bio, List<String> specialties,
            int experienceYears, CoachStatus status,
            Long startingPriceCents, Long activeClients) {}

    public record PackageDto(
            UUID id, UUID coachId, String title,
            long priceCents, int durationDays, List<String> features) {

        public static PackageDto from(CoachingPackage p) {
            return new PackageDto(p.getId(), p.getCoachId(), p.getTitle(),
                    p.getPriceCents(), p.getDurationDays(), List.copyOf(p.getFeatures()));
        }
    }

    public record UpdateProfileRequest(String bio, List<String> specialties, Integer experienceYears) {}

    public record SavePackageRequest(
            UUID id, String title, Long priceCents, Integer durationDays, List<String> features) {}
}
