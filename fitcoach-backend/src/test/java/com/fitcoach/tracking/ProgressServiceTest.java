package com.fitcoach.tracking;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.subscription.SubscriptionStatus;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
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

/** Progress history tenancy, plus the renewal-prompt behaviour on a lapsed plan. */
@ExtendWith(MockitoExtension.class)
class ProgressServiceTest {

    @Mock ProgressEntryRepository entries;
    @Mock SubscriptionRepository subscriptions;
    @Mock UserRepository users;
    @Mock RealtimePublisher realtime;

    ProgressService service;

    final UUID coachId = UUID.randomUUID();
    User coach = TestUsers.user(coachId, com.fitcoach.user.UserRole.coach);
    User client = TestUsers.client();
    User otherCoach = TestUsers.coach();
    User otherClient = TestUsers.client();

    @BeforeEach
    void setUp() {
        service = new ProgressService(entries, subscriptions, users,
                new OwnershipGuard(subscriptions), realtime);
    }

    /**
     * A coach always passes requirePairAccess for a pair keyed on their own id,
     * so the thing that actually stops coach B reading coach A's client is the
     * pair-existence check. Both must answer 404 — never a partial view.
     */
    @Test
    @DisplayName("CROSS-TENANT: a coach asking about someone else's client gets 404, not an empty page")
    void coachCannotReadAnotherCoachesClient() {
        when(subscriptions.existsByCoachIdAndClientId(otherCoach.getId(), client.getId()))
                .thenReturn(false);
        assertThatThrownBy(() -> service.forClient(otherCoach, client.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("NOT_FOUND");
                });
        verify(entries, never()).findByCoachIdAndClientIdOrderByEntryDateDesc(any(), any());
    }

    @Test
    @DisplayName("CROSS-TENANT: a client cannot read history through the coach endpoint")
    void clientCannotUseCoachEndpoint() {
        assertThatThrownBy(() -> service.forClient(client, otherClient.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("a guessed coachId gives the client an empty history, identical to no check-ins")
    void guessedCoachIdLooksEmpty() {
        when(subscriptions.existsByCoachIdAndClientId(otherCoach.getId(), client.getId()))
                .thenReturn(false);
        assertThat(service.mine(client, otherCoach.getId())).isEmpty();
        verify(entries, never()).findByCoachIdAndClientIdOrderByEntryDateDesc(any(), any());
    }

    @Test
    @DisplayName("the pair's coach reads the history once the pair exists")
    void pairCoachReadsHistory() {
        when(subscriptions.existsByCoachIdAndClientId(coachId, client.getId())).thenReturn(true);
        ProgressEntry e = new ProgressEntry();
        e.setCoachId(coachId);
        e.setClientId(client.getId());
        e.setEntryDate(LocalDate.now());
        when(entries.findByCoachIdAndClientIdOrderByEntryDateDesc(coachId, client.getId()))
                .thenReturn(List.of(e));
        assertThat(service.forClient(coach, client.getId())).hasSize(1);
    }

    @Test
    @DisplayName("EXPIRY RULE: logging with a lapsed plan yields SUBSCRIPTION_EXPIRED + the coach to renew with")
    void lapsedClientGetsRenewalPrompt() {
        Subscription lapsed = new Subscription();
        lapsed.setCoachId(coachId);
        lapsed.setClientId(client.getId());
        lapsed.setStatus(SubscriptionStatus.expired);
        when(subscriptions.findActiveByClient(client.getId())).thenReturn(Optional.empty());
        when(subscriptions.findAllForClient(client.getId())).thenReturn(List.of(lapsed));
        when(users.findById(coachId)).thenReturn(Optional.of(coach));

        ApiException e = catchThrowableOfType(ApiException.class,
                () -> service.log(client, new ProgressService.LogRequest(
                        BigDecimal.valueOf(80), null, null, null)));
        assertThat(e.getCode()).isEqualTo("SUBSCRIPTION_EXPIRED");
        assertThat(e.getData()).containsEntry("coachId", coachId.toString());
        assertThat(e.getData()).containsEntry("coachName", coach.getName());
        verify(entries, never()).save(any());
    }

    @Test
    @DisplayName("a client who never subscribed gets SUBSCRIBE_REQUIRED instead")
    void neverSubscribedGetsSubscribeRequired() {
        when(subscriptions.findActiveByClient(client.getId())).thenReturn(Optional.empty());
        when(subscriptions.findAllForClient(client.getId())).thenReturn(List.of());

        ApiException e = catchThrowableOfType(ApiException.class,
                () -> service.log(client, new ProgressService.LogRequest(
                        BigDecimal.valueOf(80), null, null, null)));
        assertThat(e.getCode()).isEqualTo("SUBSCRIBE_REQUIRED");
    }

    @Test
    @DisplayName("logging on an active plan upserts today's entry and notifies the coach")
    void logUpsertsTodaysEntry() {
        Subscription sub = new Subscription();
        sub.setCoachId(coachId);
        sub.setClientId(client.getId());
        when(subscriptions.findActiveByClient(client.getId())).thenReturn(Optional.of(sub));
        when(entries.findByClientIdAndCoachIdAndEntryDate(client.getId(), coachId, LocalDate.now()))
                .thenReturn(Optional.empty());
        when(entries.save(any(ProgressEntry.class))).thenAnswer(i -> i.getArgument(0));

        ProgressEntryDto saved = service.log(client, new ProgressService.LogRequest(
                BigDecimal.valueOf(79.5), null, "feeling good", null));

        assertThat(saved.weightKg()).isEqualByComparingTo("79.5");
        assertThat(saved.notes()).isEqualTo("feeling good");
        assertThat(saved.coachId()).isEqualTo(coachId);
        verify(realtime).publishToPair("progress", coachId, client.getId());
    }
}
