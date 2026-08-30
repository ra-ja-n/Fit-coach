package com.fitcoach.config;

import com.fitcoach.security.JwtTokenProvider;
import com.fitcoach.security.StompPrincipal;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import io.jsonwebtoken.Claims;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Authenticates the STOMP CONNECT frame.
 *
 * A handshake interceptor is not enough here: React Native (and the browser
 * WebSocket API) cannot set HTTP headers on the upgrade request, so the access
 * token arrives as a STOMP CONNECT header instead. A rejected or absent token
 * leaves the session anonymous; every publish is still re-checked against the
 * authenticated principal, so an anonymous socket can connect but sees nothing.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger secLog = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    private final JwtTokenProvider tokens;
    private final UserRepository users;

    public StompAuthChannelInterceptor(JwtTokenProvider tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            secLog.warn("stomp connect without bearer token — session stays anonymous");
            return message;
        }
        try {
            Claims claims = tokens.parse(header.substring(7));
            if (!JwtTokenProvider.TYPE_ACCESS.equals(claims.get("typ", String.class))) {
                secLog.warn("stomp connect attempted with a non-access token");
                return message;
            }
            User user = users.findById(UUID.fromString(claims.getSubject())).orElse(null);
            if (user == null || user.isSuspended()) {
                secLog.warn("stomp connect rejected: unknown or suspended user {}", claims.getSubject());
                return message;
            }
            accessor.setUser(new StompPrincipal(String.valueOf(user.getId())));
        } catch (Exception e) {
            secLog.warn("stomp connect with invalid token: {}", e.getMessage());
        }
        return message;
    }
}
