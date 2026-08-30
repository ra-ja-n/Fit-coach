package com.fitcoach.subscription;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    /** The single lookup every access decision traces back to. */
    @Query("select s from Subscription s where s.coachId = :coachId and s.clientId = :clientId and s.status = 'active'")
    Optional<Subscription> findActive(UUID coachId, UUID clientId);

    @Query("select s from Subscription s where s.clientId = :clientId and s.status = 'active'")
    Optional<Subscription> findActiveByClient(UUID clientId);

    @Query("select s from Subscription s where s.coachId = :coachId order by case when s.status = 'active' then 0 else 1 end, s.endDate desc")
    List<Subscription> findAllForCoach(UUID coachId);

    @Query("select s from Subscription s where s.clientId = :clientId order by case when s.status = 'active' then 0 else 1 end, s.endDate desc")
    List<Subscription> findAllForClient(UUID clientId);


    /** Coach console / public discovery: how many live clients a coach has. */
    long countByCoachIdAndStatus(UUID coachId, SubscriptionStatus status);

    long countByStatus(SubscriptionStatus status);

    /** Has this pair EVER existed? Used to tell "empty history" from a guess. */
    boolean existsByCoachIdAndClientId(UUID coachId, UUID clientId);

    /** A package with subscribers can't be deleted — paid history would dangle. */
    boolean existsByPackageId(UUID packageId);

    /** Client's most recent subscription with a given coach. */
    Optional<Subscription> findFirstByCoachIdAndClientIdOrderByEndDateDesc(UUID coachId, UUID clientId);

    /** Used by the scheduled expiry job. */
    @Query("select s from Subscription s where s.status = 'active' and s.endDate < :now")
    List<Subscription> findExpired(Instant now);

    @Modifying
    @Query("update Subscription s set s.status = 'expired', s.updatedAt = :now where s.status = 'active' and s.endDate < :now")
    int expireEnded(Instant now);
}
