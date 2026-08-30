package com.fitcoach.security;

import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Issues and verifies JWTs: short-lived access (~15 min) + long refresh (~30 days). */
@Component
public class JwtTokenProvider {

    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final SecretKey key;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtTokenProvider(
            @Value("${fitcoach.jwt.secret}") String secret,
            @Value("${fitcoach.jwt.access-ttl-minutes:15}") long accessMinutes,
            @Value("${fitcoach.jwt.refresh-ttl-days:30}") long refreshDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = Duration.ofMinutes(accessMinutes);
        this.refreshTtl = Duration.ofDays(refreshDays);
    }

    public String issueAccessToken(User user) {
        return build(user.getId(), user.getRole(), TYPE_ACCESS, accessTtl, UUID.randomUUID().toString());
    }

    public IssuedRefresh issueRefreshToken(User user) {
        String jti = UUID.randomUUID().toString();
        String token = build(user.getId(), user.getRole(), TYPE_REFRESH, refreshTtl, jti);
        return new IssuedRefresh(token, jti, Instant.now().plus(refreshTtl));
    }

    private String build(UUID subject, UserRole role, String type, Duration ttl, String jti) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(subject.toString())
                .claim("role", role.name())
                .claim("typ", type)
                .id(jti)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** @throws io.jsonwebtoken.JwtException on any tampering/expiry — callers map to 401. */
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public record IssuedRefresh(String token, String jti, Instant expiresAt) {}
}
