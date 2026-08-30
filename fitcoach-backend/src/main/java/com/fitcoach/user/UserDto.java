package com.fitcoach.user;

import java.util.UUID;

/** Public DTO — never exposes password hash, lockout counters, etc. */
public record UserDto(UUID id, String role, String name, String email, String coachStatus) {
    public static UserDto from(User u, String coachStatus) {
        return new UserDto(u.getId(), u.getRole().name(), u.getName(), u.getEmail(), coachStatus);
    }
}
