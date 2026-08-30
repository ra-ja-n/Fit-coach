package com.fitcoach.chat;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    @Query("select m from ChatMessage m where m.coachId = :coachId and m.clientId = :clientId "
            + "order by m.createdAt asc, m.id asc")
    List<ChatMessage> thread(UUID coachId, UUID clientId);

    @Query("select m from ChatMessage m where m.coachId = :coachId and m.clientId = :clientId "
            + "order by m.createdAt desc, m.id desc")
    List<ChatMessage> newestFirst(UUID coachId, UUID clientId, org.springframework.data.domain.Pageable page);

    Optional<ChatMessage> findFirstByCoachIdAndClientIdOrderByCreatedAtDescIdDesc(UUID coachId, UUID clientId);

    /** Unread = the other side's messages newer than my read cursor. */
    @Query("select count(m) from ChatMessage m where m.coachId = :coachId and m.clientId = :clientId "
            + "and m.senderId <> :viewerId and m.createdAt > :since")
    long countUnread(UUID coachId, UUID clientId, UUID viewerId, Instant since);

    long countByCoachIdAndClientId(UUID coachId, UUID clientId);
}
