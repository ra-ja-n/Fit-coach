package com.fitcoach.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** Explicit query — email lookups are always normalized lower-case. */
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmail(String email);
}
