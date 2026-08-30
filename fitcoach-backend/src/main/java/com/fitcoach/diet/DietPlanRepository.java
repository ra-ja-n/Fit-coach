package com.fitcoach.diet;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietPlanRepository extends JpaRepository<DietPlan, UUID> {

    Optional<DietPlan> findByCoachIdAndClientId(UUID coachId, UUID clientId);

    boolean existsByCoachIdAndClientId(UUID coachId, UUID clientId);

    List<DietPlan> findByCoachId(UUID coachId);
}
