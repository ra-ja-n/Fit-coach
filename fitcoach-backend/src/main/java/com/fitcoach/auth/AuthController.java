package com.fitcoach.auth;

import com.fitcoach.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    public record RegisterRequest(@NotBlank String role, @NotBlank @Size(min = 2, max = 80) String name,
                                  @NotBlank @Email String email, @NotBlank @Size(min = 8, max = 100) String password) {}
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record RefreshRequest(@NotBlank String refreshToken) {}
    public record AuthResponse(String accessToken, String refreshToken, UserDto user) {}

    private AuthResponse toResponse(AuthService.TokenPair pair) {
        return new AuthResponse(pair.accessToken(), pair.refreshToken(), UserDto.from(pair.user(), null));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@jakarta.validation.Valid @RequestBody RegisterRequest req) {
        var role = com.fitcoach.user.UserRole.valueOf(req.role().toLowerCase());
        var user = auth.register(role, req.name(), req.email(), req.password());
        return ResponseEntity.ok(toResponse(auth.issueFor(user)));
    }

    @PostMapping("/login")
    public AuthResponse login(@jakarta.validation.Valid @RequestBody LoginRequest req) {
        return toResponse(auth.login(req.email(), req.password()));
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@jakarta.validation.Valid @RequestBody RefreshRequest req) {
        return toResponse(auth.refresh(req.refreshToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody RefreshRequest req) {
        auth.logout(req.refreshToken());
        return ResponseEntity.noContent().build();
    }
}
