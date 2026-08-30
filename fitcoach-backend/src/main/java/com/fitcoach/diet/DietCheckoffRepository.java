package com.fitcoach.diet;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface DietCheckoffRepository extends JpaRepository<DietCheckoff, UUID> {

    List<DietCheckoff> findByCoachIdAndClientId(UUID coachId, UUID clientId);

    long countByCoachIdAndClientId(UUID coachId, UUID clientId);

    Optional<DietCheckoff> findByCoachIdAndClientIdAndMealAndItem(
            UUID coachId, UUID clientId, int meal, int item);

    @Modifying
    @Query("delete from DietCheckoff c where c.coachId = :coachId and c.clientId = :clientId")
    int deleteForPair(UUID coachId, UUID clientId);
}
