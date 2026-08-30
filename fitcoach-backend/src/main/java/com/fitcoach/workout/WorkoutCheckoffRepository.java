package com.fitcoach.workout;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface WorkoutCheckoffRepository extends JpaRepository<WorkoutCheckoff, UUID> {

    List<WorkoutCheckoff> findByCoachIdAndClientId(UUID coachId, UUID clientId);

    long countByCoachIdAndClientId(UUID coachId, UUID clientId);

    Optional<WorkoutCheckoff> findByCoachIdAndClientIdAndDayAndExercise(
            UUID coachId, UUID clientId, int day, int exercise);

    /** A fresh plan invalidates every previous tick for the pair. */
    @Modifying
    @Query("delete from WorkoutCheckoff c where c.coachId = :coachId and c.clientId = :clientId")
    int deleteForPair(UUID coachId, UUID clientId);
}
