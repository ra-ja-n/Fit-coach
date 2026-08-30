package com.fitcoach.admin;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.auth.RefreshTokenRepository;
import com.fitcoach.chat.ChatMessageRepository;
import com.fitcoach.coach.CoachProfileRepository;
import com.fitcoach.common.ApiException;
import com.fitcoach.payment.PaymentRepository;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.tracking.ProgressEntryRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
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

/** Admins see everything and change nothing private; nobody else gets in at all. */
@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock UserRepository users;
    @Mock CoachProfileRepository coachProfiles;
    @Mock SubscriptionRepository subscriptions;
    @Mock PaymentRepository payments;
    @Mock ProgressEntryRepository progress;
    @Mock ChatMessageRepository chatMessages;
    @Mock RefreshTokenRepository refreshTokens;

    AdminService service;
    User admin = TestUsers.admin();
    User coach = TestUsers.coach();
    User client = TestUsers.client();

    @BeforeEach
    void setUp() {
        service = new AdminService(users, coachProfiles, subscriptions, payments, progress,
                chatMessages, refreshTokens, new OwnershipGuard(subscriptions));
    }

    @Test
    @DisplayName("a coach cannot use the admin support view")
    void coachCannotUseSupportView() {
        assertThatThrownBy(() -> service.pairView(coach, coach.getId(), client.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("a client cannot use the admin support view")
    void clientCannotUseSupportView() {
        assertThatThrownBy(() -> service.pairView(client, coach.getId(), client.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("admin may READ any pair — and the view carries no write affordance")
    void adminCanReadAnyPair() {
        when(users.findById(coach.getId())).thenReturn(Optional.of(coach));
        when(users.findById(client.getId())).thenReturn(Optional.of(client));
        when(subscriptions.findActive(coach.getId(), client.getId())).thenReturn(Optional.empty());
        when(progress.findByCoachIdAndClientIdOrderByEntryDateDesc(coach.getId(), client.getId()))
                .thenReturn(java.util.List.of());
        when(chatMessages.countByCoachIdAndClientId(coach.getId(), client.getId())).thenReturn(3L);

        AdminDtos.PairView view = service.pairView(admin, coach.getId(), client.getId());
        assertThat(view.chatMessages()).isEqualTo(3);
        assertThat(view.activeSubscription()).isFalse();
        verify(subscriptions, never()).save(any());
    }

    @Test
    @DisplayName("suspending a user revokes their refresh tokens so sessions die")
    void suspendRevokesSessions() {
        when(users.findById(client.getId())).thenReturn(Optional.of(client));
        service.setSuspended(client.getId(), true);
        assertThat(client.isSuspended()).isTrue();
        verify(refreshTokens).revokeAllForUser(client.getId());
    }

    @Test
    @DisplayName("an admin cannot suspend another admin through this endpoint (404, not 403)")
    void cannotSuspendAdmin() {
        User otherAdmin = TestUsers.admin();
        when(users.findById(otherAdmin.getId())).thenReturn(Optional.of(otherAdmin));
        assertThatThrownBy(() -> service.setSuspended(otherAdmin.getId(), true))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(refreshTokens, never()).revokeAllForUser(any());
    }

    @Test
    @DisplayName("force logout revokes sessions without touching the account")
    void forceLogoutRevokesOnlySessions() {
        when(users.findById(client.getId())).thenReturn(Optional.of(client));
        service.forceLogout(client.getId());
        assertThat(client.isSuspended()).isFalse();
        verify(refreshTokens).revokeAllForUser(client.getId());
    }

    @Test
    @DisplayName("approving a pending coach flips their status to approved")
    void approveCoach() {
        var profile = new com.fitcoach.coach.CoachProfile();
        profile.setUserId(coach.getId());
        profile.setStatus(com.fitcoach.coach.CoachStatus.pending);
        when(coachProfiles.findById(coach.getId())).thenReturn(Optional.of(profile));

        service.decideCoach(coach.getId(), true);
        assertThat(profile.getStatus()).isEqualTo(com.fitcoach.coach.CoachStatus.approved);
    }

    @Test
    @DisplayName("the admin role check is on the service, not only the controller")
    void requireAdminIsEnforcedInService() {
        assertThatThrownBy(() -> AdminService.requireAdmin(TestUsers.user(UUID.randomUUID(), UserRole.client)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }
}
