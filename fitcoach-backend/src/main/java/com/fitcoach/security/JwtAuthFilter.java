package com.fitcoach.security;

import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Reads the Bearer access token, loads the user, populates the SecurityContext. */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokens;
    private final UserRepository users;

    public JwtAuthFilter(JwtTokenProvider tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = tokens.parse(header.substring(7));
                if (JwtTokenProvider.TYPE_ACCESS.equals(claims.get("typ", String.class))) {
                    users.findById(java.util.UUID.fromString(claims.getSubject())).ifPresent(user -> {
                        if (!user.isSuspended()) {
                            var auth = new UsernamePasswordAuthenticationToken(
                                    user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name().toUpperCase())));
                            SecurityContextHolder.getContext().setAuthentication(auth);
                        }
                    });
                }
            } catch (Exception ignored) {
                // invalid/expired token -> anonymous; entry point returns 401 for protected routes
            }
        }
        chain.doFilter(request, response);
    }
}
