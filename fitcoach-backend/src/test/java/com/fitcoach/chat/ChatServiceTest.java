package com.fitcoach.chat;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/**
 * Chat is the pair's private conversation, so the bar is: nobody outside the
 * pair reads it, and a lapsed pair cannot keep messaging.
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock ChatMessageRepository messages;
    @Mock ChatThreadRepository threads;
    @Mock SubscriptionRepository subscriptions;
    @Mock UserRepository users;
    @Mock RealtimePublisher realtime;

    ChatService service;

    final UUID coachId = UUID.randomUUID();
    final UUID clientId = UUID.randomUUID();

    User coach, client, otherCoach, otherClient;

    @BeforeEach
    void setUp() {
        service = new ChatService(messages, threads, subscriptions, users,
                new OwnershipGuard(subscriptions), realtime);
        coach = TestUsers.user(coachId, com.fitcoach.user.UserRole.coach);
        client = TestUsers.user(clientId, com.fitcoach.user.UserRole.client);
        otherCoach = TestUsers.coach();
        otherClient = TestUsers.client();
    }

    @Test
    @DisplayName("CROSS-TENANT: another coach cannot read this pair's messages (404)")
    void otherCoachCannotReadHistory() {
        assertThatThrownBy(() -> service.history(otherCoach, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("NOT_FOUND");
                });
        verify(messages, never()).thread(any(), any());
    }

    @Test
    @DisplayName("CROSS-TENANT: another client cannot read this pair's messages (404)")
    void otherClientCannotReadHistory() {
        assertThatThrownBy(() -> service.history(otherClient, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("CROSS-TENANT: a coach cannot post into a pair they are not part of")
    void coachCannotSendIntoForeignPair() {
        assertThatThrownBy(() -> service.send(otherCoach, coachId, clientId, "hi"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(messages, never()).save(any());
        verifyNoInteractions(realtime);
    }

    @Test
    @DisplayName("EXPIRY RULE: a lapsed pair can read the thread but cannot send")
    void lapsedPairCanReadButNotSend() {
        when(messages.thread(coachId, clientId)).thenReturn(List.of());
        assertThatCode(() -> service.history(client, coachId, clientId)).doesNotThrowAnyException();

        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.empty());
        ApiException e = catchThrowableOfType(ApiException.class,
                () -> service.send(client, coachId, clientId, "still there?"));
        assertThat(e.getCode()).isEqualTo("SUBSCRIBE_REQUIRED");
        verify(messages, never()).save(any());
    }

    @Test
    @DisplayName("an active pair sends, stores, and pushes to both members")
    void activePairSendsAndPublishes() {
        Subscription sub = new Subscription();
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.of(sub));
        when(messages.save(any(ChatMessage.class))).thenAnswer(i -> {
            ChatMessage m = i.getArgument(0);
            m.setId(UUID.randomUUID());
            // @PrePersist does not fire on a mocked repository, so set the
            // timestamp the real entity would have.
            m.setCreatedAt(java.time.Instant.now());
            return m;
        });
        when(threads.findByCoachIdAndClientId(coachId, clientId)).thenReturn(Optional.empty());

        ChatDtos.ChatMessageDto sent = service.send(coach, coachId, clientId, "  new plan is live  ");

        assertThat(sent.body()).isEqualTo("new plan is live"); // trimmed
        assertThat(sent.senderId()).isEqualTo(coachId);
        verify(realtime).publishChat(eq(coachId), eq(clientId), any());
        verify(realtime).publishToPair("chat", coachId, clientId);
        verify(threads).save(argThat(t -> t.getLastReadByCoach().equals(sent.createdAt())));
    }

    @Test
    @DisplayName("empty and over-long bodies are rejected as validation errors")
    void bodyValidation() {
        Subscription sub = new Subscription();
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.of(sub));
        assertThatThrownBy(() -> service.send(coach, coachId, clientId, "   "))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("VALIDATION"));
        assertThatThrownBy(() -> service.send(coach, coachId, clientId, "x".repeat(2001)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("VALIDATION"));
    }

    @Test
    @DisplayName("a client's inbox collapses repeat subscriptions to one row per client")
    void inboxDedupesClients() {
        Subscription older = sub(clientId, com.fitcoach.subscription.SubscriptionStatus.expired, 100);
        Subscription newer = sub(clientId, com.fitcoach.subscription.SubscriptionStatus.active, 10);
        List<Subscription> best = ChatService.bestSubPerClient(List.of(older, newer));
        assertThat(best).hasSize(1);
        assertThat(best.get(0).getStatus()).isEqualTo(com.fitcoach.subscription.SubscriptionStatus.active);
    }

    private Subscription sub(UUID clientId, com.fitcoach.subscription.SubscriptionStatus status, long daysFromNow) {
        Subscription s = new Subscription();
        s.setCoachId(coachId);
        s.setClientId(clientId);
        s.setStatus(status);
        s.setEndDate(java.time.Instant.now().plusSeconds(daysFromNow * 86400));
        return s;
    }
}
