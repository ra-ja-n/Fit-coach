package com.fitcoach.plan;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanTemplateRepository extends JpaRepository<PlanTemplate, UUID> {

    List<PlanTemplate> findByCoachIdOrderByUpdatedAtDesc(UUID coachId);

    /** Scoped read: a template only ever exists for its own coach. */
    Optional<PlanTemplate> findByIdAndCoachId(UUID id, UUID coachId);
}
