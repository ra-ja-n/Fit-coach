package com.fitcoach.chat;

import java.time.Instant;
import java.util.UUID;

public final class ChatDtos {

    private ChatDtos() {}

    public record ChatMessageDto(
            UUID id, UUID coachId, UUID clientId, UUID senderId,
            String body, Instant createdAt) {

        public static ChatMessageDto from(ChatMessage m) {
            return new ChatMessageDto(m.getId(), m.getCoachId(), m.getClientId(),
                    m.getSenderId(), m.getBody(), m.getCreatedAt());
        }
    }

    /** One row in the coach's inbox. */
    public record ChatThreadRow(
            UUID clientId, String clientName, boolean active,
            String lastMessage, Instant lastAt, long unread) {}

    /** Header state for an open conversation. */
    public record ChatContext(boolean active, String coachName, String clientName) {}

    public record SendMessageRequest(UUID coachId, UUID clientId, String body) {}
}
