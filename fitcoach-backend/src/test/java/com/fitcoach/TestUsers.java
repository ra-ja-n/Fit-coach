package com.fitcoach;

import com.fitcoach.user.User;
import com.fitcoach.user.UserRole;
import java.util.UUID;

/** Shared fixture: the four identities every tenancy test needs. */
public final class TestUsers {

    private TestUsers() {}

    public static User user(UUID id, UserRole role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setName(role + " " + id.toString().substring(0, 4));
        u.setEmail(role + "-" + id + "@test.app");
        u.setPasswordHash("$2a$10$notarealhash");
        return u;
    }

    public static User coach() { return user(UUID.randomUUID(), UserRole.coach); }
    public static User client() { return user(UUID.randomUUID(), UserRole.client); }
    public static User admin() { return user(UUID.randomUUID(), UserRole.admin); }
}
