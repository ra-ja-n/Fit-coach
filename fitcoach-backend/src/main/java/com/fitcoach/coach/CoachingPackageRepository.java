package com.fitcoach.coach;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachingPackageRepository extends JpaRepository<CoachingPackage, UUID> {

    List<CoachingPackage> findByCoachIdOrderByPriceCentsAsc(UUID coachId);

    /** Scoped read: a package only exists for its own coach. */
    Optional<CoachingPackage> findByIdAndCoachId(UUID id, UUID coachId);
}
