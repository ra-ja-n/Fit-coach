package com.fitcoach.chat;

import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Live chat over STOMP.
 *
 * Clients send to {@code /app/chat.send}; the message is persisted through the
 * exact same ChatService path as the REST endpoint (pair access + active
 * subscription), then pushed to {@code /user/queue/chat.{coachId}.{clientId}}
 * for both members of the pair. There is no write path that bypasses
 * OwnershipGuard — REST and STOMP share one implementation.
 */
@Controller
public class ChatWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final ChatService chat;
    private final UserRepository users;

    public ChatWebSocketHandler(ChatService chat, UserRepository users) {
        this.chat = chat;
        this.users = users;
    }

    @MessageMapping("/chat.send")
    public void onSend(@Payload ChatDtos.SendMessageRequest req, Principal principal) {
        if (principal == null) {
            log.warn("unauthenticated STOMP chat.send dropped");
            return;
        }
        User actor = users.findById(UUID.fromString(principal.getName())).orElse(null);
        if (actor == null) {
            log.warn("STOMP chat.send from unknown principal {}", principal.getName());
            return;
        }
        // Throws ApiException on a cross-tenant or lapsed pair; the STOMP error
        // channel surfaces it to the sender, and nothing is stored or pushed.
        chat.send(actor, req.coachId(), req.clientId(), req.body());
    }
}
