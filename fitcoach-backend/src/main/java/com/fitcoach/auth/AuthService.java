package com.fitcoach.auth;

import com.fitcoach.common.ApiException;
import com.fitcoach.security.JwtTokenProvider;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import com.fitcoach.user.UserRole;
import io.jsonwebtoken.Claims;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger secLog = LoggerFactory.getLogger(AuthService.class);
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCK_MINUTES = 15;

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final JwtTokenProvider jwt;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens,
                       PasswordEncoder encoder, JwtTokenProvider jwt) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public record TokenPair(String accessToken, String refreshToken, User user) {}

    @Transactional
    public User register(UserRole role, String name, String email, String password) {
        if (role == UserRole.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Admin accounts cannot self-register.");
        }
        String normalized = email.trim().toLowerCase();
        if (users.findByEmail(normalized).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists");
        }
        User u = new User();
        u.setRole(role);
        u.setName(name.trim());
        u.setEmail(normalized);
        u.setPasswordHash(encoder.encode(password)); // BCrypt, never logged
        return users.save(u);
    }

    @Transactional
    public TokenPair login(String email, String password) {
        User user = users.findByEmail(email.trim().toLowerCase()).orElse(null);

        if (user != null && user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            long mins = (user.getLockedUntil().getEpochSecond() - Instant.now().getEpochSecond()) / 60 + 1;
            throw new ApiException(HttpStatus.LOCKED, "LOCKED", "Too many failed attempts. Try again in " + mins + " min.");
        }

        if (user == null || !encoder.matches(password, user.getPasswordHash())) {
            if (user != null) {
                user.setFailedAttempts(user.getFailedAttempts() + 1);
                if (user.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
                    user.setLockedUntil(Instant.now().plusSeconds(LOCK_MINUTES * 60));
                    user.setFailedAttempts(0);
                    secLog.warn("account locked after {} failed attempts: {}", MAX_FAILED_ATTEMPTS, user.getEmail());
                }
                users.save(user);
            }
            // Generic on purpose — never reveal which field is wrong.
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Incorrect email or password");
        }

        if (user.isSuspended()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SUSPENDED", "This account has been suspended. Contact support.");
        }

        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        users.save(user);
        return issueFor(user);
    }

    @Transactional
    public TokenPair refresh(String refreshToken) {
        Claims claims;
        try {
            claims = jwt.parse(refreshToken);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Session expired. Please sign in again.");
        }
        if (!JwtTokenProvider.TYPE_REFRESH.equals(claims.get("typ", String.class))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Session expired. Please sign in again.");
        }
        RefreshToken row = refreshTokens.findById(claims.getId()).orElse(null);
        if (row == null || row.isRevoked() || row.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Session expired. Please sign in again.");
        }
        User user = users.findById(java.util.UUID.fromString(claims.getSubject())).orElse(null);
        if (user == null || user.isSuspended()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Session expired. Please sign in again.");
        }
        // Rotation: revoke the used refresh token, issue a fresh pair.
        row.setRevoked(true);
        refreshTokens.save(row);
        return issueFor(user);
    }

    @Transactional
    public void logout(String refreshToken) {
        try {
            Claims claims = jwt.parse(refreshToken);
            refreshTokens.findById(claims.getId()).ifPresent(row -> {
                row.setRevoked(true);
                refreshTokens.save(row);
            });
        } catch (Exception ignored) {
            // best effort
        }
    }

    /** Issues a fresh access+refresh pair (rotation of the old one happens in refresh()). */
    @Transactional
    public TokenPair issueFor(User user) {
        String access = jwt.issueAccessToken(user);
        JwtTokenProvider.IssuedRefresh refresh = jwt.issueRefreshToken(user);
        RefreshToken row = new RefreshToken();
        row.setJti(refresh.jti());
        row.setUserId(user.getId());
        row.setExpiresAt(refresh.expiresAt());
        row.setRevoked(false);
        refreshTokens.save(row);
        return new TokenPair(access, refresh.token(), user);
    }
}
