package com.fitcoach.security;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.common.ApiException;
import com.fitcoach.subscription.Subscription;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
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
 * OwnershipGuard is the single source of truth for tenancy — these tests are
 * the top-priority safety net of the whole backend.
 */
@ExtendWith(MockitoExtension.class)
class OwnershipGuardTest {

    @Mock SubscriptionRepository subscriptions;
    OwnershipGuard guard;

    final UUID coachId = UUID.randomUUID();
    final UUID clientId = UUID.randomUUID();
    final UUID otherCoachId = UUID.randomUUID();
    final UUID otherClientId = UUID.randomUUID();

    User coach, client, otherCoach, otherClient, admin;

    @BeforeEach
    void setUp() {
        guard = new OwnershipGuard(subscriptions);
        coach = user(coachId, UserRole.coach);
        client = user(clientId, UserRole.client);
        otherCoach = user(otherCoachId, UserRole.coach);
        otherClient = user(otherClientId, UserRole.client);
        admin = user(UUID.randomUUID(), UserRole.admin);
    }

    private User user(UUID id, UserRole role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setEmail(role + "@test.app");
        u.setName("Test");
        return u;
    }

    // ------------------------------------------------------------- reads ---

    @Test
    @DisplayName("pair coach and pair client can read their own data")
    void pairMembersCanRead() {
        assertThatCode(() -> guard.requirePairAccess(coach, coachId, clientId)).doesNotThrowAnyException();
        assertThatCode(() -> guard.requirePairAccess(client, coachId, clientId)).doesNotThrowAnyException();
        assertThatCode(() -> guard.requirePairAccess(admin, coachId, clientId)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("CROSS-TENANT: another coach is rejected with 404 NOT_FOUND (looks like missing)")
    void otherCoachGetsNotFound() {
        assertThatThrownBy(() -> guard.requirePairAccess(otherCoach, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("NOT_FOUND");
                });
    }

    @Test
    @DisplayName("CROSS-TENANT: another client (even of the SAME coach) is rejected with 404")
    void otherClientOfSameCoachGetsNotFound() {
        assertThatThrownBy(() -> guard.requirePairAccess(otherClient, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("CROSS-TENANT: a client of coach B never sees coach A's data")
    void clientOfDifferentCoachGetsNotFound() {
        assertThatThrownBy(() -> guard.requirePairAccess(client, otherCoachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("guessed client id by an unrelated client looks identical to not-found")
    void guessedIdsLookLikeMissing() {
        ApiException crossTenant = catchThrowableOfType(ApiException.class,
                () -> guard.requirePairAccess(otherClient, coachId, clientId));
        assertThat(crossTenant.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(crossTenant.getMessage()).isEqualTo("Resource not found");
    }

    // ------------------------------------------------------------ writes ---

    @Test
    @DisplayName("writes require an ACTIVE subscription for the pair")
    void writesRequireActiveSubscription() {
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.of(new Subscription()));
        assertThatCode(() -> guard.requireWriteAccess(client, coachId, clientId)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("EXPIRY RULE: lapsed pair keeps READ but loses WRITE (subscribe-to-unlock, not a tech error)")
    void lapsedPairIsReadOnly() {
        when(subscriptions.findActive(coachId, clientId)).thenReturn(Optional.empty());
        assertThatCode(() -> guard.requirePairAccess(client, coachId, clientId)).doesNotThrowAnyException();
        assertThatThrownBy(() -> guard.requireWriteAccess(client, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getCode()).isEqualTo("SUBSCRIBE_REQUIRED");
                    assertThat(ex.getMessage()).contains("Subscribe");
                });
    }

    @Test
    @DisplayName("admin can read but NEVER write private data")
    void adminCannotWrite() {
        assertThatThrownBy(() -> guard.requireWriteAccess(admin, coachId, clientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("client can never write through the coach path, and vice versa")
    void roleImpersonationBlocked() {
        assertThatThrownBy(() -> guard.requireCoachWriteAccess(client, clientId))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("coach write for a NON-subscribed client is rejected as not-found (security-logged)")
    void coachWriteForNonSubscriberRejected() {
        when(subscriptions.findActive(coachId, otherClientId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> guard.requireCoachWriteAccess(coach, otherClientId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("coach-scoped resources: other coaches get not-found")
    void coachScopeEnforced() {
        assertThatCode(() -> guard.requireCoachOwns(coach, coachId)).doesNotThrowAnyException();
        assertThatThrownBy(() -> guard.requireCoachOwns(otherCoach, coachId))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
