package com.fitcoach.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP broker for chat and cache-invalidation events.
 *
 * Clients connect to /ws and authenticate on the CONNECT frame (see
 * StompAuthChannelInterceptor — a handshake interceptor can't work here because
 * React Native cannot set HTTP headers on the upgrade request).
 *
 * Delivery is pair-scoped: /user/queue/chat.{coachId}.{clientId}. Services only
 * publish to that destination *after* OwnershipGuard has proved the caller
 * belongs to the pair, and the broker resolves /user against the CONNECT-time
 * principal — so a socket can subscribe to a pair name it likes, but only ever
 * receives what the server addressed to its own user id.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor authInterceptor;

    public WebSocketConfig(StompAuthChannelInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
    }
}
