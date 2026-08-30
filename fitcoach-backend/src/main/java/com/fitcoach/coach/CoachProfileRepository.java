package com.fitcoach.coach;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachProfileRepository extends JpaRepository<CoachProfile, UUID> {

    List<CoachProfile> findByStatusOrderByUpdatedAtDesc(CoachStatus status);

    List<CoachProfile> findByStatus(CoachStatus status);

    long countByStatus(CoachStatus status);
}
