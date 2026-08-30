package com.fitcoach.payment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    /** A client may only ever see their own payment. */
    Optional<Payment> findByIdAndClientId(UUID id, UUID clientId);

    List<Payment> findByCoachIdAndStatusOrderByCreatedAtDesc(UUID coachId, PaymentStatus status);

    List<Payment> findByStatusOrderByCreatedAtDesc(PaymentStatus status, Pageable page);

    @Query("select coalesce(sum(p.amountCents), 0) from Payment p where p.coachId = :coachId and p.status = 'captured'")
    long sumCapturedForCoach(UUID coachId);

    @Query("select coalesce(sum(p.amountCents), 0) from Payment p where p.coachId = :coachId "
            + "and p.status = 'captured' and p.createdAt >= :since")
    long sumCapturedForCoachSince(UUID coachId, Instant since);

    @Query("select coalesce(sum(p.amountCents), 0) from Payment p where p.status = 'captured'")
    long sumAllCaptured();

    long countByStatus(PaymentStatus status);
}
