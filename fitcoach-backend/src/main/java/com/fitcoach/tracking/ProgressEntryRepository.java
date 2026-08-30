package com.fitcoach.tracking;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProgressEntryRepository extends JpaRepository<ProgressEntry, UUID> {

    List<ProgressEntry> findByCoachIdAndClientIdOrderByEntryDateDesc(UUID coachId, UUID clientId);

    Optional<ProgressEntry> findByClientIdAndCoachIdAndEntryDate(
            UUID clientId, UUID coachId, LocalDate entryDate);

    @Query("select p from ProgressEntry p where p.coachId = :coachId and p.clientId = :clientId "
            + "order by p.entryDate desc, p.createdAt desc")
    List<ProgressEntry> latestFirst(UUID coachId, UUID clientId);

    @Query("select count(p) from ProgressEntry p where p.coachId = :coachId")
    long countForCoach(UUID coachId);
}
