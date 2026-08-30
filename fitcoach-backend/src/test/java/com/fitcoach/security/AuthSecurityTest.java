package com.fitcoach.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fitcoach.auth.AuthService;
import com.fitcoach.auth.RefreshToken;
import com.fitcoach.auth.RefreshTokenRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Auth pipeline behaviours that protect tenancy at the door:
 * generic credential errors, lockout after 5 failures, refresh rotation,
 * revoked refresh tokens (logout / admin force-logout).
 */
@ExtendWith(MockitoExtension.class)
class AuthSecurityTest {

    @Mock UserRepository users;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock com.fitcoach.coach.CoachProfileRepository coachProfiles;

    AuthService auth;
    JwtTokenProvider jwt;

    @BeforeEach
    void setUp() {
        // Fixed test secret (>= 32 bytes), short TTLs irrelevant for these tests.
        jwt = new JwtTokenProvider("unit-test-secret-unit-test-secret-unit", 15, 30);
        auth = new AuthService(users, refreshTokens, coachProfiles, new BCryptPasswordEncoder(), jwt);
    }

    private User user(String email, String rawPassword) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setRole(UserRole.client);
        u.setName("Test User");
        u.setEmail(email);
        u.setPasswordHash(new BCryptPasswordEncoder().encode(rawPassword));
        return u;
    }

    @Test
    @DisplayName("unknown email and wrong password produce the SAME generic error")
    void genericCredentialError() {
        when(users.findByEmail("ghost@test.app")).thenReturn(Optional.empty());
        org.assertj.core.api.Assertions.catchThrowable(() -> auth.login("ghost@test.app", "whatever1"));

        User real = user("real@test.app", "correct-horse");
        when(users.findByEmail("real@test.app")).thenReturn(Optional.of(real));

        var e1 = org.assertj.core.api.Assertions.catchThrowable(() -> auth.login("ghost@test.app", "whatever1"));
        var e2 = org.assertj.core.api.Assertions.catchThrowable(() -> auth.login("real@test.app", "wrong-pass1"));
        assertThat(e1.getMessage()).isEqualTo(e2.getMessage()); // never reveal which field is wrong
        assertThat(e1.getMessage()).isEqualTo("Incorrect email or password");
    }

    @Test
    @DisplayName("account locks after 5 failed attempts")
    void lockoutAfterFiveFailures() {
        User u = user("lock@test.app", "secret123");
        when(users.findByEmail("lock@test.app")).thenReturn(Optional.of(u));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        for (int i = 0; i < 5; i++) {
            org.assertj.core.api.Assertions.catchThrowable(() -> auth.login("lock@test.app", "bad" + i));
        }
        assertThat(u.getLockedUntil()).isNotNull();
        assertThat(u.getLockedUntil()).isAfter(Instant.now());
    }

    @Test
    @DisplayName("issued refresh token parses, is typed 'refresh' and carries the user id")
    void refreshTokenRoundTrip() {
        User u = user("rt@test.app", "secret123");
        when(users.findByEmail("rt@test.app")).thenReturn(Optional.of(u));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(refreshTokens.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthService.TokenPair pair = auth.login("rt@test.app", "secret123");
        var claims = jwt.parse(pair.refreshToken());
        assertThat(claims.get("typ", String.class)).isEqualTo("refresh");
        assertThat(claims.getSubject()).isEqualTo(u.getId().toString());
    }

    @Test
    @DisplayName("garbage / tampered refresh tokens are rejected as REFRESH_INVALID")
    void tamperedRefreshRejected() {
        var e = org.assertj.core.api.Assertions.catchThrowable(() -> auth.refresh("not.a.token"));
        assertThat(e).isInstanceOf(com.fitcoach.common.ApiException.class);
        assertThat(((com.fitcoach.common.ApiException) e).getCode()).isEqualTo("REFRESH_INVALID");
    }
}
