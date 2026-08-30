package com.fitcoach.coach;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fitcoach.TestUsers;
import com.fitcoach.common.ApiException;
import com.fitcoach.security.OwnershipGuard;
import com.fitcoach.subscription.SubscriptionRepository;
import com.fitcoach.user.User;
import com.fitcoach.user.UserRepository;
import java.util.List;
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
 * Coach-scoped tenancy: a coach can only ever touch their own profile and
 * packages, and discovery exposes nothing about unapproved coaches.
 */
@ExtendWith(MockitoExtension.class)
class CoachServiceTest {

    @Mock CoachingPackageRepository packages;
    @Mock CoachProfileRepository profiles;
    @Mock UserRepository users;
    @Mock SubscriptionRepository subscriptions;

    CoachService service;
    User coach = TestUsers.coach();
    User otherCoach = TestUsers.coach();

    @BeforeEach
    void setUp() {
        service = new CoachService(profiles, packages, users, subscriptions,
                new OwnershipGuard(subscriptions));
    }

    private CoachingPackage pkg(UUID coachId) {
        CoachingPackage p = new CoachingPackage();
        p.setId(UUID.randomUUID());
        p.setCoachId(coachId);
        p.setTitle("Monthly");
        p.setPriceCents(5900);
        p.setDurationDays(30);
        return p;
    }

    @Test
    @DisplayName("CROSS-TENANT: editing another coach's package by id is a 404, not a 403")
    void cannotEditAnotherCoachesPackage() {
        CoachingPackage theirs = pkg(otherCoach.getId());
        // The lookup is scoped by coach id, so the row simply does not exist here.
        when(packages.findByIdAndCoachId(theirs.getId(), coach.getId())).thenReturn(Optional.empty());

        ApiException e = catchThrowableOfType(ApiException.class, () -> service.savePackage(coach,
                new CoachDtos.SavePackageRequest(theirs.getId(), "Hijacked", 1L, 30, List.of())));
        assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(e.getCode()).isEqualTo("NOT_FOUND");
        verify(packages, never()).save(any());
    }

    @Test
    @DisplayName("CROSS-TENANT: deleting another coach's package is a 404")
    void cannotDeleteAnotherCoachesPackage() {
        when(packages.findByIdAndCoachId(any(UUID.class), eq(coach.getId()))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deletePackage(coach, UUID.randomUUID()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(packages, never()).delete(any());
    }

    @Test
    @DisplayName("a coach cannot delete a package that has subscribers")
    void cannotDeletePackageInUse() {
        CoachingPackage mine = pkg(coach.getId());
        when(packages.findByIdAndCoachId(mine.getId(), coach.getId())).thenReturn(Optional.of(mine));
        when(subscriptions.existsByPackageId(mine.getId())).thenReturn(true);

        ApiException e = catchThrowableOfType(ApiException.class, () -> service.deletePackage(coach, mine.getId()));
        assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getCode()).isEqualTo("PACKAGE_IN_USE");
    }

    @Test
    @DisplayName("public discovery hides pending coaches behind a plain 404")
    void pendingCoachIsNotDiscoverable() {
        CoachProfile pending = new CoachProfile();
        pending.setUserId(otherCoach.getId());
        pending.setStatus(CoachStatus.pending);
        when(profiles.findById(otherCoach.getId())).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.getPublic(otherCoach.getId()))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("only approved coaches appear in the public list")
    void publicListIsApprovedOnly() {
        when(profiles.findByStatusOrderByUpdatedAtDesc(CoachStatus.approved)).thenReturn(List.of());
        assertThat(service.listApproved()).isEmpty();
        verify(profiles, never()).findByStatus(CoachStatus.pending);
    }
}
