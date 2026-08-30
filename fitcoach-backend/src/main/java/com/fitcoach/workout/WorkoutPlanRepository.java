package com.fitcoach.workout;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutPlanRepository extends JpaRepository<WorkoutPlan, UUID> {

    Optional<WorkoutPlan> findByCoachIdAndClientId(UUID coachId, UUID clientId);

    boolean existsByCoachIdAndClientId(UUID coachId, UUID clientId);

    List<WorkoutPlan> findByCoachId(UUID coachId);
}
