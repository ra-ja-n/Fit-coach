package com.fitcoach.common;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Server -> client push over the STOMP broker (see config/WebSocketConfig).
 *
 * Everything is delivered to a *user* destination, and the target users are
 * chosen here from the coach/client ids of a record whose access has already
 * been verified by OwnershipGuard. The broker never decides who may see
 * something — callers prove ownership first, then publish.
 */
@Component
public class RealtimePublisher {

    /** Cache-invalidation channel: "something in this pair changed". */
    public static final String QUEUE_EVENTS = "/queue/events";

    private final SimpMessagingTemplate messaging;

    public RealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    /** @param type one of chat | progress | plan | subscription */
    public void publishToPair(String type, UUID coachId, UUID clientId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("coachId", String.valueOf(coachId));
        payload.put("clientId", String.valueOf(clientId));
        messaging.convertAndSendToUser(String.valueOf(coachId), QUEUE_EVENTS, payload);
        messaging.convertAndSendToUser(String.valueOf(clientId), QUEUE_EVENTS, payload);
    }

    /** Pair-scoped chat channel — see ChatWebSocketHandler. */
    public static String chatQueue(UUID coachId, UUID clientId) {
        return "/queue/chat." + coachId + "." + clientId;
    }

    public void publishChat(UUID coachId, UUID clientId, Object message) {
        messaging.convertAndSendToUser(String.valueOf(coachId), chatQueue(coachId, clientId), message);
        messaging.convertAndSendToUser(String.valueOf(clientId), chatQueue(coachId, clientId), message);
    }
}
