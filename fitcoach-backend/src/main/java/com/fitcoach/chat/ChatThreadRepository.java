package com.fitcoach.chat;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatThreadRepository extends JpaRepository<ChatThread, ChatThreadId> {

    Optional<ChatThread> findByCoachIdAndClientId(UUID coachId, UUID clientId);
}
