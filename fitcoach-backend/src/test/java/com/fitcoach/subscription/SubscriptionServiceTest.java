package com.fitcoach.subscription;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.coach.CoachingPackageRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.common.RealtimePublisher;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import java.time.Instant;
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

/** A client may only ever cancel their own subscription. */
@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock SubscriptionRepository subscriptions;
    @Mock CoachingPackageRepository packages;
    @Mock UserRepository users;
    @Mock RealtimePublisher realtime;

    SubscriptionService service;
    User client = TestUsers.client();
    User otherClient = TestUsers.client();
    User coach = TestUsers.coach();

    @BeforeEach
    void setUp() {
        service = new SubscriptionService(subscriptions, packages, users, realtime);
    }

    private Subscription sub(UUID clientId) {
        Subscription s = new Subscription();
        s.setId(UUID.randomUUID());
        s.setClientId(clientId);
        s.setCoachId(coach.getId());
        s.setStatus(SubscriptionStatus.active);
        s.setStartDate(Instant.now().minusSeconds(86400));
        s.setEndDate(Instant.now().plusSeconds(86400 * 30L));
        return s;
    }

    @Test
    @DisplayName("CROSS-TENANT: cancelling another client's subscription is a 404, not a 403")
    void cannotCancelAnotherClientsSubscription() {
        Subscription theirs = sub(otherClient.getId());
        // The lookup filters on the caller's id, so the row appears not to exist.
        when(subscriptions.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        assertThatThrownBy(() -> service.cancel(client, theirs.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("NOT_FOUND");
                });
        assertThat(theirs.getStatus()).isEqualTo(SubscriptionStatus.active); // untouched
        verify(subscriptions, never()).save(any());
        verifyNoInteractions(realtime);
    }

    @Test
    @DisplayName("a coach cannot use the client cancellation endpoint")
    void coachCannotCancel() {
        assertThatThrownBy(() -> service.cancel(coach, UUID.randomUUID()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("cancelling your own active plan ends it now and notifies the coach")
    void cancellingOwnPlanEndsIt() {
        Subscription mine = sub(client.getId());
        when(subscriptions.findById(mine.getId())).thenReturn(Optional.of(mine));

        service.cancel(client, mine.getId());

        assertThat(mine.getStatus()).isEqualTo(SubscriptionStatus.cancelled);
        assertThat(mine.getEndDate()).isBeforeOrEqualTo(Instant.now());
        verify(realtime).publishToPair("subscription", coach.getId(), client.getId());
    }

    @Test
    @DisplayName("the client list is scoped to the caller's own id")
    void mineIsScopedToCaller() {
        when(subscriptions.findAllForClient(client.getId())).thenReturn(List.of(sub(client.getId())));
        when(users.findById(coach.getId())).thenReturn(Optional.of(coach));
        when(packages.findById(any())).thenReturn(Optional.empty());

        List<SubscriptionRowDto> rows = service.mine(client);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).clientId()).isEqualTo(client.getId());
        assertThat(rows.get(0).coachName()).isEqualTo(coach.getName());
    }
}
