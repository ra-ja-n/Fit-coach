package com.fitcoach.security;

import java.security.Principal;

/**
 * The identity attached to a STOMP session. The name is the user id, which is
 * what {@code convertAndSendToUser} resolves {@code /user/queue/...} against —
 * so the broker can only ever hand a message to the socket that proved it owns
 * that user id at CONNECT time.
 */
public record StompPrincipal(String userId) implements Principal {
    @Override
    public String getName() {
        return userId;
    }
}
